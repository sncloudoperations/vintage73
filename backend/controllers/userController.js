
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

// Get all users
exports.getUsers = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      branchId: true,
      allowedModules: true,
      incentivePercentage: true,
      // imageUrl: true,
      // weeklyOff: true,
      createdAt: true,
      terminals: {
        select: { id: true, name: true, terminalCode: true }
      },
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
});

// Create new user
exports.createUser = asyncHandler(async (req, res) => {
  const {
    username, password, name, role, allowedModules, branchId, incentivePercentage,
    designation, department, joiningDate, basicSalary, labourRule, nationalId,
    employeeCode, bankName, accountNumber, ifscCode, branchName, terminalIds,
    weeklyOff
  } = req.body;

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
      incentivePercentage: parseFloat(incentivePercentage) || 0,
      // imageUrl: req.file ? '/uploads/' + req.file.filename : null,
      // weeklyOff: weeklyOff || 'Sunday',
      terminals: terminalIds && Array.isArray(terminalIds) ? { connect: terminalIds.map(id => ({ id: parseInt(id) })) } : undefined,
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
});

// Delete user
exports.deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.user.delete({ where: { id: parseInt(id) } });
  res.json({ message: 'User deleted successfully' });
});

// Update user password
exports.updatePassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: parseInt(id) },
    data: { password: hashedPassword }
  });
  res.json({ message: 'Password updated successfully' });
});

// Update user details (Role/Modules)
exports.updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name, role, allowedModules, branchId, incentivePercentage,
    designation, department, joiningDate, basicSalary, labourRule, nationalId,
    employeeCode, bankName, accountNumber, ifscCode, branchName, terminalIds,
    weeklyOff
  } = req.body;

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
      // imageUrl: req.file ? '/uploads/' + req.file.filename : undefined,
      // weeklyOff: weeklyOff,
      terminals: {
        set: terminalIds && Array.isArray(terminalIds) ? terminalIds.map(id => ({ id: parseInt(id) })) : []
      },
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
});
