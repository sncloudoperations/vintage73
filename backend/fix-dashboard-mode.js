const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDashboardMode() {
  try {
    console.log('Checking company profile...');
    const company = await prisma.companyProfile.findFirst();

    if (company) {
      console.log('Found company:', company.companyName);
      console.log('Current Mode:', company.showOnlyLogoOnDashboard);

      const updated = await prisma.companyProfile.update({
        where: { id: company.id },
        data: { showOnlyLogoOnDashboard: true }
      });

      console.log('Updated Mode to TRUE:', updated.showOnlyLogoOnDashboard);
    } else {
      console.log('No company profile found.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDashboardMode();
