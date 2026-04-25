const { PrismaClient } = require('../prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const tables = await prisma.$queryRawUnsafe(`
            SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'
        `);
        console.log('Tables in public schema (exact case):');
        tables.forEach(t => console.log(`[${t.tablename}]`));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

check();
