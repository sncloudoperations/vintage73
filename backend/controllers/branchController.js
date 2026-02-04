const prisma = require('../utils/prismaClient');

// Get All Branches
exports.getBranches = async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(branches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Single Branch
exports.getBranchById = async (req, res) => {
  const { id } = req.params;
  try {
    const branch = await prisma.branch.findUnique({
      where: { id: parseInt(id) }
    });
    if (!branch) return res.status(404).json({ message: 'Branch not found' });
    res.json(branch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create Branch
exports.createBranch = async (req, res) => {
  try {
    const { name, address, phone, email } = req.body;
    const branch = await prisma.branch.create({
      data: { name, address, phone, email }
    });
    res.status(201).json(branch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update Branch
exports.updateBranch = async (req, res) => {
  const { id } = req.params;
  const { name, address, phone, email, isActive } = req.body;
  try {
    const branch = await prisma.branch.update({
      where: { id: parseInt(id) },
      data: { name, address, phone, email, isActive }
    });
    res.json(branch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete Branch
exports.deleteBranch = async (req, res) => {
  const { id } = req.params;
  try {
    // Check if branch has associated data
    const usersCount = await prisma.user.count({ where: { branchId: parseInt(id) } });
    if (usersCount > 0) {
      return res.status(400).json({ message: 'Cannot delete branch with assigned users' });
    }
    
    await prisma.branch.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Branch deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update Invoice Settings for a Branch
exports.updateInvoiceSettings = async (req, res) => {
  const { id } = req.params;
  const { invoiceSettings } = req.body;
  try {
    const branch = await prisma.branch.update({
      where: { id: parseInt(id) },
      data: { invoiceSettings }
    });
    res.json(branch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
