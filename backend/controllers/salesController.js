const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { processSalePosting } = require('../utils/accountingHelper');

// Create new sale
exports.createSale = asyncHandler(async (req, res) => {
  const { customerId, items, paymentMethod, paidAmount, discount = 0, saleDate, salesmanId, terminalId } = req.body;
  let { branchId } = req.body;

  // 1. Hardened Validation
  // If branchId is missing in body, try to get it from the authenticated user
  if (!branchId && req.user && req.user.branchId) {
    branchId = req.user.branchId;
  }

  if (!branchId) {
    res.status(400);
    throw new Error('Branch selection is required. Please select a branch or login to a branch-assigned account.');
  }

  const validBranchId = parseInt(branchId);
  if (isNaN(validBranchId)) {
    res.status(400);
    throw new Error('Invalid Branch ID provided.');
  }

  // Verify branch exists in DB
  const branchExists = await prisma.branch.findUnique({ where: { id: validBranchId } });
  if (!branchExists) {
    res.status(404);
    throw new Error(`Branch with ID ${validBranchId} not found.`);
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
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

  const result = await prisma.$transaction(async (tx) => {
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

      // Stock check
      const productStock = await tx.productStock.findUnique({
        where: {
          branchId_productId: {
            branchId: validBranchId,
            productId: productId
          }
        }
      });

      if (!productStock || productStock.quantity < item.quantity) {
        const error = new Error(`Insufficient stock for product: ${product.name} in this branch`);
        error.statusCode = 400;
        throw error;
      }

      const netPrice = parseFloat(item.unitPrice) - parseFloat(item.discountAmount || 0);
      const taxRate = parseFloat(product.taxRate || 0);
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

      saleItemsData.push({
        productId: productId,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
        discountPercent: parseFloat(item.discountPercent || 0),
        discountAmount: parseFloat(item.discountAmount || 0),
        total: parseFloat((lineTotal + (!isTaxInclusive ? lineTax : 0)).toFixed(2)),
        taxAmount: parseFloat(lineTax.toFixed(2)),
        taxRate: parseFloat(taxRate)
      });
    }

    const grandTotal = subTotal + taxAmount - parseFloat(discount) + parseFloat(req.body.roundOffAmount || 0);
    const finalPaidAmount = parseFloat(paidAmount || 0);
    const roundOffAmount = parseFloat(req.body.roundOffAmount || 0);

    // 2. Calculate Incentive
    let incentiveAmount = 0;
    const validSalesmanId = (salesmanId && !isNaN(parseInt(salesmanId))) ? parseInt(salesmanId) : null;

    if (validSalesmanId) {
      const salesman = await tx.user.findUnique({ where: { id: validSalesmanId } });
      if (salesman && salesman.incentivePercentage > 0) {
        incentiveAmount = (grandTotal * parseFloat(salesman.incentivePercentage)) / 100;
      }
    }

    // 3. Create Sale Record
    const sale = await tx.sale.create({
      data: {
        invoiceNumber: `INV-${Date.now()}`,
        customerId: customer ? customer.id : null,
        paymentMethod,
        subTotal,
        taxAmount,
        totalAmount: grandTotal,
        roundOffAmount,
        paidAmount: finalPaidAmount,
        balanceAmount: grandTotal - finalPaidAmount,
        saleDate: saleDate ? new Date(saleDate) : new Date(),
        branchId: validBranchId,
        salesmanId: validSalesmanId,
        terminalId: terminalId ? parseInt(terminalId) : null,
        incentiveAmount: incentiveAmount,
        status: (grandTotal - finalPaidAmount) > 0.5 ? 'partial' : 'completed',
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
      await tx.productStock.update({
        where: {
          branchId_productId: {
            branchId: validBranchId,
            productId: parseInt(item.productId)
          }
        },
        data: {
          quantity: { decrement: item.quantity }
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
            saleId: sale.id,
            branchId: validBranchId,
            customerId: customer ? customer.id : null
          }
        });
      }
    }

    return sale;
  });

  res.status(201).json(result);
});

exports.getAllSales = asyncHandler(async (req, res) => {
  const { branchId, startDate, endDate, terminalId } = req.query;
  const where = {};
  if (branchId) where.branchId = parseInt(branchId);
  if (terminalId) where.terminalId = parseInt(terminalId);
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
