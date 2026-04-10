const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { generateNextNumber } = require('../services/numberingService');

// Create a new Quotation
exports.createQuotation = asyncHandler(async (req, res) => {
    const { items, taxType, isTaxInclusive, notes, terms, validUntil, branchId } = req.body;
    const customerId = req.body.customerId ? parseInt(req.body.customerId) : null;

    // 1. Identify Financial Year & Generate Number (Branch-wise)
    const { number: quotationNumber, nextSeq, financialYearId } = await generateNextNumber(prisma, 'quotation', branchId, new Date());

    if (financialYearId) {
        // Update the FY sequence for sync
        await prisma.financialYear.update({
            where: { id: financialYearId },
            data: { quotationSequence: nextSeq }
        });
    }

    // Calculate Totals
    let subTotal = 0;
    let totalTax = 0;
    let finalTotal = 0;

    const quotationItems = items.map(item => {
        const total = parseFloat(item.total);
        const tax = parseFloat(item.taxAmount || 0);
        subTotal += (total - tax);
        totalTax += tax;
        finalTotal += total;

        return {
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            taxAmount: item.taxAmount,
            taxRate: item.taxRate,
            discountAmount: item.discountAmount,
            discountPercent: item.discountPercent
        };
    });

    const quotation = await prisma.quotation.create({
        data: {
            quotationNumber,
            customerId,
            branchId,
            financialYearId,
            validUntil: validUntil ? new Date(validUntil) : null,
            subTotal: subTotal,
            taxAmount: totalTax,
            totalAmount: finalTotal,
            notes,
            terms,
            isTaxInclusive,
            taxType,
            items: {
                create: quotationItems
            }
        },
        include: { items: true }
    });

    res.status(201).json(quotation);
});

// Get All Quotations
exports.getQuotations = asyncHandler(async (req, res) => {
    const { branchId: queryBranchId } = req.query;
    const where = {};

    // Branch Isolation
    if (req.user.branchId) {
        where.branchId = req.user.branchId;
    } else if (queryBranchId) {
        where.branchId = parseInt(queryBranchId);
    }

    const quotations = await prisma.quotation.findMany({
        where,
        include: { customer: true, items: true },
        orderBy: { createdAt: 'desc' }
    });
    res.json(quotations);
});

// Get Single Quotation
exports.getQuotationById = asyncHandler(async (req, res) => {
    const quotation = await prisma.quotation.findUnique({
        where: { id: parseInt(req.params.id) },
        include: { customer: true, items: { include: { product: true } }, payments: true }
    });
    if (!quotation) {
        res.status(404);
        throw new Error('Quotation not found');
    }
    res.json(quotation);
});

// Update Quotation
exports.updateQuotation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes, terms } = req.body;

    const quotation = await prisma.quotation.update({
        where: { id: parseInt(id) },
        data: { status, notes, terms }
    });
    res.json(quotation);
});

// Convert to Sale (Invoice)
exports.convertToSale = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { saleDate: bodyDate } = req.body || {};
    const saleDate = bodyDate ? new Date(bodyDate) : new Date();

    const result = await prisma.$transaction(async (tx) => {
        const quotation = await tx.quotation.findUnique({
            where: { id: parseInt(id) },
            include: { items: true, payments: true }
        });

        if (!quotation) throw new Error('Quotation not found');
        if (quotation.status === 'CONVERTED') throw new Error('Quotation already converted');

        // Fetch Branch for Stock Control Toggle
        // Priority: Logged-in user's branch setting (defines current environment behavior)
        const targetBranchId = req.user.branchId || quotation.branchId;
        const branch = await tx.branch.findUnique({
            where: { id: targetBranchId }
        });

        // --- STOCK VALIDATION ---
        if (!!branch?.stockIncluded) {
            for (const item of quotation.items) {
                const stock = await tx.productStock.findUnique({
                    where: {
                        branchId_productId: {
                            branchId: quotation.branchId, // Deduct from the quotation's branch
                            productId: item.productId
                        }
                    }
                });

                if (!stock || stock.quantity < item.quantity) {
                    const product = await tx.product.findUnique({ where: { id: item.productId } });
                    throw new Error(`Insufficient stock for product ${product?.name || 'ID: ' + item.productId}. Available: ${stock ? stock.quantity : 0}, Required: ${item.quantity}`);
                }
            }
        }

        // Generate Invoice Number
        const { number: invoiceNumber, nextSeq, financialYearId } = await generateNextNumber(tx, 'invoice', quotation.branchId, saleDate);

        if (financialYearId) {
            // Update the FY sequence for sync
            await tx.financialYear.update({
                where: { id: financialYearId },
                data: { invoiceSequence: nextSeq }
            });
        }

        // Create Sale
        const sale = await tx.sale.create({
            data: {
                invoiceNumber,
                customer: { connect: { id: quotation.customerId } },
                branch: { connect: { id: parseInt(quotation.branchId) } },
                saleDate: saleDate,
                subTotal: quotation.subTotal,
                taxAmount: quotation.taxAmount,
                totalAmount: quotation.totalAmount,
                status: 'completed',
                isTaxInclusive: quotation.isTaxInclusive,
                isInvoice: true,
                quotation: { connect: { id: quotation.id } },
                financialYear: financialYearId ? { connect: { id: financialYearId } } : undefined,
                items: {
                    create: quotation.items.map(item => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        total: item.total,
                        taxAmount: item.taxAmount,
                        taxRate: item.taxRate,
                        discountAmount: item.discountAmount,
                        discountPercent: item.discountPercent
                    }))
                }
            }
        });

        // Link existing payments
        if (quotation.payments.length > 0) {
            await tx.payment.updateMany({
                where: { quotationId: quotation.id },
                data: { saleId: sale.id }
            });

            const totalPaid = quotation.payments.reduce((sum, p) => sum + Number(p.amount), 0);
            const balance = Number(quotation.totalAmount) - totalPaid;

            await tx.sale.update({
                where: { id: sale.id },
                data: {
                    paidAmount: totalPaid,
                    balanceAmount: balance
                }
            });
        } else {
            await tx.sale.update({
                where: { id: sale.id },
                data: { balanceAmount: quotation.totalAmount }
            });
        }

        // Mark Quotation as Converted
        await tx.quotation.update({
            where: { id: quotation.id },
            data: { status: 'CONVERTED' }
        });

        // Deduct Stock
        for (const item of quotation.items) {
            await tx.productStock.upsert({
                where: { branchId_productId: { branchId: quotation.branchId, productId: item.productId } },
                update: { quantity: { decrement: item.quantity } },
                create: { branchId: quotation.branchId, productId: item.productId, quantity: -item.quantity }
            });
        }

        return sale;
    });

    res.json({ message: 'Quotation converted to Sale successfully', saleId: result.id });
});

// Record Advance Payment
exports.recordAdvance = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, method, reference, branchId } = req.body;

    const payment = await prisma.payment.create({
        data: {
            quotationId: parseInt(id),
            type: 'receipt',
            amount: parseFloat(amount),
            method,
            reference,
            description: `Advance for Quotation #${id}`,
            branchId: parseInt(branchId),
            paymentDate: new Date()
        }
    });

    res.json(payment);
});
