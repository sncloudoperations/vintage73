const prisma = require('../utils/prismaClient');

// Leads
exports.createLead = async (req, res) => {
    const { name, company, email, phone, source, assignedTo, notes } = req.body;
    try {
        const lead = await prisma.lead.create({
            data: {
                name,
                company,
                email,
                phone,
                source,
                assignedTo: assignedTo ? parseInt(assignedTo) : null,
                notes,
                status: 'NEW'
            }
        });
        res.json(lead);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getLeads = async (req, res) => {
    try {
        const leads = await prisma.lead.findMany({
            include: { assignedUser: { select: { name: true, username: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(leads);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateLead = async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    try {
        const lead = await prisma.lead.update({
            where: { id: parseInt(id) },
            data: {
                ...data,
                assignedTo: data.assignedTo ? parseInt(data.assignedTo) : undefined
            }
        });
        res.json(lead);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteLead = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.lead.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Lead deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Deals
exports.createDeal = async (req, res) => {
    const { title, value, leadId, assignedTo, stage } = req.body;
    try {
        const deal = await prisma.deal.create({
            data: {
                title,
                value: parseFloat(value),
                leadId: leadId ? parseInt(leadId) : null,
                assignedTo: assignedTo ? parseInt(assignedTo) : null,
                stage: stage || 'PROSPECTING'
            }
        });
        res.json(deal);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getDeals = async (req, res) => {
    try {
        const deals = await prisma.deal.findMany({
            include: { 
                lead: true,
                assignedUser: { select: { name: true, username: true } } 
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(deals);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateDeal = async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    try {
        const deal = await prisma.deal.update({
            where: { id: parseInt(id) },
            data: {
                ...data,
                value: data.value ? parseFloat(data.value) : undefined,
                leadId: data.leadId ? parseInt(data.leadId) : undefined,
                assignedTo: data.assignedTo ? parseInt(data.assignedTo) : undefined,
                probability: data.probability ? parseInt(data.probability) : undefined
            }
        });
        res.json(deal);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteDeal = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.deal.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Deal deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Tasks
exports.createTask = async (req, res) => {
    const { title, dueDate, priority, description, leadId, dealId, assignedTo } = req.body;
    try {
        const task = await prisma.cRMTask.create({
            data: {
                title,
                dueDate: dueDate ? new Date(dueDate) : null,
                priority: priority || 'MEDIUM',
                description,
                leadId: leadId ? parseInt(leadId) : null,
                dealId: dealId ? parseInt(dealId) : null,
                assignedTo: assignedTo ? parseInt(assignedTo) : null
            }
        });
        res.json(task);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getTasks = async (req, res) => {
    try {
        const tasks = await prisma.cRMTask.findMany({
            include: {
                lead: { select: { name: true } },
                deal: { select: { title: true } },
                assignedUser: { select: { name: true, username: true } }
            },
            orderBy: { dueDate: 'asc' }
        });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateTask = async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    try {
        const task = await prisma.cRMTask.update({
            where: { id: parseInt(id) },
            data: {
                ...data,
                dueDate: data.dueDate ? new Date(data.dueDate) : undefined
            }
        });
        res.json(task);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        const [totalLeads, newLeads, pipelines] = await Promise.all([
            prisma.lead.count(),
            prisma.lead.count({ where: { status: 'NEW' } }),
            prisma.deal.findMany()
        ]);

        const totalPipelineValue = pipelines.reduce((sum, deal) => sum + Number(deal.value), 0);
        
        // Group deals by stage
        const dealStages = pipelines.reduce((acc, deal) => {
            acc[deal.stage] = (acc[deal.stage] || 0) + 1;
            return acc;
        }, {});

        res.json({
            totalLeads,
            newLeads,
            totalPipelineValue,
            dealStages
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
