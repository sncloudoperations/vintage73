const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create a new Quotation
exports.createQuotation = async (req, res) => {
    try {
        const { customerId, items, taxType, isTaxInclusive, notes, terms, validUntil, branchId } = req.body;

        // Generate Quotation Number (QT-YYYYMMDD-XXXX)
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const count = await prisma.quotation.count();
        const quotationNumber = `QT-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

        // Calculate Totals
        let subTotal = 0;
        let totalTax = 0;
        let finalTotal = 0;

        const quotationItems = items.map(item => {
            const total = parseFloat(item.total);
            const tax = parseFloat(item.taxAmount || 0);
            subTotal += (total - tax); // Assuming total in frontend includes tax if inclusive? 
            // Actually, let's rely on frontend sending correct values or recalculate:
            // For simplicity, we trust the frontend logic primarily but valid backend calculation is better.
            // Using passed values for now to match frontend exactness.
            totalTax += tax;
            finalTotal += total;

            return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total,
                taxAmount: item.taxAmount,
                taxRate: item.taxRate,
                discountAmount: item.discountAmount
            };
        });

        const quotation = await prisma.quotation.create({
            data: {
                quotationNumber,
                customerId,
                branchId,
                validUntil: validUntil ? new Date(validUntil) : null,
                subTotal: subTotal, // This might need adjustment based on inclusive/exclusive logic
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
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create quotation' });
    }
};

// Get All Quotations
exports.getQuotations = async (req, res) => {
    try {
        const { branchId } = req.query;
        const where = branchId ? { branchId: parseInt(branchId) } : {};

        const quotations = await prisma.quotation.findMany({
            where,
            include: { customer: true, items: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(quotations);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch quotations' });
    }
};

// Get Single Quotation
exports.getQuotationById = async (req, res) => {
    try {
        const quotation = await prisma.quotation.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { customer: true, items: { include: { product: true } }, payments: true }
        });
        if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
        res.json(quotation);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch quotation' });
    }
};

// Update Quotation
exports.updateQuotation = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, terms } = req.body; // Basic update for now

        const quotation = await prisma.quotation.update({
            where: { id: parseInt(id) },
            data: { status, notes, terms }
        });
        res.json(quotation);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update quotation' });
    }
};

// Convert to Sale (Invoice)
exports.convertToSale = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.$transaction(async (tx) => {
            const quotation = await tx.quotation.findUnique({
                where: { id: parseInt(id) },
                include: { items: true, payments: true }
            });

            if (!quotation) throw new Error('Quotation not found');
            if (quotation.status === 'CONVERTED') throw new Error('Quotation already converted');

            // Generate Invoice Number
            const count = await tx.sale.count();
            const invoiceNumber = `INV-${Date.now()}`; // Simple generator, can be improved

            // Create Sale
            const sale = await tx.sale.create({
                data: {
                    invoiceNumber,
                    customerId: quotation.customerId,
                    branchId: quotation.branchId,
                    saleDate: new Date(),
                    subTotal: quotation.subTotal,
                    taxAmount: quotation.taxAmount,
                    totalAmount: quotation.totalAmount,
                    status: 'completed', // Or 'draft'? Usually converted means done.
                    isTaxInclusive: quotation.isTaxInclusive,
                    // Copy Items
                    items: {
                        create: quotation.items.map(item => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            total: item.total,
                            taxAmount: item.taxAmount,
                            taxRate: item.taxRate,
                            discountAmount: item.discountAmount
                        }))
                    },
                    // Link to original quotation helps tracking? The query didn't have a field for it in Sale,
                    // but we can update Q status.
                }
            });

            // If there are advance payments, link them to the new Sale
            if (quotation.payments.length > 0) {
                // We need to update existing payments to link to this new Sale ID
                // or create new payment entries? 
                // Better to Link existing payments to the Sale so they show up as paid.
                await tx.payment.updateMany({
                    where: { quotationId: quotation.id },
                    data: { saleId: sale.id }
                });

                // Update Sale paidAmount
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

            // Deduct Stock (Since it's now a Sale)
            for (const item of quotation.items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: {
                        // Basic decrement on product, ideally should be on ProductStock per branch
                        // But simplified for now as per `saleController` logic typically:
                        // Assuming `ProductStock` model exists and is used:
                    }
                });

                // Real stock deduction logic usually lives in ProductStock update:
                const stock = await tx.productStock.findUnique({
                    where: { branchId_productId: { branchId: quotation.branchId, productId: item.productId } }
                });

                if (stock) {
                    await tx.productStock.update({
                        where: { id: stock.id },
                        data: { quantity: { decrement: item.quantity } }
                    });
                }
            }

            return sale;
        });

        res.json({ message: 'Quotation converted to Sale successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Conversion failed' });
    }
};

// Record Advance Payment
exports.recordAdvance = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, method, reference, branchId } = req.body;

        const payment = await prisma.payment.create({
            data: {
                quotationId: parseInt(id),
                type: 'INCOME', // Received money
                amount,
                method,
                reference,
                description: `Advance for Quotation #${id}`,
                branchId,
                paymentDate: new Date()
            }
        });

        res.json(payment);
    } catch (error) {
        res.status(500).json({ error: 'Failed to record advance payment' });
    }
};
