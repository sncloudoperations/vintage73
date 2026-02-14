const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { postTransaction } = require('../services/dynamicPostingService');

// Get Expenses
exports.getExpenses = asyncHandler(async (req, res) => {
  const { branchId: queryBranchId } = req.query;
  const user = req.user;

  // Enforce branch isolation: use queryBranchId if user has permission, else fallback to user's branch
  let branchId = queryBranchId || user?.branchId;

  if (!branchId) {
    res.status(400);
    throw new Error('Branch selection is required to view expenses.');
  }

  const where = { branchId: parseInt(branchId) };
  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: 'desc' }
  });
  res.json(expenses);
});

// Create Expense
exports.createExpense = asyncHandler(async (req, res) => {
  const { title, amount, category, description, date } = req.body;
  let { branchId } = req.body;
  const user = req.user;

  if (!branchId && user?.branchId) {
    branchId = user.branchId;
  }

  if (!branchId) {
    res.status(400);
    throw new Error('Branch selection is required to create an expense.');
  }

  const validBranchId = parseInt(branchId);

  const result = await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        title: title || description || 'Expense',
        amount: parseFloat(amount),
        category,
        description,
        branchId: validBranchId,
        date: date ? new Date(date) : new Date()
      }
    });

    // --- ACCOUNTING INTEGRATION ---
    try {
      const userId = user ? user.id : 1;
      await postTransaction(tx, 'EXPENSE', expense, userId, `EXP-${expense.id}`, expense.title);
    } catch (accErr) {
      console.error("Expense Accounting Integration Failed:", accErr);
      const error = new Error('Accounting Error: ' + accErr.message);
      error.statusCode = 500;
      throw error;
    }

    return expense;
  });

  res.status(201).json(result);
});

// Get Payments & Receipts
exports.getPayments = asyncHandler(async (req, res) => {
  const { branchId: queryBranchId } = req.query;
  const user = req.user;

  let branchId = queryBranchId || user?.branchId;

  if (!branchId) {
    res.status(400);
    throw new Error('Branch selection is required to view payments.');
  }

  const where = { branchId: parseInt(branchId) };
  const payments = await prisma.payment.findMany({
    where,
    orderBy: { paymentDate: 'desc' }
  });
  res.json(payments);
});

// Create Payment/Receipt
exports.createPayment = asyncHandler(async (req, res) => {
  const { type, amount, method, reference, description, date, customerId, supplierId } = req.body;
  let { branchId } = req.body;
  const user = req.user;

  if (!branchId && user?.branchId) {
    branchId = user.branchId;
  }

  if (!branchId) {
    res.status(400);
    throw new Error('Branch selection is required to create a payment.');
  }

  const validBranchId = parseInt(branchId);

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        type, // 'payment' (out) or 'receipt' (in)
        amount: parseFloat(amount),
        method: method || 'cash',
        reference,
        description,
        branchId: validBranchId,
        paymentDate: date ? new Date(date) : new Date(),
        customerId: customerId ? parseInt(customerId) : null,
        supplierId: supplierId ? parseInt(supplierId) : null
      },
      include: {
        customer: true,
        supplier: true
      }
    });

    // --- ACCOUNTING INTEGRATION ---
    try {
      const userId = user ? user.id : 1;
      const transactionType = type.toUpperCase(); // 'PAYMENT' or 'RECEIPT'
      await postTransaction(tx, transactionType, payment, userId, reference || `PAY-${payment.id}`, description);
    } catch (accErr) {
      console.error("Payment Accounting Integration Failed:", accErr);
      const error = new Error('Accounting Error: ' + accErr.message);
      error.statusCode = 500;
      throw error;
    }

    return payment;
  });

  res.status(201).json(result);
});

// Get Outstanding Balances
exports.getOutstanding = asyncHandler(async (req, res) => {
  const { branchId: queryBranchId } = req.query;
  const user = req.user;

  let branchId = queryBranchId || user?.branchId;

  if (!branchId) {
    res.status(400);
    throw new Error('Branch selection is required to view outstanding balances.');
  }

  const validBranchId = parseInt(branchId);

  // 1. Get Customers with non-zero balances in this branch
  const customers = await prisma.customer.findMany({
    where: {
      branchId: validBranchId,
      sales: {
        some: {
          branchId: validBranchId,
          balanceAmount: { gt: 0 }
        }
      }
    },
    include: {
      sales: {
        where: {
          branchId: validBranchId,
          balanceAmount: { gt: 0 }
        },
        select: { balanceAmount: true, invoiceNumber: true, saleDate: true }
      }
    }
  });

  const customerSummary = customers.map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    totalBalance: c.sales.reduce((sum, s) => sum + parseFloat(s.balanceAmount), 0),
    items: c.sales
  })).filter(c => c.totalBalance > 0);

  // 2. Get Suppliers with non-zero balances
  const suppliers = await prisma.supplier.findMany({
    where: {
      purchases: {
        some: {
          branchId: validBranchId,
          balanceAmount: { gt: 0 }
        }
      }
    },
    include: {
      purchases: {
        where: {
          branchId: validBranchId,
          balanceAmount: { gt: 0 }
        },
        select: { balanceAmount: true, id: true, purchaseDate: true }
      }
    }
  });

  const supplierSummary = suppliers.map(s => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    totalBalance: s.purchases.reduce((sum, p) => sum + parseFloat(p.balanceAmount), 0),
    items: s.purchases
  })).filter(s => s.totalBalance > 0);

  res.json({
    customers: customerSummary,
    suppliers: supplierSummary
  });
});
