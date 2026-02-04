const prisma = require('../utils/prismaClient');

// Get Company Profile
exports.getCompanyProfile = async (req, res) => {
  try {
    let company = await prisma.companyProfile.findFirst({
        include: { bank: true }
    });
    
    // If no company profile exists, create a default one
    if (!company) {
      console.log('No company profile found, creating default...');
      company = await prisma.companyProfile.create({
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
      console.log('Default company profile created.');
    }
    
    res.json(company);
  } catch (error) {
    console.error('Company profile fetch error:', error);
    // console.error(error.stack); // Optional: log stack trace
    res.status(500).json({ error: error.message });
  }
};

// Update Company Profile
exports.updateCompanyProfile = async (req, res) => {
  const { 
    companyName, address, city, state, pincode, phone, email, website, registrationNumber,
    currencyCode, currencySymbol, country, taxSystem, bankId
  } = req.body;
  
  let logoUrl = req.body.logoUrl;
  if (req.file) {
    logoUrl = `/uploads/${req.file.filename}`;
  }

  try {
    const company = await prisma.companyProfile.findFirst();

    const data = { 
      companyName, address, city, state, pincode, phone, email, website, registrationNumber, logoUrl,
      currencyCode: currencyCode || 'INR',
      currencySymbol: currencySymbol || '₹',
      country: country || 'India',
      taxSystem: taxSystem || 'GST',
      bankId: bankId ? parseInt(bankId) : null
    };

    if (company) {
      // Update existing
      const updated = await prisma.companyProfile.update({
        where: { id: company.id },
        data,
      });
      res.json(updated);
    } else {
      // Create new
      const newCompany = await prisma.companyProfile.create({
        data,
      });
      res.json(newCompany);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
