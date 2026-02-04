const prisma = require('../utils/prismaClient');
const axios = require('axios');

// Validate GSTIN format (basic validation)
const validateGSTINFormat = (gstin) => {
  // GSTIN format: 2 digit state code + 10 digit PAN + 1 entity code + 1 check digit + Z
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
};

// Extract state code from GSTIN
const getStateFromGSTIN = (gstin) => {
  const stateCodeMap = {
    '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
    '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
    '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
    '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
    '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
    '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
    '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
    '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra',
    '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa',
    '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
    '34': 'Puducherry', '35': 'Andaman & Nicobar Islands', '36': 'Telangana',
    '37': 'Andhra Pradesh (New)', '38': 'Ladakh'
  };
  const stateCode = gstin.substring(0, 2);
  return stateCodeMap[stateCode] || null;
};

// Helper to format address
const formatAddress = (addrObj) => {
  if (!addrObj) return '';
  if (typeof addrObj === 'string') return addrObj;
  
  const parts = [
    addrObj.bno, // Building number
    addrObj.bnm, // Building name
    addrObj.st,  // Street
    addrObj.loc, // Locality
    addrObj.city || addrObj.dst, // City/District
  ].filter(Boolean);
  
  return parts.join(', ');
};

// Verify GSTIN and fetch details
exports.verifyGSTIN = async (req, res) => {
  try {
    const { gstin } = req.params;
    
    if (!gstin) {
      return res.status(400).json({ error: 'GSTIN is required' });
    }

    const upperGSTIN = gstin.toUpperCase();
    
    // Basic format validation
    if (!validateGSTINFormat(upperGSTIN)) {
      return res.status(400).json({ 
        error: 'Invalid GSTIN format. Must be 15 characters (e.g., 27AAPFU0939F1ZV)',
        valid: false 
      });
    }

    const state = getStateFromGSTIN(upperGSTIN);

    // Try multiple APIs for GST verification
    let gstData = null;

    // Method 1: Try gstincheck.co.in API (free tier)
    try {
      const apiKey = process.env.GSTIN_API_KEY || 'free';
      const response = await axios.get(
        `https://sheet.gstincheck.co.in/check/${apiKey}/${upperGSTIN}`,
        { timeout: 8000 }
      );

      if (response.data && response.data.flag === true) {
        const d = response.data.data;
        gstData = {
          legalName: d.lgnm,
          tradeName: d.tradeNam || d.lgnm,
          address: formatAddress(d.pradr?.addr) || d.pradr?.adr,
          city: d.pradr?.addr?.dst || d.pradr?.addr?.loc || '',
          state: d.pradr?.addr?.stcd || state,
          pincode: d.pradr?.addr?.pncd || '',
          status: d.sts,
          taxpayerType: d.dty,
          registrationDate: d.rgdt
        };
      }
    } catch (apiError) {
      console.log('API 1 failed:', apiError.message);
    }

    // Method 2: Try alternate free API
    if (!gstData) {
      try {
        const response = await axios.get(
          `https://appyflow.in/api/verifyGST?gstNo=${upperGSTIN}&key_secret=${process.env.APPYFLOW_KEY || 'demo'}`,
          { timeout: 8000 }
        );

        if (response.data && response.data.taxpayerInfo) {
          const d = response.data.taxpayerInfo;
          gstData = {
            legalName: d.lgnm,
            tradeName: d.tradeNam || d.lgnm,
            address: d.pradr?.adr || '',
            city: d.pradr?.addr?.dst || '',
            state: d.pradr?.addr?.stcd || state,
            pincode: d.pradr?.addr?.pncd || '',
            status: d.sts,
            taxpayerType: d.dty,
            registrationDate: d.rgdt
          };
        }
      } catch (apiError) {
        console.log('API 2 failed:', apiError.message);
      }
    }

    // If APIs returned data
    if (gstData && gstData.legalName) {
      return res.json({
        valid: true,
        gstin: upperGSTIN,
        legalName: gstData.legalName,
        tradeName: gstData.tradeName,
        address: gstData.address,
        city: gstData.city,
        state: gstData.state || state,
        pincode: gstData.pincode,
        status: gstData.status,
        taxpayerType: gstData.taxpayerType,
        registrationDate: gstData.registrationDate,
        manualEntry: false
      });
    }

    // Fallback: Return validation with state info only
    // This still allows user to proceed with manual entry
    res.json({
      valid: true,
      gstin: upperGSTIN,
      state: state,
      legalName: '',
      tradeName: '',
      address: '',
      city: '',
      pincode: '',
      message: 'GSTIN format verified. State: ' + state + '. Enter business details manually or get API key for auto-fetch.',
      manualEntry: true
    });

  } catch (error) {
    console.error('GSTIN Verification Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Search GST records in database
exports.searchGSTIN = async (req, res) => {
  try {
    const { gstin } = req.query;
    
    if (!gstin || gstin.length < 3) {
      return res.json([]);
    }

    // Check if we have this GSTIN in our customer database
    const customers = await prisma.customer.findMany({
      where: {
        gstin: {
          contains: gstin.toUpperCase()
        }
      },
      select: {
        id: true,
        name: true,
        gstin: true,
        address: true,
        city: true,
        state: true,
        pincode: true
      },
      take: 10
    });

    res.json(customers);
  } catch (error) {
    console.error('Search GSTIN Error:', error);
    res.status(500).json({ error: error.message });
  }
};
