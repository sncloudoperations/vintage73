const { PrismaClient } = require('../prisma/client');
const prisma = new PrismaClient();

async function test() {
    try {
        const count = await prisma.referralPayment.count();
        console.log('Successfully connected and queried ReferralPayment table.');
        console.log('Count:', count);
    } catch (error) {
        console.error('Error querying ReferralPayment table:', error);
    } finally {
        await prisma.$disconnect();
    }
}

test();
