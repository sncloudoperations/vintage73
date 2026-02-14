const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

// Get settings for a specific branch
exports.getSettings = asyncHandler(async (req, res) => {
  const { branchId } = req.params;

  if (!branchId || isNaN(parseInt(branchId))) {
      res.status(400);
      throw new Error("Invalid branch ID");
  }

  let settings = await prisma.barcodeSetting.findUnique({
    where: { branchId: parseInt(branchId) }
  });

  // Create default settings if not found
  if (!settings) {
    settings = await prisma.barcodeSetting.create({
        data: { branchId: parseInt(branchId) }
    });
  }

  res.json(settings);
});

// Update or create settings for a branch
exports.updateSettings = asyncHandler(async (req, res) => {
  const { branchId } = req.params;
  const updateData = req.body;

  if (!branchId || isNaN(parseInt(branchId))) {
      res.status(400);
      throw new Error("Invalid branch ID");
  }
  
  // Remove sensitive or read-only fields
  delete updateData.id;
  delete updateData.branchId;
  delete updateData.createdAt;
  delete updateData.updatedAt;

  const settings = await prisma.barcodeSetting.upsert({
    where: { branchId: parseInt(branchId) },
    update: updateData,
    create: { 
      ...updateData,
      branchId: parseInt(branchId) 
    }
  });
  res.json(settings);
});
