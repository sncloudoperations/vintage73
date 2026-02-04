const prisma = require('../utils/prismaClient');
const { ensureLedger } = require('../utils/accountingHelper');

// Get all customers
exports.getCustomers = async (req, res) => {
  const { branchId } = req.query;
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create customer
exports.createCustomer = async (req, res) => {
  const { name, phone, email, address, branchId, city, state, pincode, gstin, partyType } = req.body;
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update customer
exports.updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { name, phone, email, address, branchId, city, state, pincode, gstin, partyType } = req.body;
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete customer
exports.deleteCustomer = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.customer.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Customer Balance
exports.getCustomerBalance = async (req, res) => {
  const { id } = req.params;
  const { branchId } = req.query;
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
