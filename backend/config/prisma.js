const { PrismaClient } = require('@prisma/client');

// Prevent multiple instances of Prisma Client in development
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
  });
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }
  prisma = global.prisma;
}

// Connection test
prisma.$connect()
    .then(() => console.log('✅ [DB] Database connected successfully'))
    .catch((err) => {
        console.error('❌ [DB] Connection Failed:', err.message);
        // We do NOT exit here to allow retry logic or health checks to fail gracefully
    });

module.exports = prisma;
