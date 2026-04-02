
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

// Get all users
exports.getUsers = asyncHandler(async (req, res) => {
  let where = {};

  // Branch Isolation: Restrict to branch if assigned
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
      isActive: true,
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

// Get single user by ID
exports.getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUnique({
    where: { id: parseInt(id) },
    include: {
      terminals: {
        select: { id: true, name: true, terminalCode: true }
      },
      employeeProfile: {
        include: {
          designation: true,
          department: true
        }
      }
    }
  });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Remove password from response
  const { password, ...userWithoutPassword } = user;
  
  console.log(`[GET USER] Fetched ID ${id}:`, JSON.stringify(userWithoutPassword, null, 2));
  
  res.json(userWithoutPassword);
});

// Create new user
exports.createUser = asyncHandler(async (req, res) => {
  const {
    username, password, name, role, allowedModules, branchId, incentivePercentage,
    designation, department, joiningDate, basicSalary, labourRule, nationalId,
    employeeCode, bankName, accountNumber, ifscCode, branchName, terminalIds,
    weeklyOff, adminId
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
  const targetBranchId = branchId ? parseInt(branchId) : null;
  const targetModules = allowedModules || [];

  const isGlobalAdmin = creatorRole === 'admin' && !creatorBranchId;
  const isBranchAdmin = creatorRole === 'admin' && creatorBranchId;

  if (isBranchAdmin) {
    if (targetBranchId !== creatorBranchId) {
      return res.status(403).json({ message: 'You can only create users for your own branch' });
    }
    const unauthorizedModules = targetModules.filter(m => !creatorModules.includes(m));
    if (unauthorizedModules.length > 0) {
      return res.status(403).json({ message: `Access denied: You cannot assign modules you don't have access to: ${unauthorizedModules.join(', ')}` });
    }
  } else if (!isGlobalAdmin) {
    return res.status(403).json({ message: 'Access denied: Insufficient permissions to create users' });
  }
  // --- End Validation ---

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

  const user = await prisma.user.create({
    data: {
      username,
      name,
      password: hashedPassword,
      role: role || 'staff',
      allowedModules: allowedModules || [],
      branchId: branchId ? parseInt(branchId) : null,
      isActive: req.body.isActive !== undefined ? req.body.isActive === 'true' || req.body.isActive === true : true,
      incentivePercentage: parseFloat(incentivePercentage) || 0,
      adminId: adminId ? parseInt(adminId) : null,
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
    weeklyOff, adminId, password, username
  } = req.body;

  // --- Hierarchical Validation (TEMPORARILY BYPASSED) ---
  const creatorRole = req.user.role;
  const creatorBranchId = req.user.branchId;
  const creatorModules = req.user.allowedModules || [];
  const targetUser = await prisma.user.findUnique({ where: { id: parseInt(id) } });

  if (!targetUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  /*
  const isGlobalAdmin = creatorRole === 'admin' && !creatorBranchId;
  const isBranchAdmin = creatorRole === 'admin' && creatorBranchId;

  if (isBranchAdmin) {
    // ...
  } else if (!isGlobalAdmin) {
    // ...
  }
  
  if (req.body.isActive !== undefined && isBranchAdmin === false && isGlobalAdmin === false) {
    // ...
  }
  */
  // --- End Validation ---

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

  const dataToUpdate = {};
  if (name !== undefined) dataToUpdate.name = name;
  if (username !== undefined) dataToUpdate.username = username;
  if (role !== undefined) dataToUpdate.role = role;
  if (weeklyOff !== undefined) dataToUpdate.weeklyOff = weeklyOff;
  
  if (req.file) {
    dataToUpdate.imageUrl = `/uploads/${req.file.filename}`;
  }
  
  if (allowedModules !== undefined) {
    if (typeof allowedModules === 'string') {
      dataToUpdate.allowedModules = [allowedModules];
    } else if (Array.isArray(allowedModules)) {
      dataToUpdate.allowedModules = allowedModules;
    }
  }

  if (branchId !== undefined) dataToUpdate.branchId = branchId ? parseInt(branchId) : null;
  if (incentivePercentage !== undefined) {
    dataToUpdate.incentivePercentage = !isNaN(parseFloat(incentivePercentage)) ? parseFloat(incentivePercentage) : 0;
  }
  if (adminId !== undefined) {
    dataToUpdate.adminId = adminId ? parseInt(adminId) : null;
  }
  if (req.body.isActive !== undefined) {
    dataToUpdate.isActive = (req.body.isActive === 'true' || req.body.isActive === true);
  }
  if (terminalIds !== undefined) {
    let tIds = [];
    if (typeof terminalIds === 'string' && terminalIds.trim() !== '') {
      tIds = [parseInt(terminalIds)];
    } else if (Array.isArray(terminalIds)) {
      tIds = terminalIds.map(id => parseInt(id)).filter(id => !isNaN(id));
    }
    dataToUpdate.terminals = {
      set: tIds.map(id => ({ id }))
    };
  }

  // Handle Password Update if provided
  if (password && password.trim() !== '') {
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    dataToUpdate.password = await bcrypt.hash(password, 10);
  }

  const employeeFields = [designation, department, joiningDate, basicSalary, labourRule, nationalId, employeeCode, bankName, accountNumber, ifscCode, branchName];
  if (employeeFields.some(f => f !== undefined)) {
    const employeeData = {};
    if (designationId !== undefined) employeeData.designationId = designationId;
    if (departmentId !== undefined) employeeData.departmentId = departmentId;
    if (employeeCode !== undefined) employeeData.employeeCode = employeeCode;
    if (joiningDate !== undefined) employeeData.joiningDate = joiningDate ? new Date(joiningDate) : new Date();
    if (basicSalary !== undefined) employeeData.basicSalary = !isNaN(parseFloat(basicSalary)) ? parseFloat(basicSalary) : 0;
    if (labourRule !== undefined) employeeData.labourRule = labourRule;
    if (nationalId !== undefined) employeeData.nationalId = nationalId;
    if (bankName !== undefined) employeeData.bankName = bankName;
    if (accountNumber !== undefined) employeeData.accountNumber = accountNumber;
    if (ifscCode !== undefined) employeeData.ifscCode = ifscCode;
    if (branchName !== undefined) employeeData.branchName = branchName;

    dataToUpdate.employeeProfile = {
      upsert: {
        create: employeeData,
        update: employeeData
      }
    };
  }

  console.log('[UPDATE USER] Updating ID:', id, 'Data:', JSON.stringify(dataToUpdate, null, 2));

  const user = await prisma.user.update({
    where: { id: parseInt(id) },
    data: dataToUpdate
  });
  res.json({ message: 'User updated successfully', user });
});

// Get admins by branch (for admin assignment dropdown)
exports.getAdminsByBranch = asyncHandler(async (req, res) => {
  const { branchId } = req.query;
  const where = { role: 'admin' };
  if (branchId) {
    where.branchId = parseInt(branchId);
  }
  const admins = await prisma.user.findMany({
    where,
    select: { id: true, name: true, username: true, branchId: true },
    orderBy: { name: 'asc' }
  });
  res.json(admins);
});

// Get staff by branch (for ticket assignment dropdown)
exports.getStaffByBranch = asyncHandler(async (req, res) => {
  const { branchId } = req.query;
  const where = { role: 'staff' };
  if (branchId) {
    where.branchId = parseInt(branchId);
  }
  const staff = await prisma.user.findMany({
    where,
    select: { id: true, name: true, username: true, branchId: true },
    orderBy: { name: 'asc' }
  });
  res.json(staff);
});
