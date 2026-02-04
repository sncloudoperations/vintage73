const prisma = require('../utils/prismaClient');

exports.getBanks = async (req, res) => {
  try {
    const banks = await prisma.bank.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(banks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createBank = async (req, res) => {
  const { name, accountNumber, ifscCode, branchName, address, isActive } = req.body;
  try {
    const bank = await prisma.bank.create({
      data: { name, accountNumber, ifscCode, branchName, address, isActive: isActive ?? true }
    });
    res.status(201).json(bank);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateBank = async (req, res) => {
  const { id } = req.params;
  const { name, accountNumber, ifscCode, branchName, address, isActive } = req.body;
  try {
    const bank = await prisma.bank.update({
      where: { id: parseInt(id) },
      data: { name, accountNumber, ifscCode, branchName, address, isActive }
    });
    res.json(bank);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteBank = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.bank.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Bank deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
