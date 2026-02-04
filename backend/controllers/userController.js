
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prismaClient');

// Get all users
exports.getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        branchId: true,
        allowedModules: true,
        incentivePercentage: true,
        createdAt: true,
        employeeProfile: {
          include: {
            designation: true,
            department: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create new user
exports.createUser = async (req, res) => {
  const { 
    username, password, name, role, allowedModules, branchId, incentivePercentage,
    designation, department, joiningDate, basicSalary, labourRule, nationalId,
    employeeCode, bankName, accountNumber, ifscCode, branchName
  } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Handle Employee Code
    let finalEmployeeCode = employeeCode;
    if (!finalEmployeeCode) {
      const lastEmployee = await prisma.employeeProfile.findFirst({
        where: { employeeCode: { startsWith: 'EMP' } },
        orderBy: { employeeCode: 'desc' }
      });
      
      if (lastEmployee && lastEmployee.employeeCode) {
        const lastNum = parseInt(lastEmployee.employeeCode.replace('EMP', ''));
        finalEmployeeCode = `EMP${(lastNum + 1).toString().padStart(3, '0')}`;
      } else {
        finalEmployeeCode = 'EMP001';
      }
    }
    
    // Handle designation - either use existing ID or create new
    let designationId = null;
    if (designation) {
      if (typeof designation === 'number' || !isNaN(designation)) {
        designationId = parseInt(designation);
      } else {
        // Create new designation
        const newDesignation = await prisma.designation.upsert({
          where: { name: designation },
          update: {},
          create: { name: designation }
        });
        designationId = newDesignation.id;
      }
    }
    
    // Handle department - either use existing ID or create new
    let departmentId = null;
    if (department) {
      if (typeof department === 'number' || !isNaN(department)) {
        departmentId = parseInt(department);
      } else {
        // Create new department
        const newDepartment = await prisma.department.upsert({
          where: { name: department },
          update: {},
          create: { name: department }
        });
        departmentId = newDepartment.id;
      }
    }
    
    const user = await prisma.user.create({
      data: {
        username,
        name,
        password: hashedPassword,
        role: role || 'staff',
        allowedModules: allowedModules || [],
        branchId: branchId ? parseInt(branchId) : null,
        incentivePercentage: incentivePercentage ? parseFloat(incentivePercentage) : 0,
        employeeProfile: {
          create: {
            designationId,
            departmentId,
            employeeCode: finalEmployeeCode,
            joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
            basicSalary: basicSalary ? parseFloat(basicSalary) : 0,
            labourRule,
            nationalId,
            bankName,
            accountNumber,
            ifscCode,
            branchName
          }
        }
      }
    });

    res.status(201).json({ message: 'User created successfully', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.user.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update user password
exports.updatePassword = async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: parseInt(id) },
      data: { password: hashedPassword }
    });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update user details (Role/Modules)
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { 
    name, role, allowedModules, branchId, incentivePercentage,
    designation, department, joiningDate, basicSalary, labourRule, nationalId,
    employeeCode, bankName, accountNumber, ifscCode, branchName
  } = req.body;
  
  try {
    // Handle designation - either use existing ID or create new
    let designationId = null;
    if (designation) {
      if (typeof designation === 'number' || !isNaN(designation)) {
        designationId = parseInt(designation);
      } else {
        const newDesignation = await prisma.designation.upsert({
          where: { name: designation },
          update: {},
          create: { name: designation }
        });
        designationId = newDesignation.id;
      }
    }
    
    // Handle department - either use existing ID or create new
    let departmentId = null;
    if (department) {
      if (typeof department === 'number' || !isNaN(department)) {
        departmentId = parseInt(department);
      } else {
        const newDepartment = await prisma.department.upsert({
          where: { name: department },
          update: {},
          create: { name: department }
        });
        departmentId = newDepartment.id;
      }
    }
    
    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        name: name,
        role: role,
        allowedModules: allowedModules,
        branchId: branchId ? parseInt(branchId) : null,
        incentivePercentage: incentivePercentage ? parseFloat(incentivePercentage) : 0,
        employeeProfile: {
          upsert: {
            create: {
              designationId,
              departmentId,
              employeeCode,
              joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
              basicSalary: basicSalary ? parseFloat(basicSalary) : 0,
              labourRule,
              nationalId,
              bankName,
              accountNumber,
              ifscCode,
              branchName
            },
            update: {
              designationId,
              departmentId,
              employeeCode,
              joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
              basicSalary: basicSalary ? parseFloat(basicSalary) : 0,
              labourRule,
              nationalId,
              bankName,
              accountNumber,
              ifscCode,
              branchName
            }
          }
        }
      }
    });
    res.json({ message: 'User updated successfully', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
