const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

// Get all suppliers
exports.getSuppliers = asyncHandler(async (req, res) => {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { purchases: true }
      }
    }
  });
  res.json(suppliers);
});

// Create supplier
exports.createSupplier = asyncHandler(async (req, res) => {
  const { name, phone, email, address, gstNumber, contactPerson } = req.body;
  const supplier = await prisma.supplier.create({
    data: { name, phone, email, address, gstNumber, contactPerson }
  });
  res.status(201).json(supplier);
});

// Update supplier
exports.updateSupplier = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, phone, email, address, gstNumber, contactPerson } = req.body;
  const supplier = await prisma.supplier.update({
    where: { id: parseInt(id) },
    data: { name, phone, email, address, gstNumber, contactPerson }
  });
  res.json(supplier);
});

// Delete supplier
exports.deleteSupplier = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.supplier.delete({ where: { id: parseInt(id) } });
  res.json({ message: 'Supplier deleted successfully' });
});
