const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { ensureLedger } = require('../utils/accountingHelper');

// Get all customers
exports.getCustomers = asyncHandler(async (req, res) => {
  const { branchId: queryBranchId } = req.query;
  const user = req.user;

  // --- BRANCH ENFORCEMENT ---
  let branchId = queryBranchId;
  const isAdmin = ['ADMIN', 'OWNER', 'SUPERADMIN'].includes(user?.role?.toUpperCase());

  if (!isAdmin) {
    branchId = user.branchId;
  }

  const where = branchId ? { branchId: parseInt(branchId) } : {};
  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { sales: true }
      }
    }
  });
  res.json(customers);
});

// Create customer
exports.createCustomer = asyncHandler(async (req, res) => {
  const { name, phone, email, address, branchId: queryBranchId, city, state, pincode, gstin, partyType } = req.body;
  const user = req.user;

  // --- BRANCH FALLBACK ---
  let branchId = queryBranchId;
  if (!branchId && user?.branchId) {
    branchId = user.branchId;
  }

  const customer = await prisma.customer.create({
    data: { 
      name, 
      phone, 
      email, 
      address, 
      city,
      state,
      pincode,
      gstin,
      partyType: partyType || 'B2C',
      branchId: branchId ? parseInt(branchId) : null 
    }
  });

  // --- ACCOUNTING INTEGRATION ---
  try {
      await ensureLedger(prisma, name, 'Sundry Debtors');
  } catch (accErr) {
      console.error("Failed to create customer ledger:", accErr);
  }

  res.status(201).json(customer);
});

// Update customer
exports.updateCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, phone, email, address, branchId, city, state, pincode, gstin, partyType } = req.body;
  const customer = await prisma.customer.update({
    where: { id: parseInt(id) },
    data: { 
      name, 
      phone, 
      email, 
      address, 
      city,
      state,
      pincode,
      gstin,
      partyType: partyType || 'B2C',
      branchId: branchId ? parseInt(branchId) : null 
    }
  });
  res.json(customer);
});

// Delete customer
exports.deleteCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.customer.delete({ where: { id: parseInt(id) } });
  res.json({ message: 'Customer deleted successfully' });
});

// Get Customer Balance
exports.getCustomerBalance = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { branchId } = req.query;
  const where = { customerId: parseInt(id) };
  if (branchId) where.branchId = parseInt(branchId);
  
  const sales = await prisma.sale.findMany({
    where
  });
  
  // Net Balance = (Sum of Sales Balance) - (Sum of Return Values)
  const totalBalance = sales.reduce((sum, s) => {
      if (s.isReturn) {
          // Returns reduce the balance (Credit to customer)
          return sum - parseFloat(s.totalAmount || 0);
      } else {
          // Outstanding balance from regular sales
          return sum + parseFloat(s.balanceAmount || 0);
      }
  }, 0);
  
  res.json({ balance: totalBalance });
});
