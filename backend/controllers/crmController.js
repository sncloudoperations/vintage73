const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

// Leads
exports.createLead = asyncHandler(async (req, res) => {
    const { name, email, phone, address, source, productId, quantity, budget, assignedTo, notes, priority } = req.body;

    // Normalize data (Convert empty strings from form to null for unique fields)
    const normalizedPhone = phone && phone.trim() !== '' ? phone.trim() : null;
    const normalizedEmail = email && email.trim() !== '' ? email.trim() : null;

    // Duplicate check based on normalized phone
    if (normalizedPhone) {
        const existing = await prisma.lead.findUnique({ where: { phone: normalizedPhone } });
        if (existing) {
            res.status(400);
            throw new Error(`A lead with phone number ${normalizedPhone} already exists.`);
        }
    }


    const parsedProductId = productId ? parseInt(productId) : null;
    const parsedQuantity = quantity ? parseInt(quantity) : null;
    const parsedBudget = budget ? parseFloat(budget) : null;
    const parsedAssignedTo = assignedTo ? parseInt(assignedTo) : null;

    try {
        const lead = await prisma.lead.create({
            data: {
                name: name ? name.trim() : '',
                email: normalizedEmail,
                phone: normalizedPhone,
                address,
                source,
                productId: isNaN(parsedProductId) ? null : parsedProductId,
                quantity: isNaN(parsedQuantity) ? null : parsedQuantity,
                budget: isNaN(parsedBudget) ? null : parsedBudget,
                assignedTo: isNaN(parsedAssignedTo) ? null : parsedAssignedTo,
                notes,
                priority: priority || 'MEDIUM',
                status: 'NEW'
            }
        });

        // Log Activity
        await prisma.leadActivity.create({
            data: {
                leadId: lead.id,
                type: 'NOTE',
                description: 'Lead created'
            }
        });

        res.status(201).json(lead);
    } catch (error) {
        console.error('❌ PRISMA CREATE LEAD ERROR:', error);
        throw error; // Let the global handler send the response
    }
});


exports.getLeads = asyncHandler(async (req, res) => {
    const { search, status, assignedTo, fromDate, toDate } = req.query;

    const where = {};
    if (search && search.trim() !== '') {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } }
        ];
    }
    
    if (status && status !== '') where.status = status;
    
    const assignedId = parseInt(assignedTo);
    if (!isNaN(assignedId)) where.assignedTo = assignedId;

    if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate && !isNaN(new Date(fromDate).getTime())) {
            where.createdAt.gte = new Date(fromDate);
        }
        if (toDate && !isNaN(new Date(toDate).getTime())) {
            where.createdAt.lte = new Date(toDate);
        }
        // Cleanup if no valid dates were added
        if (Object.keys(where.createdAt).length === 0) delete where.createdAt;
    }



    const leads = await prisma.lead.findMany({
        where,
        include: { 
            assignedUser: { select: { name: true, username: true } },
            product: { select: { name: true, price: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    res.json(leads);
});

exports.getLeadById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const leadId = parseInt(id);

    if (isNaN(leadId)) {
        res.status(400);
        throw new Error('Invalid Lead ID');
    }

    const lead = await prisma.lead.findUnique({
        where: { id: leadId },

        include: {
            assignedUser: { select: { name: true, username: true } },
            product: true,
            activities: { orderBy: { createdAt: 'desc' } },
            followUps: { orderBy: { date: 'asc' } },
            quotation: true,
            sale: true
        }
    });
    if (!lead) {
        res.status(404);
        throw new Error('Lead not found');
    }
    res.json(lead);
});
exports.updateLead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const leadId = parseInt(id);
    if (isNaN(leadId)) {
        res.status(400);
        throw new Error('Invalid Lead ID');
    }

    const data = req.body;
    const lead = await prisma.lead.update({
        where: { id: leadId },
        data: {
            ...data,
            assignedTo: data.assignedTo && !isNaN(parseInt(data.assignedTo)) ? parseInt(data.assignedTo) : undefined,
            productId: data.productId && !isNaN(parseInt(data.productId)) ? parseInt(data.productId) : undefined,
            quantity: data.quantity && !isNaN(parseInt(data.quantity)) ? parseInt(data.quantity) : undefined,
            budget: data.budget && !isNaN(parseFloat(data.budget)) ? parseFloat(data.budget) : undefined
        }
    });

    res.json(lead);
});

