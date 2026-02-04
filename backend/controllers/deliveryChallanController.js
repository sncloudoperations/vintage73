const prisma = require('../utils/prismaClient');

// Generate Challan Number
const generateChallanNumber = async (prefix = 'DC') => {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  
  const lastChallan = await prisma.deliveryChallan.findFirst({
    where: {
      challanNumber: {
        startsWith: `${prefix}-${year}${month}`
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  let sequence = 1;
  if (lastChallan) {
    const lastSeq = parseInt(lastChallan.challanNumber.split('-').pop());
    sequence = lastSeq + 1;
  }

  return `${prefix}-${year}${month}-${sequence.toString().padStart(4, '0')}`;
};

// Create Delivery Challan
exports.createChallan = async (req, res) => {
  try {
    const {
      customerId,
      challanDate,
      transportMode,
      vehicleNumber,
      transporterName,
      transporterId,
      reasonForMovement,
      placeOfSupply,
      dispatchFrom,
      dispatchTo,
      items,
      branchId
    } = req.body;

    if (!branchId) {
      return res.status(400).json({ error: 'Branch is required' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    // Get settings for prefix
    const settings = await prisma.gSTSettings.findFirst();
    const prefix = settings?.challanPrefix || 'DC';

    const challanNumber = await generateChallanNumber(prefix);

    const challan = await prisma.deliveryChallan.create({
      data: {
        challanNumber,
        customerId: customerId ? parseInt(customerId) : null,
        challanDate: challanDate ? new Date(challanDate) : new Date(),
        transportMode,
        vehicleNumber,
        transporterName,
        transporterId,
        reasonForMovement,
        placeOfSupply,
        dispatchFrom,
        dispatchTo,
        branchId: parseInt(branchId),
        items: {
          create: items.map(item => ({
            productId: parseInt(item.productId),
            quantity: parseInt(item.quantity),
            hsnCode: item.hsnCode || null,
            description: item.description || null
          }))
        }
      },
      include: {
        customer: true,
        branch: true,
        items: {
          include: { product: true }
        }
      }
    });

    res.status(201).json(challan);
  } catch (error) {
    console.error('Create Challan Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get All Challans
exports.getAllChallans = async (req, res) => {
  try {
    const { branchId, status, startDate, endDate } = req.query;
    
    const where = {};
    if (branchId) where.branchId = parseInt(branchId);
    if (status) where.status = status;
    if (startDate && endDate) {
      where.challanDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const challans = await prisma.deliveryChallan.findMany({
      where,
      include: {
        customer: true,
        branch: true,
        items: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(challans);
  } catch (error) {
    console.error('Get Challans Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get Single Challan
exports.getChallan = async (req, res) => {
  try {
    const { id } = req.params;
    
    const challan = await prisma.deliveryChallan.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: true,
        branch: true,
        items: {
          include: { product: true }
        }
      }
    });

    if (!challan) {
      return res.status(404).json({ error: 'Challan not found' });
    }

    res.json(challan);
  } catch (error) {
    console.error('Get Challan Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update Challan Status
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, ewayBillNumber, ewayBillDate } = req.body;

    const data = { status };
    if (ewayBillNumber) {
      data.ewayBillNumber = ewayBillNumber;
      data.ewayBillDate = ewayBillDate ? new Date(ewayBillDate) : new Date();
    }

    const challan = await prisma.deliveryChallan.update({
      where: { id: parseInt(id) },
      data,
      include: {
        customer: true,
        items: { include: { product: true } }
      }
    });

    res.json(challan);
  } catch (error) {
    console.error('Update Challan Status Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get Challan for Print
exports.getChallanForPrint = async (req, res) => {
  try {
    const { id } = req.params;
    
    const challan = await prisma.deliveryChallan.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: true,
        branch: true,
        items: {
          include: { product: true }
        }
      }
    });

    if (!challan) {
      return res.status(404).json({ error: 'Challan not found' });
    }

    // Get company profile for header
    const company = await prisma.companyProfile.findFirst();

    res.json({
      challan,
      company
    });
  } catch (error) {
    console.error('Get Challan for Print Error:', error);
    res.status(500).json({ error: error.message });
  }
};
