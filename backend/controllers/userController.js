
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
      isActive: req.body.isActive !== undefined ? req.body.isActive === 'true' || req.body.isActive === true : true,
      incentivePercentage: parseFloat(incentivePercentage) || 0,
      adminId: adminId ? parseInt(adminId) : null,
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
    weeklyOff, adminId
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
    // Module permissions check: Branch Admin can only assign modules they have access to.
    // However, they should NOT be blocked if the target user ALREADY had those modules (they are just retaining them).
    if (allowedModules && Array.isArray(allowedModules)) {
      const existingModules = Array.isArray(targetUser.allowedModules) ? targetUser.allowedModules : [];
      const addedModules = allowedModules.filter(m => !existingModules.includes(m));
      const unauthorizedModules = addedModules.filter(m => !creatorModules.includes(m));
      if (unauthorizedModules.length > 0) {
        return res.status(403).json({ message: `Access denied: You cannot assign NEW modules you don't have access to: ${unauthorizedModules.join(', ')}` });
      }
    }
  } else if (!isGlobalAdmin) {
    // Regular staff can only update themselves (if at all)
    if (parseInt(id) !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
    }
  }
  // --- End Validation ---

  // Permission Check: Only Branch Admin can toggle status
  if (req.body.isActive !== undefined && isBranchAdmin === false && isGlobalAdmin === false) {
    return res.status(403).json({ message: 'Access denied: Only Branch Admin can activate or deactivate accounts' });
  }

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

  const dataToUpdate = {};

  if (name !== undefined) dataToUpdate.name = name;
  if (role !== undefined) dataToUpdate.role = role;
  if (allowedModules !== undefined) dataToUpdate.allowedModules = allowedModules;
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
    dataToUpdate.terminals = {
      set: Array.isArray(terminalIds) ? terminalIds.map(id => ({ id: parseInt(id) })) : []
    };
  }

  // Build employeeProfile data only if any employee field is present
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

