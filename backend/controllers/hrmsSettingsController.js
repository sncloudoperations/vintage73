const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

// Designations
exports.getDesignations = asyncHandler(async (req, res) => {
  const designations = await prisma.designation.findMany({
    orderBy: { name: 'asc' }
  });
  res.json(designations);
});

exports.createDesignation = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const existing = await prisma.designation.findUnique({ where: { name } });
  if (existing) {
    res.status(400);
    throw new Error('Designation already exists');
  }
  
  const designation = await prisma.designation.create({
    data: { name }
  });
  res.status(201).json(designation);
});

// Departments
exports.getDepartments = asyncHandler(async (req, res) => {
  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' }
  });
  res.json(departments);
});

exports.createDepartment = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const existing = await prisma.department.findUnique({ where: { name } });
  if (existing) {
    res.status(400);
    throw new Error('Department already exists');
  }
  
  const department = await prisma.department.create({
    data: { name }
  });
  res.status(201).json(department);
});

exports.deleteDesignation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.designation.delete({
    where: { id: parseInt(id) }
  });
  res.json({ message: 'Designation deleted successfully' });
});

exports.deleteDepartment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.department.delete({
    where: { id: parseInt(id) }
  });
  res.json({ message: 'Department deleted successfully' });
});
