const prisma = require('./config/prisma');

async function checkCompanyProfile() {
  try {
    console.log('Checking company profile...');
    
    const count = await prisma.companyProfile.count();
    console.log('Total company profiles:', count);
    
    const company = await prisma.companyProfile.findFirst();
    
    if (company) {
      console.log('Company profile found:');
      console.log(JSON.stringify(company, null, 2));
    } else {
      console.log('No company profile found in database');
    }
  } catch (error) {
    console.error('Error checking company profile:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCompanyProfile();
