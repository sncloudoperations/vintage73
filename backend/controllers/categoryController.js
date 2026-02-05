const prisma = require('../utils/prismaClient');

// Get All Categories
exports.getAllCategories = async (req, res) => {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { products: true }
                }
            }
        });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create Category
exports.createCategory = async (req, res) => {
    const { name, unitType } = req.body;
    try {
        const category = await prisma.category.create({
            data: { name, unitType }
        });
        res.status(201).json(category);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Category already exists' });
        }
        res.status(500).json({ error: error.message });
    }
};

// Update Category
exports.updateCategory = async (req, res) => {
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
            return res.status(400).json({ message: 'Category name already exists' });
        }
        res.status(500).json({ error: error.message });
    }
};

// Delete Category
exports.deleteCategory = async (req, res) => {
    const { id } = req.params;
    try {
        // Check if category has products
        const category = await prisma.category.findUnique({
            where: { id: parseInt(id) },
            include: { _count: { select: { products: true } } }
        });

        if (category && category._count.products > 0) {
            return res.status(400).json({ message: 'Cannot delete category with associated products' });
        }

        await prisma.category.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: 'Category deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
