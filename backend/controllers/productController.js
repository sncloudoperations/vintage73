const prisma = require('../utils/prismaClient');

// Get All Products
exports.getAllProducts = async (req, res) => {
  const { branchId } = req.query;
  try {
    const products = await prisma.product.findMany({
      include: {
        stocks: branchId ? {
          where: { branchId: parseInt(branchId) }
        } : true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Map stock to a flat structure for frontend compatibility if branchId is provided
    const formattedProducts = products.map(p => ({
      ...p,
      stock: branchId ? (p.stocks[0]?.quantity || 0) : p.stocks.reduce((acc, s) => acc + s.quantity, 0)
    }));

    res.json(formattedProducts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create Product
exports.createProduct = async (req, res) => {
  try {
    let { name, price, taxRate, taxType, taxPercent, hsnCode, warranty, description, barcode, hasBarcode, categoryName, minDiscount, maxDiscount, isTaxInclusive } = req.body;
    
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
        imageUrl: imageUrl
      }
    });
    res.status(201).json(product);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Barcode already exists' });
    }
    res.status(500).json({ error: error.message });
  }
};

// Update Product
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, price, taxRate, taxPercent, taxType, hsnCode, warranty, description, barcode, categoryName, minDiscount, maxDiscount, isTaxInclusive } = req.body;
  
  try {
    const dataToUpdate = {
        name,
        categoryName,
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete Product
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.product.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
