const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Attempting to fetch company profile with bank inclusion...');
        const company = await prisma.companyProfile.findFirst({
            include: { bank: true }
        });
        console.log('Fetch result:', JSON.stringify(company, null, 2));
    } catch (e) {
        console.error('Fetch failed with error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
