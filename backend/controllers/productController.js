const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

// Get All Products
exports.getAllProducts = asyncHandler(async (req, res) => {
  const { branchId: queryBranchId } = req.query;
  const user = req.user;

  // --- BRANCH ENFORCEMENT ---
  let branchId = queryBranchId;
  const isAdmin = ['ADMIN', 'OWNER', 'SUPERADMIN'].includes(user?.role?.toUpperCase());

  if (!isAdmin) {
    // Non-admins are locked to their own branch stock view
    branchId = user.branchId;
  }
  
  const parsedBranchId = branchId && !isNaN(parseInt(branchId)) ? parseInt(branchId) : undefined;

  const products = await prisma.product.findMany({
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
  const taxRateDecimal = parseFloat(taxPercent || taxRate) || 0;

  try {
    const product = await prisma.product.create({
      data: {
        name,
        categoryName,
        price: priceDecimal,
        taxType,
        taxRate: taxRateDecimal,
        taxPercent: taxRateDecimal,
        hsnCode,
        warranty: parseInt(warranty) || 0,
        description,
        barcode,
        hasBarcode: (hasBarcode === 'true' || hasBarcode === true) || false,
        minDiscount: minDiscount ? parseFloat(minDiscount) : null,
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        isTaxInclusive: (isTaxInclusive === 'true' || isTaxInclusive === true) || false,
        imageUrl: imageUrl,
        categoryId: categoryId ? parseInt(categoryId) : null // Link to Category model
      }
    });
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
  const { name, price, taxRate, taxPercent, taxType, hsnCode, warranty, description, barcode, categoryName, categoryId, minDiscount, maxDiscount, isTaxInclusive } = req.body;

  const dataToUpdate = {
    name,
    categoryName,
    categoryId: categoryId ? parseInt(categoryId) : null,
    price: parseFloat(price),
    taxRate: parseFloat(taxPercent || taxRate),
    taxPercent: parseFloat(taxPercent || taxRate),
    taxType,
    hsnCode,
    warranty: parseInt(warranty),
    description,
    barcode,
    minDiscount: minDiscount ? parseFloat(minDiscount) : null,
    maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
    isTaxInclusive: (isTaxInclusive === 'true' || isTaxInclusive === true) || false
  };

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