exports.updateLeadStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const leadId = parseInt(id);
    if (isNaN(leadId)) {
        res.status(400);
        throw new Error('Invalid Lead ID');
    }

    const { status, notes } = req.body;

    const oldLead = await prisma.lead.findUnique({ where: { id: leadId } });

    const lead = await prisma.lead.update({
        where: { id: leadId },
        data: { status }
    });



    // Log Activity
    await prisma.leadActivity.create({
        data: {
            leadId: lead.id,
            type: 'STATUS_CHANGE',
            description: `Status changed from ${oldLead.status} to ${status}. ${notes || ''}`
        }
    });

    res.json(lead);
});

exports.deleteLead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const leadId = parseInt(id);
    if (isNaN(leadId)) {
        res.status(400);
        throw new Error('Invalid Lead ID');
    }
    await prisma.lead.delete({ where: { id: leadId } });

    res.json({ message: 'Lead deleted' });
});

exports.addLeadActivity = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { type, description } = req.body;

    const leadId = parseInt(id);
    if (isNaN(leadId)) {
        res.status(400);
        throw new Error('Invalid Lead ID');
    }

    const activity = await prisma.leadActivity.create({
        data: {
            leadId: leadId,

            type: type || 'NOTE',
            description
        }
    });
    res.status(201).json(activity);
});

exports.scheduleFollowUp = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { date, notes } = req.body;

    const leadId = parseInt(id);
    if (isNaN(leadId)) {
        res.status(400);
        throw new Error('Invalid Lead ID');
    }

    const followUp = await prisma.followUp.create({
        data: {
            leadId: leadId,

            date: new Date(date),
            notes
        }
    });

    // Update lead followUpDate
    await prisma.lead.update({
        where: { id: parseInt(id) },
        data: { followUpDate: new Date(date) }
    });

    // Log Activity
    await prisma.leadActivity.create({
        data: {
            leadId: parseInt(id),
            type: 'FOLLOW_UP_SCHEDULED',
            description: `Follow-up scheduled for ${new Date(date).toLocaleDateString()}`
        }
    });

    res.status(201).json(followUp);
});

exports.getFollowUps = asyncHandler(async (req, res) => {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const followUps = await prisma.followUp.findMany({
        where: {
            status: 'PENDING',
            date: { lte: todayEnd }
        },
        include: { 
            lead: {
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    status: true
                }
            }
        },
        orderBy: { date: 'asc' }
    });

    res.json(followUps);
});


// Deals
exports.createDeal = asyncHandler(async (req, res) => {
    const { leadId, title, value, stage, assignedTo, expectedCloseDate } = req.body;
    const lId = parseInt(leadId);
    const aTo = parseInt(assignedTo);

    const deal = await prisma.deal.create({
        data: {
            title,
            value: parseFloat(value),
            stage: stage || 'QUALIFICATION',
            expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
            lead: lId && !isNaN(lId) ? { connect: { id: lId } } : undefined,
            assignedUser: aTo && !isNaN(aTo) ? { connect: { id: aTo } } : undefined
        }
    });
    res.status(201).json(deal);
});

exports.getDeals = asyncHandler(async (req, res) => {
    const deals = await prisma.deal.findMany({
        include: { lead: true, assignedUser: { select: { name: true } } }
    });
    res.json(deals);
});

