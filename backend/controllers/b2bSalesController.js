const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { ensureLedger, postVoucher } = require('../utils/accountingHelper');

// Generate B2B Invoice Number
const generateInvoiceNumber = async (prefix = 'INV') => {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  
  const lastInvoice = await prisma.sale.findFirst({
    where: {
      invoiceNumber: {
        startsWith: `${prefix}-${year}${month}`
      },
      isB2B: true
    },
    orderBy: { createdAt: 'desc' }
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSeq = parseInt(lastInvoice.invoiceNumber.split('-').pop());
    sequence = lastSeq + 1;
  }

  return `${prefix}-${year}${month}-${sequence.toString().padStart(4, '0')}`;
};

// Determine if IGST or CGST/SGST based on place of supply
const determineTaxType = async (placeOfSupply) => {
  const company = await prisma.companyProfile.findFirst();
  if (!company || !company.state) return 'INTRA'; // Default to INTRA
  
  // Compare company state with place of supply
  if (company.state.toLowerCase() === placeOfSupply?.toLowerCase()) {
    return 'INTRA'; // Same state - CGST + SGST
  }
  return 'INTER'; // Different state - IGST
};

// Create B2B Invoice
exports.createB2BInvoice = asyncHandler(async (req, res) => {
  const {
    customerId,
    items,
    paymentMethod,
    paidAmount,
    saleDate,
    branchId,
    salesmanId,
    placeOfSupply,
    transportMode,
    vehicleNumber,
    transporterName,
    transporterId,
    roundOffAmount
  } = req.body;

  if (!branchId) {
    res.status(400);
    throw new Error('Branch is required');
  }

  if (!customerId) {
    res.status(400);
    throw new Error('Customer is required for B2B invoice');
  }

  if (!items || items.length === 0) {
    res.status(400);
    throw new Error('At least one item is required');
  }

  const customer = await prisma.customer.findUnique({ 
    where: { id: parseInt(customerId) } 
  });
  
  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  // Get settings for prefix
  const settings = await prisma.gSTSettings.findFirst();
  const prefix = settings?.invoicePrefix || 'INV';
  const taxType = await determineTaxType(placeOfSupply || customer.state);

  const result = await prisma.$transaction(async (tx) => {
    // Calculate totals
    let subTotal = 0;
    let taxAmount = 0;
    const saleItemsData = [];

    for (const item of items) {
      const productId = parseInt(item.productId);
      const product = await tx.product.findUnique({ where: { id: productId } });
      
      if (!product) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      // Stock check
      const productStock = await tx.productStock.findUnique({
        where: {
          branchId_productId: {
            branchId: parseInt(branchId),
            productId: productId
          }
        }
      });

      if (!productStock || productStock.quantity < item.quantity) {
        throw new Error(`Insufficient stock for product: ${product.name}`);
      }

      const unitPrice = parseFloat(item.unitPrice || product.price);
      const quantity = parseInt(item.quantity);
      const discountPercent = parseFloat(item.discountPercent || 0);
      const discountAmount = (unitPrice * discountPercent) / 100;
      const netPrice = unitPrice - discountAmount;
      const taxRate = parseFloat(product.taxRate || 0);
      
      const lineTotal = quantity * netPrice;
      const lineTax = (lineTotal * taxRate) / 100;

      subTotal += lineTotal;
      taxAmount += lineTax;

      saleItemsData.push({
        productId,
        quantity,
        unitPrice,
        discountPercent,
        discountAmount: discountAmount * quantity,
        taxRate,
        taxAmount: lineTax,
        total: lineTotal + lineTax
      });
    }

    const grandTotal = subTotal + taxAmount + parseFloat(roundOffAmount || 0);
    const finalPaidAmount = parseFloat(paidAmount || 0);
    const invoiceNumber = await generateInvoiceNumber(prefix);

    // Check if E-Way Bill is required
    const ewayRequired = settings && grandTotal >= parseFloat(settings.ewayBillThreshold);

    // Create Sale Record
    const sale = await tx.sale.create({
      data: {
        invoiceNumber,
        customerId: customer.id,
        paymentMethod: paymentMethod || 'Credit',
        subTotal,
        taxAmount,
        totalAmount: grandTotal,
        roundOffAmount: parseFloat(roundOffAmount || 0),
        paidAmount: finalPaidAmount,
        balanceAmount: grandTotal - finalPaidAmount,
        saleDate: saleDate ? new Date(saleDate) : new Date(),
        branchId: parseInt(branchId),
        salesmanId: salesmanId ? parseInt(salesmanId) : null,
        status: (grandTotal - finalPaidAmount) > 0.5 ? 'partial' : 'completed',
        isB2B: true,
        placeOfSupply: placeOfSupply || customer.state,
        transportMode,
        vehicleNumber,
        transporterName,
        transporterId,
        items: {
          create: saleItemsData
        }
      },
      include: {
        customer: true,
        items: { include: { product: true } },
        branch: true
      }
    });

    // Deduct Stock
    for (const item of items) {
      await tx.productStock.update({
        where: {
          branchId_productId: {
            branchId: parseInt(branchId),
            productId: parseInt(item.productId)
          }
        },
        data: { quantity: { decrement: parseInt(item.quantity) } }
      });
    }

    // Accounting Integration
    try {
      const userId = req.user ? req.user.id : 1;
      const customerLedger = await ensureLedger(tx, customer.name, 'Sundry Debtors');
      const salesLedger = await ensureLedger(tx, 'Sales Account', 'Sales Accounts');

      const entries = [
        { ledgerId: customerLedger.id, type: 'DEBIT', amount: grandTotal }
      ];

      if (taxAmount > 0) {
        entries.push({ ledgerId: salesLedger.id, type: 'CREDIT', amount: subTotal });
        
        if (taxType === 'INTER') {
          const igstLedger = await ensureLedger(tx, 'Output IGST', 'Duties & Taxes');
          entries.push({ ledgerId: igstLedger.id, type: 'CREDIT', amount: taxAmount });
        } else {
          const halfTax = parseFloat((taxAmount / 2).toFixed(2));
          const otherHalf = taxAmount - halfTax;
          
          const cgstLedger = await ensureLedger(tx, 'Output CGST', 'Duties & Taxes');
          const sgstLedger = await ensureLedger(tx, 'Output SGST', 'Duties & Taxes');
          
          entries.push({ ledgerId: cgstLedger.id, type: 'CREDIT', amount: halfTax });
          entries.push({ ledgerId: sgstLedger.id, type: 'CREDIT', amount: otherHalf });
        }
      } else {
        entries.push({ ledgerId: salesLedger.id, type: 'CREDIT', amount: grandTotal });
      }

      await postVoucher(tx, {
        type: 'SALES',
        date: saleDate ? new Date(saleDate) : new Date(),
        amount: grandTotal,
        narration: `B2B Invoice #${invoiceNumber}`,
        reference: invoiceNumber,
        createdBy: userId
      }, entries);

      // Payment entry if paid
      if (finalPaidAmount > 0) {
        const cashLedger = await ensureLedger(tx, 'Cash', 'Cash-in-Hand');
        await postVoucher(tx, {
          type: 'RECEIPT',
          date: saleDate ? new Date(saleDate) : new Date(),
          amount: finalPaidAmount,
          narration: `Payment for B2B Invoice #${invoiceNumber}`,
          reference: invoiceNumber,
          createdBy: userId
        }, [
          { ledgerId: cashLedger.id, type: 'DEBIT', amount: finalPaidAmount },
          { ledgerId: customerLedger.id, type: 'CREDIT', amount: finalPaidAmount }
        ]);
      }
    } catch (accErr) {
      console.error('Accounting Error:', accErr);
    }

    return { sale, ewayRequired, taxType };
  });

  res.status(201).json(result);
});

// Get B2B Invoices
exports.getB2BInvoices = asyncHandler(async (req, res) => {
  const { branchId, startDate, endDate } = req.query;
  
  const where = { isB2B: true };
  if (branchId) where.branchId = parseInt(branchId);
  if (startDate && endDate) {
    where.saleDate = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  const invoices = await prisma.sale.findMany({
    where,
    include: {
      customer: true,
      items: { include: { product: true } },
      branch: true
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(invoices);
});

// Get Invoice for Print
exports.getInvoiceForPrint = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const sale = await prisma.sale.findUnique({
    where: { id: parseInt(id) },
    include: {
      customer: true,
      items: { include: { product: true } },
      branch: true
    }
  });

  if (!sale) {
    res.status(404);
    throw new Error('Invoice not found');
  }

  const company = await prisma.companyProfile.findFirst();
  const settings = await prisma.gSTSettings.findFirst();
  const taxType = await determineTaxType(sale.placeOfSupply);

  // Generate HSN Summary
  const hsnSummary = {};
  sale.items.forEach(item => {
    const hsn = item.product.hsnCode || 'N/A';
    if (!hsnSummary[hsn]) {
      hsnSummary[hsn] = {
        hsn,
        taxableValue: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total: 0
      };
    }
    const taxable = parseFloat(item.total) - parseFloat(item.taxAmount);
    const tax = parseFloat(item.taxAmount);
    
    hsnSummary[hsn].taxableValue += taxable;
    if (taxType === 'INTER') {
      hsnSummary[hsn].igst += tax;
    } else {
      hsnSummary[hsn].cgst += tax / 2;
      hsnSummary[hsn].sgst += tax / 2;
    }
    hsnSummary[hsn].total += parseFloat(item.total);
  });

  res.json({
    sale,
    company,
    settings,
    taxType,
    hsnSummary: Object.values(hsnSummary)
  });
});

// Update E-Way Bill
exports.updateEwayBill = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { ewayBillNumber, ewayBillDate } = req.body;

  const sale = await prisma.sale.update({
    where: { id: parseInt(id) },
    data: {
      ewayBillNumber,
      ewayBillDate: ewayBillDate ? new Date(ewayBillDate) : new Date()
    },
    include: { customer: true }
  });

  res.json(sale);
});
