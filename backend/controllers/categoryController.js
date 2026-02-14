const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

// Get All Categories
exports.getAllCategories = asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
        orderBy: { name: 'asc' },
        include: {
            _count: {
                select: { products: true }
            }
        }
    });
    res.json(categories);
});

// Create Category
exports.createCategory = asyncHandler(async (req, res) => {
    const { name, unitType } = req.body;
    try {
        const category = await prisma.category.create({
            data: { name, unitType }
        });
        res.status(201).json(category);
    } catch (error) {
        if (error.code === 'P2002') {
            res.status(400);
            throw new Error('Category already exists');
        }
        throw error;
    }
});

// Update Category
exports.updateCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, unitType } = req.body;
    try {
        const category = await prisma.category.update({
            where: { id: parseInt(id) },
            data: { name, unitType }
        });
        res.json(category);
    } catch (error) {
        if (error.code === 'P2002') {
            res.status(400);
            throw new Error('Category name already exists');
        }
        throw error;
    }
});

// Delete Category
exports.deleteCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Check if category has products
    const category = await prisma.category.findUnique({
        where: { id: parseInt(id) },
        include: { _count: { select: { products: true } } }
    });

    if (category && category._count.products > 0) {
        res.status(400);
        throw new Error('Cannot delete category with associated products');
    }

    await prisma.category.delete({
        where: { id: parseInt(id) }
    });
    res.json({ message: 'Category deleted' });
});
