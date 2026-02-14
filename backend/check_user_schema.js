const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSchema() {
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'User'
    `;
    console.log('Columns in User table:', columns.map(c => c.column_name));
  } catch (err) {
    console.error('Error checking schema:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema();
