const prisma = require('../utils/prismaClient');

// Get all postings
exports.getAllPostings = async (req, res) => {
    try {
        const postings = await prisma.transactionPosting.findMany({
            include: {
                ledger: {
                    select: {
                        id: true,
                        name: true,
                        group: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: { label: 'asc' }
        });
        res.json(postings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get schema metadata (Models and Fields)
exports.getSchemaMetadata = async (req, res) => {
    console.log('API: GET /posting-setup/metadata called');
    try {
        // Comprehensive list of transaction-relevant models and their fields based on schema
        const metadata = [
            {
                id: 'Sale',
                name: 'Sales (Invoice)',
                fields: [
                    'subTotal', 'taxAmount', 'totalAmount', 'discount',
                    'roundOffAmount', 'paidAmount', 'balanceAmount',
                    'incentiveAmount', 'isReturn', 'isB2B'
                ]
            },
            {
                id: 'Purchase',
                name: 'Purchase (Bill)',
                fields: [
                    'totalAmount', 'totalSubTotal', 'totalTax',
                    'paidAmount', 'balanceAmount', 'discount'
                ]
            },
            {
                id: 'StockTransfer',
                name: 'Stock Transfer',
                fields: ['totalCost', 'taxAmount', 'quantity']
            },
            {
                id: 'StockTransfer',
                name: 'Stock Receipt',
                fields: ['totalCost', 'taxAmount', 'quantity']
            },
            {
                id: 'Expense',
                name: 'Expense',
                fields: ['amount', 'taxAmount']
            },
            {
                id: 'Payment',
                name: 'Payment/Receipt',
                fields: ['amount']
            },
            {
                id: 'Payroll',
                name: 'Payroll (Salary)',
                fields: ['basicSalary', 'allowances', 'deductions', 'netSalary']
            },
            {
                id: 'SalaryAdvance',
                name: 'Salary Advance',
                fields: ['amount']
            }
        ];
        res.json(metadata);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Create or update a posting
exports.upsertPosting = async (req, res) => {
    try {
        const { transactionType, role, ledgerId } = req.body;

        if (!transactionType || !role || !ledgerId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const posting = await prisma.transactionPosting.upsert({
            where: {
                transactionType_role: {
                    transactionType,
                    role
                }
            },
            update: {
                ledgerId: parseInt(ledgerId),
                label: req.body.label || null,
                targetTable: req.body.targetTable || null,
                side: req.body.side || 'CREDIT',
                postingMethod: req.body.postingMethod || 'SUM',
                amountField: req.body.amountField || null,
                customFormula: req.body.customFormula || null,
                condition: req.body.condition || null
            },
            create: {
                transactionType,
                role,
                label: req.body.label || null,
                ledgerId: parseInt(ledgerId),
                side: req.body.side || 'CREDIT',
                targetTable: req.body.targetTable || null,
                postingMethod: req.body.postingMethod || 'SUM',
                amountField: req.body.amountField || null,
                customFormula: req.body.customFormula || null,
                condition: req.body.condition || null,
                isSystem: req.body.isSystem || false
            }
        });

        res.json(posting);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Bulk upsert postings
exports.bulkUpsertPostings = async (req, res) => {
    try {
        const { postings } = req.body;

        if (!Array.isArray(postings)) {
            return res.status(400).json({ error: 'Postings must be an array' });
        }

        const results = await prisma.$transaction(
            postings.map(p => prisma.transactionPosting.upsert({
                where: {
                    transactionType_role: {
                        transactionType: p.transactionType,
                        role: p.role
                    }
                },
                update: {
                    ledgerId: parseInt(p.ledgerId),
                    side: p.side || 'CREDIT',
                    targetTable: p.targetTable || null,
                    postingMethod: p.postingMethod || 'SUM',
                    amountField: p.amountField || null,
                    customFormula: p.customFormula || null,
                    condition: p.condition || null
                },
                create: {
                    transactionType: p.transactionType,
                    role: p.role,
                    ledgerId: parseInt(p.ledgerId),
                    side: p.side || 'CREDIT',
                    targetTable: p.targetTable || null,
                    postingMethod: p.postingMethod || 'SUM',
                    amountField: p.amountField || null,
                    customFormula: p.customFormula || null,
                    condition: p.condition || null
                }
            }))
        );

        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Delete a posting
exports.deletePosting = async (req, res) => {
    try {
        const { id } = req.params;
        const posting = await prisma.transactionPosting.findUnique({
            where: { id: parseInt(id) }
        });

        if (!posting) {
            return res.status(404).json({ error: 'Posting not found' });
        }

        if (posting.isSystem) {
            return res.status(403).json({ error: 'System posting rules cannot be deleted' });
        }

        await prisma.transactionPosting.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: 'Posting deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
