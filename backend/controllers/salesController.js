const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { processSalePosting } = require('../utils/accountingHelper');
const { generateNextNumber } = require('../services/numberingService');

// Create new sale
exports.createSale = asyncHandler(async (req, res) => {
  const { 
    customerId, items, paymentMethod, paidAmount, discount = 0, saleDate, salesmanId, 
    terminalId, isReturn = false, returnReason = '', originalInvoice = '',
    currencyCode = 'INR', exchangeRate = 1.0 
  } = req.body;
  let { branchId } = req.body;

  // 1. Hardened Validation
  // If branchId is missing in body, try to get it from the authenticated user
  if (!branchId && req.user && req.user.branchId) {
    branchId = req.user.branchId;
  }

  console.log(`[POS Checkout] User: ${req.user?.username}, Body BranchId: ${req.body.branchId}, Effective BranchId: ${branchId}`);

  if (!branchId) {
    console.warn(`[POS Checkout] 400: Branch selection is required (User branch: ${req.user?.branchId})`);
    res.status(400);
    throw new Error('Branch selection is required. Please select a branch or login to a branch-assigned account.');
  }

  const validBranchId = parseInt(branchId);
  if (isNaN(validBranchId)) {
    console.warn(`[POS Checkout] 400: Invalid Branch ID: ${branchId}`);
    res.status(400);
    throw new Error('Invalid Branch ID provided.');
  }

  // Verify branch exists in DB
  const branchExists = await prisma.branch.findUnique({ where: { id: validBranchId } });
  if (!branchExists) {
    console.warn(`[POS Checkout] 404: Branch ${validBranchId} not found`);
    res.status(404);
    throw new Error(`Branch with ID ${validBranchId} not found.`);
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    console.warn(`[POS Checkout] 400: Empty items array`);
    res.status(400);
    throw new Error('Sale must have at least one item.');
  }

  // Verify Customer
  let customer = null;
  if (customerId) {
    const validCustomerId = parseInt(customerId);
    if (isNaN(validCustomerId)) {
      res.status(400);
      throw new Error('Invalid Customer ID provided.');
    }
    customer = await prisma.customer.findUnique({ where: { id: validCustomerId } });
    if (!customer) {
      res.status(404);
      throw new Error('Customer not found in database.');
    }
  }

  // --- RETURN VALIDATION ---
  if (isReturn && originalInvoice) {
    const originalSale = await prisma.sale.findUnique({
      where: { invoiceNumber: originalInvoice },
      include: { items: true }
    });

    if (!originalSale) {
      res.status(404);
      throw new Error('Original invoice not found for return.');
    }

    // Get previous returns
    const previousReturns = await prisma.sale.findMany({
      where: {
        originalInvoice: originalInvoice,
        isReturn: true,
        status: { not: 'cancelled' }
      },
      include: { items: true }
    });

    const returnedQtyMap = {};
    previousReturns.forEach(ret => {
      ret.items.forEach(item => {
        returnedQtyMap[item.productId] = (returnedQtyMap[item.productId] || 0) + item.quantity;
      });
    });

    for (const item of items) {
      const originalItem = originalSale.items.find(i => i.productId === parseInt(item.productId));
      if (!originalItem) {
        res.status(400);
        throw new Error(`Product ${item.productId} was not part of original invoice ${originalInvoice}.`);
      }

      const alreadyReturned = returnedQtyMap[item.productId] || 0;
      const remaining = originalItem.quantity - alreadyReturned;

      if (parseInt(item.quantity) > remaining) {
        res.status(400);
        throw new Error(`Cannot return ${item.quantity} units of product ${item.productId}. Only ${remaining} units remaining.`);
      }
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    // Re-verify branch stock setting inside transaction for absolute current state
    const fetchBranch = await tx.branch.findUnique({ where: { id: validBranchId } });
    const stockIncluded = !!fetchBranch?.stockIncluded;

    console.log(`[POS Stock Validation] Branch: ${fetchBranch?.name}, Included: ${stockIncluded}, IsReturn: ${isReturn}`);

    // 1. Calculate Totals
    let subTotal = 0;
    let taxAmount = 0;
    const saleItemsData = [];

    for (const item of items) {
      const productId = parseInt(item.productId);
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) {
        const error = new Error(`Product with ID ${productId} not found.`);
        error.statusCode = 404;
        throw error;
      }

      // --- STOCK VALIDATION ---
      if (!isReturn && stockIncluded) {
        const stock = await tx.productStock.findUnique({
          where: {
            branchId_productId: {
              branchId: validBranchId,
              productId: productId
            }
          }
        });

        console.log(`[POS Stock Validation] Product: ${product.name}, Stock: ${stock?.quantity || 0}, Required: ${item.quantity}`);

        if (!stock || stock.quantity < item.quantity) {
          const error = new Error(`Insufficient stock for product ${product.name}. Available: ${stock ? stock.quantity : 0}, Required: ${item.quantity}`);
          error.statusCode = 400;
          throw error;
        }
      }



      const unitPrice = item.unitPrice || item.price || 0;
      const netPrice = parseFloat(unitPrice) - parseFloat(item.discountAmount || 0);
      const taxRate = item.taxPercent !== undefined ? parseFloat(item.taxPercent) : parseFloat(product.taxRate || 0);
      const isTaxInclusive = product.isTaxInclusive || false;

      let lineTax = 0;
      let lineTotal = 0;

      if (isTaxInclusive && taxRate > 0) {
        // Price includes tax: Tax = TotalPrice - (TotalPrice / (1 + Rate))
        lineTotal = item.quantity * netPrice;
        lineTax = lineTotal - (lineTotal / (1 + (taxRate / 100)));
      } else if (taxRate > 0) {
        // Price excludes tax: Tax = TotalPrice * Rate
        lineTotal = item.quantity * netPrice;
        lineTax = (lineTotal * taxRate) / 100;
      } else {
        lineTotal = item.quantity * netPrice;
      }

      subTotal += (lineTotal - (isTaxInclusive ? lineTax : 0));
      taxAmount += lineTax;

      const safeUnitPrice = isNaN(parseFloat(unitPrice)) ? 0 : parseFloat(unitPrice);
      const safeLineTax = isNaN(lineTax) ? 0 : lineTax;
      const safeLineTotal = isNaN(lineTotal) ? 0 : lineTotal;

      saleItemsData.push({
        productId: productId,
        quantity: item.quantity,
        unitPrice: safeUnitPrice,
        discountPercent: parseFloat(item.discountPercent || 0),
        discountAmount: parseFloat(item.discountAmount || 0),
        total: parseFloat((safeLineTotal + (!isTaxInclusive ? safeLineTax : 0)).toFixed(2)),
        taxAmount: parseFloat(safeLineTax.toFixed(2)),
        taxRate: parseFloat(taxRate)
      });
    }

    const grandTotal = (isNaN(subTotal) ? 0 : subTotal) + (isNaN(taxAmount) ? 0 : taxAmount) - parseFloat(discount || 0) + parseFloat(req.body.roundOffAmount || 0);
    const finalSubTotal = isNaN(subTotal) ? 0 : parseFloat(subTotal.toFixed(2));
    const finalTaxAmount = isNaN(taxAmount) ? 0 : parseFloat(taxAmount.toFixed(2));
    const finalGrandTotal = isNaN(grandTotal) ? 0 : parseFloat(grandTotal.toFixed(0)); // Round for cash
    const finalPaidAmount = parseFloat(paidAmount || 0);
    const finalRoundOffAmount = parseFloat(req.body.roundOffAmount || 0);

    // 2. Calculate Incentive
    let incentiveAmount = 0;
    const validSalesmanId = (salesmanId && !isNaN(parseInt(salesmanId))) ? parseInt(salesmanId) : null;

    if (validSalesmanId) {
      const salesman = await tx.user.findUnique({ where: { id: validSalesmanId } });
      if (salesman && salesman.incentivePercentage > 0) {
        incentiveAmount = (finalGrandTotal * parseFloat(salesman.incentivePercentage)) / 100;
      }
    }

    // 3. Financial Year and Invoice Numbering (Branch-wise)
    const { number: generatedInvoiceNumber, nextSeq, financialYearId } = await generateNextNumber(tx, 'invoice', validBranchId, saleDate);

    if (financialYearId) {
        // Update the FY sequence for sync (store the CURRENTLY used sequence as per user requirement)
        await tx.financialYear.update({
            where: { id: financialYearId },
            data: { invoiceSequence: nextSeq }
        });
    }

    // 4. Create Sale Record
    const sale = await tx.sale.create({
      data: {
        invoiceNumber: generatedInvoiceNumber,
        customer: customer ? { connect: { id: customer.id } } : undefined,
        paymentMethod,
        subTotal: finalSubTotal,
        taxAmount: finalTaxAmount,
        totalAmount: finalGrandTotal,
        roundOffAmount: finalRoundOffAmount,
        paidAmount: finalPaidAmount,
        balanceAmount: finalGrandTotal - finalPaidAmount,
        saleDate: saleDate ? new Date(saleDate) : new Date(),
        branch: { connect: { id: validBranchId } },
        salesman: validSalesmanId ? { connect: { id: validSalesmanId } } : undefined,
        terminal: terminalId ? { connect: { id: parseInt(terminalId) } } : undefined,
        incentiveAmount: incentiveAmount,
        status: (finalGrandTotal - finalPaidAmount) > 0.5 ? 'partial' : 'completed',
        financialYear: financialYearId ? { connect: { id: financialYearId } } : undefined,
        isInvoice: !isReturn, // Normally sales are invoices unless it's a return
        isReturn,
        returnReason,
        originalInvoice,
        currencyCode,
        exchangeRate: parseFloat(exchangeRate),
        items: {
          create: saleItemsData
        }
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    // --- ACCOUNTING INTEGRATION ---
    try {
      const userId = req.user ? req.user.id : 1;
      await processSalePosting(tx, sale, userId);
    } catch (accErr) {
      console.error("Accounting Integration Failed:", accErr);
      const error = new Error('Accounting Error: ' + accErr.message);
      error.statusCode = 500;
      throw error;
    }

    for (const item of items) {
      await tx.productStock.upsert({
        where: {
          branchId_productId: {
            branchId: validBranchId,
            productId: parseInt(item.productId)
          }
        },
        create: {
          branchId: validBranchId,
          productId: parseInt(item.productId),
          quantity: isReturn ? item.quantity : -item.quantity
        },
        update: {
          quantity: isReturn ? { increment: item.quantity } : { decrement: item.quantity }
        }
      });
    }

    // 5. Record Payment (if any)
    const paymentsList = req.body.payments || [];

    // If no detailed payments array, fallback to single payment structure
    if (paymentsList.length === 0 && finalPaidAmount > 0) {
      paymentsList.push({
        method: paymentMethod,
        amount: finalPaidAmount
      });
    }

    // Create Payment Records
    for (const p of paymentsList) {
      if (p.amount > 0) {
        await tx.payment.create({
          data: {
            type: 'receipt',
            amount: parseFloat(p.amount),
            method: p.method,
            reference: 'Initial Payment',
            description: `Payment for Invoice ${sale.invoiceNumber}`,
            sale: { connect: { id: sale.id } },
            branch: { connect: { id: validBranchId } },
            customer: customer ? { connect: { id: customer.id } } : undefined
          }
        });
      }
    }

    // 3.5 Calculate Customer Balance for Invoice
    let previousBalance = 0;
    let currentBalance = 0;
    if (customer) {
      const allCustomerSales = await tx.sale.findMany({
        where: { customerId: customer.id }
      });
      currentBalance = allCustomerSales.reduce((sum, s) => {
        if (s.isReturn) return sum - parseFloat(s.totalAmount || 0);
        return sum + parseFloat(s.balanceAmount || 0);
      }, 0);
      previousBalance = currentBalance - (grandTotal - finalPaidAmount);
    }

    return {
      ...sale,
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      previousBalance,
      currentBalance
    };
  });

  res.status(201).json(result);
});

exports.getAllSales = asyncHandler(async (req, res) => {
  const { branchId, startDate, endDate, terminalId, invoice, isInvoice } = req.query;
  const where = {};
  
  if (isInvoice !== undefined) where.isInvoice = isInvoice === 'true';

  // Branch Isolation
  if (req.user.branchId) {
    where.branchId = req.user.branchId;
  } else if (branchId) {
    where.branchId = parseInt(branchId);
  }

  if (terminalId) where.terminalId = parseInt(terminalId);
  if (invoice) where.invoiceNumber = invoice;
  if (startDate && endDate) {
    where.saleDate = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  const sales = await prisma.sale.findMany({
    where,
    include: {
      customer: true,
      items: { include: { product: true } },
      salesman: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  // If a single invoice is requested, calculate already returned quantities
  if (invoice && sales.length > 0) {
    const mainSale = sales[0];

    // Find all returns for this invoice
    const returns = await prisma.sale.findMany({
      where: {
        originalInvoice: invoice,
        isReturn: true,
        status: { not: 'cancelled' }
      },
      include: {
        items: true
      }
    });

    // Create a map of returned quantities by productId
    const returnedQtyMap = {};
    returns.forEach(ret => {
      ret.items.forEach(item => {
        returnedQtyMap[item.productId] = (returnedQtyMap[item.productId] || 0) + item.quantity;
      });
    });

    // Enrich items with alreadyReturnedQty
    mainSale.items = mainSale.items.map(item => ({
      ...item,
      alreadyReturnedQty: returnedQtyMap[item.productId] || 0
    }));

    return res.json([mainSale]);
  }

  res.json(sales);
});

// Cancel Sale (Invoice)
exports.cancelSale = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { cancelledBy, cancelReason } = req.body;

  const sale = await prisma.sale.findUnique({
    where: { id: parseInt(id) },
    include: { items: true }
  });

  if (!sale) {
    res.status(404);
    throw new Error('Sale not found');
  }
  if (sale.status === 'cancelled') {
    res.status(400);
    throw new Error('Sale is already cancelled');
  }

  await prisma.$transaction(async (tx) => {
    // 1. Update Sale Status and metadata
    await tx.sale.update({
      where: { id: parseInt(id) },
      data: {
        status: 'cancelled',
        balanceAmount: 0,
        cancelledAt: new Date(),
        cancelledBy: cancelledBy || 'Unknown Admin',
        cancelReason: cancelReason || 'No reason provided'
      }
    });

    // 2. Restock Items in Branch
    for (const item of sale.items) {
      await tx.productStock.update({
        where: {
          branchId_productId: {
            branchId: sale.branchId,
            productId: item.productId
          }
        },
        data: { quantity: { increment: item.quantity } }
      });
    }

    // 3. Remove associated Receipts from Accounts
    await tx.payment.deleteMany({
      where: { saleId: parseInt(id) }
    });

    // --- ACCOUNTING INTEGRATION ---
    // Cancel associated Vouchers (Sales & Receipts)
    await tx.voucher.updateMany({
      where: { reference: sale.invoiceNumber },
      data: { status: 'CANCELLED' }
    });
  });

  res.json({ message: 'Invoice cancelled and stock restored successfully' });
});
