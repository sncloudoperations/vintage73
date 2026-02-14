const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

const authMiddleware = asyncHandler(async (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401);
    throw new Error('No token provided');
  }

  const token = authHeader.split(' ')[1];

  // Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (jwtErr) {
    res.status(401);
    if (jwtErr.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    }
    throw new Error('Invalid token');
  }

  // Get user from database
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      branchId: true,
      allowedModules: true
    }
  });

  if (!user) {
    res.status(401);
    throw new Error('User no longer exists');
  }

  // Attach user to request object
  req.user = user;
  next();
});

module.exports = authMiddleware;
