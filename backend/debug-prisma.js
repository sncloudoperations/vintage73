const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testControllerLogic() {
    console.log('--- Testing /api/company Logic ---');
    try {
        console.log('Fetching company with bank...');
        const company = await prisma.companyProfile.findFirst({
            include: { bank: true }
        });
        console.log('Fetch Success. Result exists:', !!company);

        if (!company) {
            console.log('No company found. Attempting to create default...');
            const newCompany = await prisma.companyProfile.create({
                data: {
                    companyName: 'Pillow Spot',
                    address: '',
                    city: '',
                    state: '',
                    pincode: '',
                    phone: '',
                    email: '',
                    website: '',
                    registrationNumber: '',
                    logoUrl: '',
                    currencyCode: 'INR',
                    currencySymbol: '₹',
                    country: 'India',
                    taxSystem: 'GST',
                    showOnlyLogoOnDashboard: true,
                }
            });
            console.log('Create Success:', newCompany.id);
        }
    } catch (err) {
        console.error('--- ERROR DETECTED ---');
        console.error('Code:', err.code);
        console.error('Message:', err.message);
        console.error('Meta:', err.meta);
        console.error('Stack:', err.stack);
    }

    console.log('\n--- Testing /api/auth/setup Logic ---');
    try {
        const userCount = await prisma.user.count();
        console.log('User count:', userCount);
    } catch (err) {
        console.error('User count check failed:', err.message);
    }

    await prisma.$disconnect();
}

testControllerLogic();
