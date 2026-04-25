const { PrismaClient } = require('../prisma/client');
const prisma = new PrismaClient();

async function testQuery() {
    console.log('🚀 Testing query on ReferralPayment...');
    try {
        const count = await prisma.referralPayment.count();
        console.log('✅ Success! Count:', count);
    } catch (err) {
        console.error('❌ Query Failed:', err.message);
        
        console.log('🔍 Attempting raw query with quotes...');
        try {
            const raw = await prisma.$queryRawUnsafe('SELECT count(*) FROM "ReferralPayment"');
            console.log('✅ Raw with quotes success:', raw);
        } catch (rawErr) {
            console.error('❌ Raw with quotes failed:', rawErr.message);
        }

        console.log('🔍 Attempting raw query without quotes (lowercase)...');
        try {
            const rawLower = await prisma.$queryRawUnsafe('SELECT count(*) FROM referralpayment');
            console.log('✅ Raw lowercase success:', rawLower);
        } catch (rawErr) {
            console.error('❌ Raw lowercase failed:', rawErr.message);
        }
    } finally {
        await prisma.$disconnect();
    }
}

testQuery();
