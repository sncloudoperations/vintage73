const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

exports.getStates = asyncHandler(async (req, res) => {
    const states = await prisma.state.findMany({ orderBy: { name: 'asc' } });
    res.json(states);
});

exports.createState = asyncHandler(async (req, res) => {
    const { name, code } = req.body;
    if (!name) {
        res.status(400);
        throw new Error("State name is required");
    }

    const existing = await prisma.state.findUnique({ where: { name } });
    if (existing) {
        res.status(400);
        throw new Error("State already exists");
    }

    const state = await prisma.state.create({
        data: { name, code }
    });
    res.status(201).json(state);
});

exports.updateState = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, code } = req.body;

    const state = await prisma.state.update({
        where: { id: parseInt(id) },
        data: { name, code }
    });
    res.json(state);
});

exports.deleteState = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await prisma.state.delete({ where: { id: parseInt(id) } });
    res.json({ message: "State deleted successfully" });
});
