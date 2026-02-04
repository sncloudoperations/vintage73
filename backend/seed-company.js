const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createDefaultCompanyProfile() {
  try {
    // Check if company profile already exists
    const existing = await prisma.companyProfile.findFirst();
    
    if (existing) {
      console.log('Company profile already exists:', existing);
      return;
    }

    // Create default company profile
    const company = await prisma.companyProfile.create({
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
      }
    });

    console.log('Default company profile created successfully:', company);
  } catch (error) {
    console.error('Error creating company profile:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDefaultCompanyProfile();
