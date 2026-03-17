const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

// Get All Products
exports.getAllProducts = asyncHandler(async (req, res) => {
  const { branchId: queryBranchId } = req.query;
  const user = req.user;

  // --- BRANCH ENFORCEMENT ---
  let branchId = queryBranchId;
  const isGlobalAdmin = user?.role === 'admin' && !user?.branchId;

  if (!isGlobalAdmin) {
    // Non-global admins (Branch Admin/Staff) are locked to their own branch stock
    branchId = user.branchId;
  }

  const parsedBranchId = branchId && !isNaN(parseInt(branchId)) ? parseInt(branchId) : undefined;

  const whereClause = {};

  // Visibility Rule: Only admins can see inactive products
  if (user?.role !== 'admin') {
    whereClause.isActive = true;
  }

  const products = await prisma.product.findMany({
    where: whereClause,
    include: {
      category: true,
      stocks: parsedBranchId ? {
        where: { branchId: parsedBranchId }
      } : true
    },
    orderBy: { createdAt: 'desc' }
  });

  // Map stock to a flat structure for frontend compatibility
  const formattedProducts = products.map(p => ({
    ...p,
    // If parsedBranchId is present, we only show stock for THAT branch.
    // If no stock entry exists for that branch, we default to 0.
    stock: parsedBranchId ? (p.stocks[0]?.quantity || 0) : p.stocks.reduce((acc, s) => acc + s.quantity, 0)
  }));

  res.json(formattedProducts);
});

// Create Product
exports.createProduct = asyncHandler(async (req, res) => {
  let { name, price, taxRate, taxType, taxPercent, hsnCode, warranty, description, barcode, hasBarcode, categoryName, categoryId, minDiscount, maxDiscount, isTaxInclusive } = req.body;

  // Handle Image Upload
  let imageUrl = null;
  if (req.file) {
    imageUrl = '/uploads/' + req.file.filename;
  }

  // Auto-generate barcode if missing and enabled (Check 'true' string because multipart/form-data sends strings)
  if ((hasBarcode === 'true' || hasBarcode === true) && !barcode) {
    barcode = 'BC' + Date.now().toString().slice(-10) + Math.floor(Math.random() * 1000).toString();
  }

  const priceDecimal = parseFloat(price);

  // Decide which tax field to use. Prioritize taxRate/taxPercent if it's the specific field updated, 
  // but unified across the system, taxRate is the primary source.
  const taxVal = taxPercent !== undefined ? taxPercent : (taxRate !== undefined ? taxRate : 0);
  const taxRateDecimal = parseFloat(taxVal) || 0;
  try {
    const data = {
      name,
      categoryName,
      price: !isNaN(parseFloat(price)) ? parseFloat(price) : 0,
      taxType,
      taxRate: taxRateDecimal,
      taxPercent: taxRateDecimal,
      hsnCode,
      warranty: !isNaN(parseInt(warranty)) ? parseInt(warranty) : 0,
      description,
      barcode,
      hasBarcode: (hasBarcode === 'true' || hasBarcode === true) || false,
      minDiscount: minDiscount ? parseFloat(minDiscount) : null,
      maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
      isTaxInclusive: (isTaxInclusive === 'true' || isTaxInclusive === true) || false,
      imageUrl: imageUrl,
      isActive: req.body.isActive !== undefined ? (req.body.isActive === 'true' || req.body.isActive === true) : true
    };

    if (categoryId) {
      data.category = { connect: { id: parseInt(categoryId) } };
    }

    const product = await prisma.product.create({ data });
    res.status(201).json(product);
  } catch (error) {
    if (error.code === 'P2002') {
      res.status(400);
      throw new Error('Barcode already exists');
    }
    throw error;
  }
});

// Update Product
exports.updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, price, taxRate, taxPercent, taxType, hsnCode, warranty, description, barcode, categoryName, categoryId, minDiscount, maxDiscount, isTaxInclusive, isActive } = req.body;

  const dataToUpdate = {};

  if (name !== undefined) dataToUpdate.name = name;
  if (categoryName !== undefined) dataToUpdate.categoryName = categoryName;
  if (taxType !== undefined) dataToUpdate.taxType = taxType;
  if (hsnCode !== undefined) dataToUpdate.hsnCode = hsnCode;
  if (description !== undefined) dataToUpdate.description = description;
  if (barcode !== undefined) dataToUpdate.barcode = barcode;

  if (price !== undefined && !isNaN(parseFloat(price))) {
    dataToUpdate.price = parseFloat(price);
  }

  if (taxRate !== undefined || taxPercent !== undefined) {
    const taxVal = taxRate !== undefined ? taxRate : taxPercent;
    const parsedTax = parseFloat(taxVal) || 0;
    dataToUpdate.taxRate = parsedTax;
    dataToUpdate.taxPercent = parsedTax;
  }

  if (warranty !== undefined) {
    dataToUpdate.warranty = !isNaN(parseInt(warranty)) ? parseInt(warranty) : 0;
  }

  if (minDiscount !== undefined) dataToUpdate.minDiscount = minDiscount ? parseFloat(minDiscount) : null;
  if (maxDiscount !== undefined) dataToUpdate.maxDiscount = maxDiscount ? parseFloat(maxDiscount) : null;

  if (isTaxInclusive !== undefined) {
    dataToUpdate.isTaxInclusive = (isTaxInclusive === 'true' || isTaxInclusive === true);
  }

  if (isActive !== undefined) {
    dataToUpdate.isActive = (isActive === 'true' || isActive === true);
  }

  if (categoryId !== undefined) {
    if (categoryId) {
      dataToUpdate.category = { connect: { id: parseInt(categoryId) } };
    } else {
      dataToUpdate.category = { disconnect: true };
    }
  }

  if (req.file) {
    dataToUpdate.imageUrl = '/uploads/' + req.file.filename;
  }

  const product = await prisma.product.update({
    where: { id: parseInt(id) },
    data: dataToUpdate
  });
  res.json(product);
});

// Delete Product
exports.deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.product.delete({ where: { id: parseInt(id) } });
  res.json({ message: 'Product deleted' });
});
