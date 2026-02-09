const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'CompanyProfile'
      AND table_schema = 'public'
    `;
        console.log('Columns found:', columns.map(c => c.column_name));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
