
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = require('../utils/prismaClient');

// Check if the system is already set up (has at least one user)
exports.checkSetup = async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({ isSetup: userCount > 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Initial Setup: Create Admin and Company Profile
exports.setup = async (req, res) => {
  const { username, password, name, companyName, address, phone, email } = req.body;

  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return res.status(400).json({ message: 'System already set up' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Transaction to create User and Company
    await prisma.$transaction([
      prisma.user.create({
        data: {
          username,
          name: name || 'Admin User',
          password: hashedPassword,
          role: 'admin',
          branchId: null // Admin user doesn't need branch initially
        },
      }),
      prisma.companyProfile.create({
        data: {
          companyName,
          address,
          phone,
          email,
        },
      }),
    ]);

    res.status(201).json({ message: 'Setup complete' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Login
exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { branch: true }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role, branchId: user.branchId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        branchId: user.branchId,
        branchName: user.branch?.name,
        allowedModules: user.allowedModules
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Change Password
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
