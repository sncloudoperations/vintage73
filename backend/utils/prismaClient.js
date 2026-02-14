const { PrismaClient } = require('@prisma/client');

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

// Health check function
prisma.$connect()
  .then(() => console.log('Database connected successfully.'))
  .catch((err) => {
    console.error('FATAL ERROR: Could not connect to database:', err.message);
    // In production, we might want to exit if DB is essential
    // But for resilience, we log and let the orchestrator/health-check handle it.
    // if (process.env.NODE_ENV === 'production') {
    //   process.exit(1);
    // }
  });

module.exports = prisma;
