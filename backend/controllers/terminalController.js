const prisma = require('../utils/prismaClient');

// Get all terminals
exports.getTerminals = async (req, res) => {
    try {
        const terminals = await prisma.terminal.findMany({
            include: {
                branch: true,
                users: {
                    select: { id: true, username: true, name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(terminals);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create/Register a terminal
exports.registerTerminal = async (req, res) => {
    const { terminalCode, name, branchId, isManual = false } = req.body;
    try {
        // If branchId is provided, check for duplicate name in that branch
        if (branchId && name) {
            const existing = await prisma.terminal.findFirst({
                where: {
                    name,
                    branchId: parseInt(branchId)
                }
            });
            if (existing) {
                return res.status(400).json({ message: `Terminal with name "${name}" already exists in this branch.` });
            }
        }

        const terminal = await prisma.terminal.create({
            data: {
                terminalCode: terminalCode || require('crypto').randomUUID(),
                name: name || 'New Terminal',
                branchId: branchId ? parseInt(branchId) : null,
                isActive: isManual // If manual, maybe default to active? Or keep false?
            }
        });
        res.status(201).json(terminal);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Bulk create terminals
exports.bulkCreateTerminals = async (req, res) => {
    const { branchId, names } = req.body;
    if (!branchId || !names || !Array.isArray(names)) {
        return res.status(400).json({ message: 'branchId and an array of names are required.' });
    }

    try {
        const results = {
            created: [],
            skipped: [],
            errors: []
        };

        for (const name of names) {
            try {
                const existing = await prisma.terminal.findFirst({
                    where: {
                        name,
                        branchId: parseInt(branchId)
                    }
                });

                if (existing) {
                    results.skipped.push({ name, reason: 'Duplicate name in branch' });
                    continue;
                }

                const terminal = await prisma.terminal.create({
                    data: {
                        terminalCode: require('crypto').randomUUID(),
                        name,
                        branchId: parseInt(branchId),
                        isActive: true // Bulk created terminals are likely intended to be used immediately
                    }
                });
                results.created.push(terminal);
            } catch (err) {
                results.errors.push({ name, error: err.message });
            }
        }

        res.json(results);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update terminal (Approve/Deactivate/Rename/Link User)
exports.updateTerminal = async (req, res) => {
    const { id } = req.params;
    const { name, branchId, isActive, userIds } = req.body;
    try {
        const terminal = await prisma.terminal.update({
            where: { id: parseInt(id) },
            data: {
                name,
                branchId: branchId ? parseInt(branchId) : null,
                isActive,
                users: userIds && Array.isArray(userIds) ? { set: userIds.map(id => ({ id: parseInt(id) })) } : undefined
            }
        });
        res.json(terminal);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete terminal
exports.deleteTerminal = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.terminal.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: 'Terminal deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get terminal lock setting
exports.getSettings = async (req, res) => {
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: 'TERMINAL_LOCK' }
        });
        res.json({ terminalLock: setting ? setting.value === 'true' : false });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update terminal lock setting
exports.updateSettings = async (req, res) => {
    const { terminalLock } = req.body;
    try {
        const setting = await prisma.systemSetting.upsert({
            where: { key: 'TERMINAL_LOCK' },
            update: { value: terminalLock.toString() },
            create: {
                key: 'TERMINAL_LOCK',
                value: terminalLock.toString(),
                description: 'Enable/Disable device-based access control',
                category: 'SECURITY'
            }
        });
        res.json({ terminalLock: setting.value === 'true' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Check if a terminal is authorized
exports.checkTerminal = async (req, res) => {
    const { terminalCode } = req.query;
    if (!terminalCode) return res.status(400).json({ message: 'Terminal code required' });

    try {
        const terminal = await prisma.terminal.findUnique({
            where: { terminalCode }
        });

        if (!terminal) {
            return res.json({ authorized: false, registered: false });
        }

        // Update last used
        await prisma.terminal.update({
            where: { id: terminal.id },
            data: { lastUsed: new Date(), ipAddress: req.ip }
        });

        res.json({
            authorized: terminal.isActive,
            registered: true,
            terminal: {
                name: terminal.name,
                branchId: terminal.branchId
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
