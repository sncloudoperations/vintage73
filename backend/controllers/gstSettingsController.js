const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

// Get GST Settings (singleton - only one record)
exports.getSettings = asyncHandler(async (req, res) => {
  let settings = await prisma.gSTSettings.findFirst();
  
  if (!settings) {
    // Create default settings if not exist
    settings = await prisma.gSTSettings.create({
      data: {
        ewayBillThreshold: 50000,
        invoicePrefix: 'INV',
        challanPrefix: 'DC',
        autoGenerateEwayBill: false,
        autoGenerateEinvoice: false,
        apiMode: 'SANDBOX'
      }
    });
  }
  
  // Mask sensitive fields for security
  const maskedFields = [
    'ewayBillPassword', 
    'ewayBillClientSecret', 
    'einvoicePassword', 
    'einvoiceClientSecret'
  ];

  maskedFields.forEach(field => {
    if (settings[field]) {
      settings[field] = '********';
    }
  });
  
  res.json(settings);
});

// Update GST Settings
exports.updateSettings = asyncHandler(async (req, res) => {
  const {
    ewayBillUsername,
    ewayBillPassword,
    ewayBillClientId,
    ewayBillClientSecret,
    ewayBillThreshold,
    autoGenerateEwayBill,
    einvoiceUsername,
    einvoicePassword,
    einvoiceClientId,
    einvoiceClientSecret,
    autoGenerateEinvoice,
    gspName,
    apiMode,
    defaultPlaceOfSupply,
    invoicePrefix,
    challanPrefix,
    termsAndConditions,
    bankDetails
  } = req.body;

  // Check if settings exist
  let existing = await prisma.gSTSettings.findFirst();
  
  const data = {
    ewayBillUsername,
    ewayBillClientId,
    ewayBillThreshold: parseFloat(ewayBillThreshold) || 50000,
    autoGenerateEwayBill: autoGenerateEwayBill || false,
    einvoiceUsername,
    einvoiceClientId,
    autoGenerateEinvoice: autoGenerateEinvoice || false,
    gspName,
    apiMode,
    defaultPlaceOfSupply,
    invoicePrefix: invoicePrefix || 'INV',
    challanPrefix: challanPrefix || 'DC',
    termsAndConditions,
    bankDetails
  };

  // Masked sensitive fields handling
  const sensitiveFields = {
    ewayBillPassword: ewayBillPassword,
    ewayBillClientSecret: ewayBillClientSecret,
    einvoicePassword: einvoicePassword,
    einvoiceClientSecret: einvoiceClientSecret
  };

  Object.entries(sensitiveFields).forEach(([key, value]) => {
    if (value && value !== '********') {
      data[key] = value;
    }
  });

  let settings;
  if (existing) {
    settings = await prisma.gSTSettings.update({
      where: { id: existing.id },
      data
    });
  } else {
    settings = await prisma.gSTSettings.create({ data });
  }

  // Mask sensitive fields in response
  const maskedFields = [
    'ewayBillPassword', 
    'ewayBillClientSecret', 
    'einvoicePassword', 
    'einvoiceClientSecret'
  ];

  maskedFields.forEach(field => {
    if (settings[field]) {
      settings[field] = '********';
    }
  });

  res.json(settings);
});
