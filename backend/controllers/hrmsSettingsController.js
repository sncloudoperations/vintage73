const prisma = require('../utils/prismaClient');

// Designations
exports.getDesignations = async (req, res) => {
  try {
    const designations = await prisma.designation.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(designations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createDesignation = async (req, res) => {
  const { name } = req.body;
  try {
    const existing = await prisma.designation.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ message: 'Designation already exists' });
    }
    
    const designation = await prisma.designation.create({
      data: { name }
    });
    res.status(201).json(designation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Departments
exports.getDepartments = async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(departments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createDepartment = async (req, res) => {
  const { name } = req.body;
  try {
    const existing = await prisma.department.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ message: 'Department already exists' });
    }
    
    const department = await prisma.department.create({
      data: { name }
    });
    res.status(201).json(department);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteDesignation = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.designation.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Designation deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteDepartment = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.department.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Department deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
