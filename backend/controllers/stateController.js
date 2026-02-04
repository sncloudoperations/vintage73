const prisma = require('../utils/prismaClient');

const getStates = async (req, res) => {
    try {
        const states = await prisma.state.findMany({ orderBy: { name: 'asc' } });
        res.json(states);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createState = async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!name) return res.status(400).json({ error: "State name is required" });

        const existing = await prisma.state.findUnique({ where: { name } });
        if (existing) return res.status(400).json({ error: "State already exists" });

        const state = await prisma.state.create({
            data: { name, code }
        });
        res.status(201).json(state);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateState = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code } = req.body;

        const state = await prisma.state.update({
            where: { id: parseInt(id) },
            data: { name, code }
        });
        res.json(state);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteState = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.state.delete({ where: { id: parseInt(id) } });
        res.json({ message: "State deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getStates,
    createState,
    updateState,
    deleteState
};
