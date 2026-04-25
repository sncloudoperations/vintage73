const { PrismaClient } = require('../prisma/client');
const prisma = new PrismaClient();

async function findTable() {
    console.log('🚀 Searching for ReferralPayment table across all schemas...');
    try {
        const tables = await prisma.$queryRawUnsafe(`
            SELECT schemaname, tablename 
            FROM pg_catalog.pg_tables 
            WHERE tablename ILIKE 'referralpayment' 
               OR tablename ILIKE 'referral_payment'
        `);
        console.log('Search Results:', tables);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

findTable();
