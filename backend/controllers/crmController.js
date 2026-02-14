const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

// Leads
exports.createLead = asyncHandler(async (req, res) => {
    const { name, company, email, phone, source, assignedTo, notes } = req.body;
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
    res.status(201).json(lead);
});

exports.getLeads = asyncHandler(async (req, res) => {
    const leads = await prisma.lead.findMany({
        include: { assignedUser: { select: { name: true, username: true } } },
        orderBy: { createdAt: 'desc' }
    });
    res.json(leads);
});

exports.updateLead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const lead = await prisma.lead.update({
        where: { id: parseInt(id) },
        data: {
            ...data,
            assignedTo: data.assignedTo ? parseInt(data.assignedTo) : undefined
        }
    });
    res.json(lead);
});

exports.deleteLead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await prisma.lead.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Lead deleted' });
});

// Deals
exports.createDeal = asyncHandler(async (req, res) => {
    const { title, value, leadId, assignedTo, stage } = req.body;
    const deal = await prisma.deal.create({
        data: {
            title,
            value: parseFloat(value),
            leadId: leadId ? parseInt(leadId) : null,
            assignedTo: assignedTo ? parseInt(assignedTo) : null,
            stage: stage || 'PROSPECTING'
        }
    });
    res.status(201).json(deal);
});

exports.getDeals = asyncHandler(async (req, res) => {
    const deals = await prisma.deal.findMany({
        include: { 
            lead: true,
            assignedUser: { select: { name: true, username: true } } 
        },
        orderBy: { createdAt: 'desc' }
    });
    res.json(deals);
});

exports.updateDeal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = req.body;
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
});

exports.deleteDeal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await prisma.deal.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Deal deleted' });
});

// Tasks
exports.createTask = asyncHandler(async (req, res) => {
    const { title, dueDate, priority, description, leadId, dealId, assignedTo } = req.body;
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
    res.status(201).json(task);
});

exports.getTasks = asyncHandler(async (req, res) => {
    const tasks = await prisma.cRMTask.findMany({
        include: {
            lead: { select: { name: true } },
            deal: { select: { title: true } },
            assignedUser: { select: { name: true, username: true } }
        },
        orderBy: { dueDate: 'asc' }
    });
    res.json(tasks);
});

exports.updateTask = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const task = await prisma.cRMTask.update({
        where: { id: parseInt(id) },
        data: {
            ...data,
            dueDate: data.dueDate ? new Date(data.dueDate) : undefined
        }
    });
    res.json(task);
});

exports.getDashboardStats = asyncHandler(async (req, res) => {
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
});
