const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

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
exports.createChallan = asyncHandler(async (req, res) => {
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
    res.status(400);
    throw new Error('Branch is required');
  }

  if (!items || items.length === 0) {
    res.status(400);
    throw new Error('At least one item is required');
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
});

// Get All Challans
exports.getAllChallans = asyncHandler(async (req, res) => {
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
});

// Get Single Challan
exports.getChallan = asyncHandler(async (req, res) => {
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
    res.status(404);
    throw new Error('Challan not found');
  }

  res.json(challan);
});

// Update Challan Status
exports.updateStatus = asyncHandler(async (req, res) => {
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
});

// Get Challan for Print
exports.getChallanForPrint = asyncHandler(async (req, res) => {
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
    res.status(404);
    throw new Error('Challan not found');
  }

  // Get company profile for header
  const company = await prisma.companyProfile.findFirst();

  res.json({
    challan,
    company
  });
});