exports.updateDeal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const dId = parseInt(id);
    if (isNaN(dId)) {
        res.status(400);
        throw new Error('Invalid Deal ID');
    }

    const deal = await prisma.deal.update({
        where: { id: dId },
        data: {
            ...data,
            leadId: data.leadId && !isNaN(parseInt(data.leadId)) ? parseInt(data.leadId) : undefined,
            assignedTo: data.assignedTo && !isNaN(parseInt(data.assignedTo)) ? parseInt(data.assignedTo) : undefined,
            probability: data.probability && !isNaN(parseInt(data.probability)) ? parseInt(data.probability) : undefined
        }
    });
    res.json(deal);
});

exports.deleteDeal = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const dId = parseInt(id);
    if (isNaN(dId)) {
        res.status(400);
        throw new Error('Invalid Deal ID');
    }
    await prisma.deal.delete({ where: { id: dId } });
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
    const tId = parseInt(id);
    if (isNaN(tId)) {
        res.status(400);
        throw new Error('Invalid Task ID');
    }

    const task = await prisma.cRMTask.update({
        where: { id: tId },
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

exports.convertToQuotation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { branchId, quotationNumber, financialYearId } = req.body;

    const leadId = parseInt(id);
    const bId = parseInt(branchId);
    if (isNaN(leadId) || isNaN(bId)) {
        res.status(400);
        throw new Error('Invalid Lead or Branch ID');
    }

    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: { product: true }
    });

    if (!lead) {
        res.status(404);
        throw new Error('Lead not found');
    }

    // Create Quotation
    const quotation = await prisma.quotation.create({
        data: {
            quotationNumber,
            branchId: bId,
            financialYearId: financialYearId && !isNaN(parseInt(financialYearId)) ? parseInt(financialYearId) : null,
            subTotal: (lead.budget || 0),
            taxAmount: 0,
            totalAmount: (lead.budget || 0),
            status: 'SENT',
            notes: lead.notes,
            lead: { connect: { id: lead.id } }
        }
    });


    // Add Quotation Item if product exists
    if (lead.productId) {
        await prisma.quotationItem.create({
            data: {
                quotationId: quotation.id,
                productId: lead.productId,
                quantity: lead.quantity || 1,
                unitPrice: lead.product.price,
                total: (lead.product.price * (lead.quantity || 1))
            }
        });
    }

    // Update Lead status
    await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'QUOTATION_SENT', quotationId: quotation.id }
    });

    // Log Activity
    await prisma.leadActivity.create({
        data: {
            leadId: lead.id,
            type: 'QUOTATION_SENT',
            description: `Lead converted to Quotation #${quotationNumber}`
        }
    });

    res.status(201).json(quotation);
});

exports.convertToOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { branchId, invoiceNumber, financialYearId, paymentMethod } = req.body;

    const leadId = parseInt(id);
    const bId = parseInt(branchId);

    if (isNaN(leadId) || isNaN(bId)) {
        res.status(400);
        throw new Error('Invalid Lead or Branch ID');
    }

    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: { product: true }
    });

    if (!lead) {
        res.status(404);
        throw new Error('Lead not found');
    }

    // Create Sale (Order)
    const sale = await prisma.sale.create({
        data: {
            invoiceNumber,
            branchId: bId,
            financialYearId: financialYearId && !isNaN(parseInt(financialYearId)) ? parseInt(financialYearId) : null,

            subTotal: (lead.product?.price * (lead.quantity || 1)) || 0,
            taxAmount: 0,
            totalAmount: (lead.product?.price * (lead.quantity || 1)) || 0,
            paymentMethod,
            status: 'completed',
            lead: { connect: { id: lead.id } }
        }
    });

    // Add Sale Item
    if (lead.productId) {
        await prisma.saleItem.create({
            data: {
                saleId: sale.id,
                productId: lead.productId,
                quantity: lead.quantity || 1,
                unitPrice: lead.product.price,
                total: (lead.product.price * (lead.quantity || 1))
            }
        });
    }

    // Update Lead status
    await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'WON', saleId: sale.id }
    });

    // Log Activity
    await prisma.leadActivity.create({
        data: {
            leadId: lead.id,
            type: 'ORDER_CONVERTED',
            description: `Lead converted to Sales Order #${invoiceNumber}`
        }
    });

    res.status(201).json(sale);
});

