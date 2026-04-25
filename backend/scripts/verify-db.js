const { PrismaClient } = require('../prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const columns = await prisma.$queryRawUnsafe(`
            SELECT column_name FROM information_schema.columns WHERE table_name = 'Lead'
        `);
        console.log('Columns in Lead table:', columns.map(c => c.column_name).join(', '));
        
        const tables = await prisma.$queryRawUnsafe(`
            SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'
        `);
        console.log('Tables in public schema:', tables.map(t => t.tablename).join(', '));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

check();
