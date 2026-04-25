const { PrismaClient } = require('../prisma/client');
const prisma = new PrismaClient();

async function testUser() {
    console.log('🚀 Testing query on User...');
    try {
        const count = await prisma.user.count();
        console.log('✅ Success! Count:', count);
    } catch (err) {
        console.error('❌ Query Failed:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

testUser();
