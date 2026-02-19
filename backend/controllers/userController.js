
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

// Get all users
exports.getUsers = asyncHandler(async (req, res) => {
  let where = {};

  // Branch Isolation: If user is not global admin, restrict by branchId
  // Branch Isolation: If user is assigned to a branch, only show users from that branch
  if (req.user.branchId) {
    where.branchId = req.user.branchId;
  }

  const users = await prisma.user.findMany({
    where,
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

  // --- Hierarchical Validation ---
  const creatorRole = req.user.role;
  const creatorBranchId = req.user.branchId;
  const creatorModules = req.user.allowedModules || [];
  const targetRole = role || 'staff';
  const targetBranchId = branchId ? parseInt(branchId) : null;
  const targetModules = allowedModules || [];

  const isGlobalAdmin = creatorRole === 'admin' && !creatorBranchId;
  const isBranchAdmin = creatorRole === 'admin' && creatorBranchId;

  if (isBranchAdmin) {
    // Branch Admin must create users in their own branch
    if (targetBranchId !== creatorBranchId) {
      return res.status(403).json({ message: 'You can only create users for your own branch' });
    }
    // Module permissions must be a subset of creator's permissions
    const unauthorizedModules = targetModules.filter(m => !creatorModules.includes(m));
    if (unauthorizedModules.length > 0) {
      return res.status(403).json({ message: `Access denied: You cannot assign modules you don't have access to: ${unauthorizedModules.join(', ')}` });
    }
  } else if (!isGlobalAdmin) {
    // Regular staff cannot create users at all
    return res.status(403).json({ message: 'Access denied: Insufficient permissions to create users' });
  }
  // --- End Validation ---

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

  // --- Hierarchical Validation ---
  const creatorRole = req.user.role;
  const creatorBranchId = req.user.branchId;
  const creatorModules = req.user.allowedModules || [];
  const targetUser = await prisma.user.findUnique({ where: { id: parseInt(id) } });

  if (!targetUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  const isGlobalAdmin = creatorRole === 'admin' && !creatorBranchId;
  const isBranchAdmin = creatorRole === 'admin' && creatorBranchId;

  // If Branch Admin is updating
  if (isBranchAdmin) {
    // Can only update users in their own branch
    if (targetUser.branchId !== creatorBranchId) {
      return res.status(403).json({ message: 'Access denied: Cannot update users from other branches' });
    }
    // Cannot move user to another branch
    if (branchId && parseInt(branchId) !== creatorBranchId) {
      return res.status(403).json({ message: 'Branch Admin cannot change a user\'s branch' });
    }
    // Module permissions check
    if (allowedModules) {
      const unauthorizedModules = allowedModules.filter(m => !creatorModules.includes(m));
      if (unauthorizedModules.length > 0) {
        return res.status(403).json({ message: `Access denied: You cannot assign modules you don't have access to: ${unauthorizedModules.join(', ')}` });
      }
    }
  } else if (!isGlobalAdmin) {
    // Regular staff can only update themselves (if at all)
    if (parseInt(id) !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
    }
  }
  // --- End Validation ---

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
