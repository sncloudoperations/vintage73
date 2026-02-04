const prisma = require('../utils/prismaClient');

// Get all suppliers
exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { purchases: true }
        }
      }
    });
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create supplier
exports.createSupplier = async (req, res) => {
  const { name, phone, email, address, gstNumber, contactPerson } = req.body;
  try {
    const supplier = await prisma.supplier.create({
      data: { name, phone, email, address, gstNumber, contactPerson }
    });
    res.status(201).json(supplier);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update supplier
exports.updateSupplier = async (req, res) => {
  const { id } = req.params;
  const { name, phone, email, address, gstNumber, contactPerson } = req.body;
  try {
    const supplier = await prisma.supplier.update({
      where: { id: parseInt(id) },
      data: { name, phone, email, address, gstNumber, contactPerson }
    });
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete supplier
exports.deleteSupplier = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.supplier.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Supplier deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
