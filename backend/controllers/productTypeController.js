const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get All Product Types (with optional category filter)
// @route   GET /api/product-types
// @access  Private
exports.getAllProductTypes = asyncHandler(async (req, res) => {
    const { categoryId, activeOnly } = req.query;

    const whereClause = {};

    if (categoryId) {
        whereClause.categoryId = parseInt(categoryId);
    }

    if (activeOnly === 'true') {
        whereClause.isActive = true;
    }

    const productTypes = await prisma.productType.findMany({
        where: whereClause,
        include: {
            category: true,
            _count: {
                select: { products: true }
            }
        },
        orderBy: { name: 'asc' }
    });

    res.json(productTypes);
});

// @desc    Get Single Product Type
// @route   GET /api/product-types/:id
// @access  Private
exports.getProductTypeById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const productType = await prisma.productType.findUnique({
        where: { id: parseInt(id) },
        include: {
            category: true,
            _count: {
                select: { products: true }
            }
        }
    });

    if (!productType) {
        res.status(404);
        throw new Error('Product Type not found');
    }

    res.json(productType);
});

// @desc    Create Product Type
// @route   POST /api/product-types
// @access  Private
exports.createProductType = asyncHandler(async (req, res) => {
    const { name, categoryId, genders, attributes, sizes, isActive } = req.body;

    if (!name || !categoryId) {
        res.status(400);
        throw new Error('Product Type name and category are required');
    }

    const parsedCategoryId = parseInt(categoryId);
    const categoryExists = await prisma.category.findUnique({
        where: { id: parsedCategoryId }
    });

    if (!categoryExists) {
        res.status(400);
        throw new Error('Selected category does not exist');
    }

    try {
        const productType = await prisma.productType.create({
            data: {
                name: name.trim(),
                categoryId: parsedCategoryId,
                genders: Array.isArray(genders) ? genders : [],
                attributes: Array.isArray(attributes) ? attributes : [],
                sizes: Array.isArray(sizes) ? sizes : [],
                isActive: isActive !== undefined ? Boolean(isActive) : true
            },
            include: {
                category: true,
                _count: {
                    select: { products: true }
                }
            }
        });

        res.status(201).json(productType);
    } catch (error) {
        if (error.code === 'P2002') {
            res.status(400);
            throw new Error('Product Type already exists for this category');
        }
        throw error;
    }
});

// @desc    Update Product Type
// @route   PUT /api/product-types/:id
// @access  Private
exports.updateProductType = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, categoryId, genders, attributes, sizes, isActive } = req.body;

    const parsedId = parseInt(id);
    const existing = await prisma.productType.findUnique({
        where: { id: parsedId }
    });

    if (!existing) {
        res.status(404);
        throw new Error('Product Type not found');
    }

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name.trim();
    if (categoryId !== undefined) dataToUpdate.categoryId = parseInt(categoryId);
    if (genders !== undefined) dataToUpdate.genders = Array.isArray(genders) ? genders : [];
    if (attributes !== undefined) dataToUpdate.attributes = Array.isArray(attributes) ? attributes : [];
    if (sizes !== undefined) dataToUpdate.sizes = Array.isArray(sizes) ? sizes : [];
    if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);

    try {
        const updated = await prisma.productType.update({
            where: { id: parsedId },
            data: dataToUpdate,
            include: {
                category: true,
                _count: {
                    select: { products: true }
                }
            }
        });

        res.json(updated);
    } catch (error) {
        if (error.code === 'P2002') {
            res.status(400);
            throw new Error('Product Type name already exists for this category');
        }
        throw error;
    }
});

// @desc    Delete Product Type
// @route   DELETE /api/product-types/:id
// @access  Private
exports.deleteProductType = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const parsedId = parseInt(id);

    const productType = await prisma.productType.findUnique({
        where: { id: parsedId },
        include: { _count: { select: { products: true } } }
    });

    if (!productType) {
        res.status(404);
        throw new Error('Product Type not found');
    }

    if (productType._count.products > 0) {
        res.status(400);
        throw new Error('Cannot delete product type with associated products');
    }

    await prisma.productType.delete({
        where: { id: parsedId }
    });

    res.json({ message: 'Product Type deleted successfully' });
});
