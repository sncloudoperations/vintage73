const jwt = require('jsonwebtoken');


const prisma = require('../utils/prismaClient');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      console.warn('[AUTH_WARN] JWT Verification failed:', jwtErr.message);
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
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
      console.warn(`[AUTH_WARN] User not found for ID: ${decoded.userId}`);
      return res.status(401).json({ error: 'User no longer exists', code: 'USER_NOT_FOUND' });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('[AUTH_ERROR] Unexpected authentication failure:', error);
    return res.status(500).json({ error: 'Internal Authentication Error', code: 'AUTH_CRASH' });
  }
};

module.exports = authMiddleware;
