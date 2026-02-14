const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

exports.getBanks = asyncHandler(async (req, res) => {
  const banks = await prisma.bank.findMany({
    orderBy: { name: 'asc' }
  });
  res.json(banks);
});

exports.createBank = asyncHandler(async (req, res) => {
  const { name, accountNumber, ifscCode, branchName, address, isActive } = req.body;
  const bank = await prisma.bank.create({
    data: { name, accountNumber, ifscCode, branchName, address, isActive: isActive ?? true }
  });
  res.status(201).json(bank);
});

exports.updateBank = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, accountNumber, ifscCode, branchName, address, isActive } = req.body;
  const bank = await prisma.bank.update({
    where: { id: parseInt(id) },
    data: { name, accountNumber, ifscCode, branchName, address, isActive }
  });
  res.json(bank);
});

exports.deleteBank = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.bank.delete({ where: { id: parseInt(id) } });
  res.json({ message: 'Bank deleted successfully' });
});
