const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

// Get All Branches
exports.getBranches = asyncHandler(async (req, res) => {
  const branches = await prisma.branch.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(branches);
});

// Get Single Branch
exports.getBranchById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const branchId = parseInt(id);
  if (isNaN(branchId)) {
    res.status(400);
    throw new Error('Invalid Branch ID');
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId }
  });
  if (!branch) {
    res.status(404);
    throw new Error('Branch not found');
  }
  res.json(branch);
});

// Create Branch
exports.createBranch = asyncHandler(async (req, res) => {
  const { name, address, phone, email } = req.body;
  const branch = await prisma.branch.create({
    data: { name, address, phone, email }
  });
  res.status(201).json(branch);
});

// Update Branch
exports.updateBranch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const branchId = parseInt(id);
  if (isNaN(branchId)) {
    res.status(400);
    throw new Error('Invalid Branch ID');
  }

  const { name, address, phone, email, isActive } = req.body;
  const branch = await prisma.branch.update({
    where: { id: branchId },
    data: { name, address, phone, email, isActive }
  });
  res.json(branch);
});

// Delete Branch
exports.deleteBranch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const branchId = parseInt(id);
  if (isNaN(branchId)) {
    res.status(400);
    throw new Error('Invalid Branch ID');
  }

  // Check if branch has associated data
  const usersCount = await prisma.user.count({ where: { branchId: branchId } });
  if (usersCount > 0) {
    res.status(400);
    throw new Error('Cannot delete branch with assigned users');
  }
  
  await prisma.branch.delete({ where: { id: branchId } });
  res.json({ message: 'Branch deleted' });
});

// Update Invoice Settings for a Branch
exports.updateInvoiceSettings = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const branchId = parseInt(id);
  if (isNaN(branchId)) {
    res.status(400);
    throw new Error('Invalid Branch ID');
  }

  const { invoiceSettings } = req.body;
  const branch = await prisma.branch.update({
    where: { id: branchId },
    data: { invoiceSettings }
  });
  res.json(branch);
});
