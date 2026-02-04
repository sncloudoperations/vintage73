const prisma = require('../utils/prismaClient');

// Get settings for a specific branch
exports.getSettings = async (req, res) => {
  const { branchId } = req.params;
  console.log(`[getSettings] Request for branchId: ${branchId}`);

  if (!branchId || isNaN(parseInt(branchId))) {
      console.error("[getSettings] Invalid branchId");
      return res.status(400).json({ error: "Invalid branch ID" });
  }

  try {
    let settings = await prisma.barcodeSetting.findUnique({
      where: { branchId: parseInt(branchId) }
    });

    console.log(`[getSettings] Found settings:`, settings);

    // Create default settings if not found
    if (!settings) {
      console.log(`[getSettings] Creating default settings for branchId: ${branchId}`);
      try {
        settings = await prisma.barcodeSetting.create({
            data: { branchId: parseInt(branchId) }
        });
        console.log(`[getSettings] Created default settings:`, settings);
      } catch (createError) {
        console.error(`[getSettings] Error creating default settings:`, createError);
        // Potentially a race condition or constraint violation?
        throw createError;
      }
    }

    res.json(settings);
  } catch (error) {
    console.error(`[getSettings] FATAL ERROR:`, error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
};

// Update or create settings for a branch
exports.updateSettings = async (req, res) => {
  const { branchId } = req.params;
  const updateData = req.body;
  console.log(`[updateSettings] Request for branchId: ${branchId}`, updateData);

  if (!branchId || isNaN(parseInt(branchId))) {
      console.error("[updateSettings] Invalid branchId");
      return res.status(400).json({ error: "Invalid branch ID" });
  }
  
  // Remove sensitive or read-only fields
  delete updateData.id;
  delete updateData.branchId;
  delete updateData.createdAt;
  delete updateData.updatedAt;

  try {
    const settings = await prisma.barcodeSetting.upsert({
      where: { branchId: parseInt(branchId) },
      update: updateData,
      create: { 
        ...updateData,
        branchId: parseInt(branchId) 
      }
    });
    console.log(`[updateSettings] Updated settings:`, settings);
    res.json(settings);
  } catch (error) {
    console.error(`[updateSettings] FATAL ERROR:`, error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
};
