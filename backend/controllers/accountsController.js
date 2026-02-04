const prisma = require('../utils/prismaClient');

// Get Expenses
exports.getExpenses = async (req, res) => {
  const { branchId } = req.query;
  try {
    const where = branchId ? { branchId: parseInt(branchId) } : {};
    const expenses = await prisma.expense.findMany({ 
      where,
      orderBy: { date: 'desc' } 
    });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create Expense
exports.createExpense = async (req, res) => {
  const { title, amount, category, description, date, branchId } = req.body;
  try {
    const expense = await prisma.expense.create({
      data: {
        title: title || description || 'Expense',
        amount: parseFloat(amount),
        category,
        description,
        branchId: parseInt(branchId),
        date: date ? new Date(date) : new Date()
      }
    });
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Payments & Receipts
exports.getPayments = async (req, res) => {
  const { branchId } = req.query;
  try {
    const where = branchId ? { branchId: parseInt(branchId) } : {};
    const payments = await prisma.payment.findMany({ 
      where,
      orderBy: { paymentDate: 'desc' } 
    });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create Payment/Receipt
exports.createPayment = async (req, res) => {
  const { type, amount, method, reference, description, date, branchId } = req.body;
  try {
    const payment = await prisma.payment.create({
      data: {
        type, // 'payment' (out) or 'receipt' (in)
        amount: parseFloat(amount),
        method: method || 'cash',
        reference,
        description,
        branchId: parseInt(branchId),
        paymentDate: date ? new Date(date) : new Date()
      }
    });
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Outstanding Balances
exports.getOutstanding = async (req, res) => {
  const { branchId } = req.query;
  try {
    const where = branchId ? { branchId: parseInt(branchId) } : {};

    // 1. Get Customers with non-zero balances in this branch
    const customers = await prisma.customer.findMany({
      where: {
        branchId: branchId ? parseInt(branchId) : undefined,
        sales: {
          some: { 
            branchId: branchId ? parseInt(branchId) : undefined,
            balanceAmount: { gt: 0 } 
          }
        }
      },
      include: {
        sales: {
          where: { 
            branchId: branchId ? parseInt(branchId) : undefined,
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

    // 2. Get Suppliers with non-zero balances (Suppliers are global but purchases are per branch)
    const suppliers = await prisma.supplier.findMany({
      where: {
        purchases: {
          some: { 
            branchId: branchId ? parseInt(branchId) : undefined,
            balanceAmount: { gt: 0 } 
          }
        }
      },
      include: {
        purchases: {
          where: { 
            branchId: branchId ? parseInt(branchId) : undefined,
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
