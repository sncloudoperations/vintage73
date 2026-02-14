const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
// const { calculateLedgerBalance } = require('./accountingController'); // Not used in this file currently

// Get all Financial Years
exports.getAllFinancialYears = asyncHandler(async (req, res) => {
    const years = await prisma.financialYear.findMany({
        orderBy: { startDate: 'desc' }
    });
    res.json(years);
});

// Create Financial Year
exports.createFinancialYear = asyncHandler(async (req, res) => {
    const { name, startDate, endDate } = req.body;

    // Validate overlapping dates
    const existing = await prisma.financialYear.findFirst({
        where: {
            OR: [
                {
                    startDate: { lte: new Date(endDate) },
                    endDate: { gte: new Date(startDate) }
                }
            ]
        }
    });

    if (existing) {
        res.status(400);
        throw new Error('Date range overlaps with an existing Financial Year.');
    }

    const year = await prisma.financialYear.create({
        data: {
            name,
            startDate: new Date(startDate),
            endDate: new Date(endDate)
        }
    });

    res.status(201).json(year);
});

// Preview Closing (Calculate Profit/Loss)
exports.previewClosing = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const year = await prisma.financialYear.findUnique({ where: { id: parseInt(id) } });

    if (!year) {
        res.status(404);
        throw new Error('Financial Year not found');
    }

    // Get all Income and Expense Ledgers
    const incomeGroups = await prisma.accountGroup.findMany({
        where: { groupType: 'INCOME' },
        select: { id: true }
    });
    const expenseGroups = await prisma.accountGroup.findMany({
        where: { groupType: 'EXPENSES' },
        select: { id: true }
    });

    const incomeGroupIds = incomeGroups.map(g => g.id);
    const expenseGroupIds = expenseGroups.map(g => g.id);

    const incomeLedgers = await prisma.ledger.findMany({
        where: { groupId: { in: incomeGroupIds } }
    });
    const expenseLedgers = await prisma.ledger.findMany({
        where: { groupId: { in: expenseGroupIds } }
    });

    // Calculate balances for the period
    let totalIncome = 0;
    let totalExpense = 0;

    // Helper to calculate balance in range
    const getPeriodBalance = async (ledgerId) => {
        const debit = await prisma.journalEntry.aggregate({
            _sum: { amount: true },
            where: {
                debitLedgerId: ledgerId,
                voucher: {
                    date: { gte: year.startDate, lte: year.endDate },
                    status: 'POSTED'
                }
            }
        });

        const credit = await prisma.journalEntry.aggregate({
            _sum: { amount: true },
            where: {
                creditLedgerId: ledgerId,
                voucher: {
                    date: { gte: year.startDate, lte: year.endDate },
                    status: 'POSTED'
                }
            }
        });

        // Income/Expense are usually Credit/Debit dominated respectively, but we just want net effect
        // Income is Credit - Debit
        // Expense is Debit - Credit
        const debitAmt = debit._sum.amount || 0;
        const creditAmt = credit._sum.amount || 0;
        return { debit: Number(debitAmt), credit: Number(creditAmt) };
    };

    for (const l of incomeLedgers) {
        const { debit, credit } = await getPeriodBalance(l.id);
        totalIncome += (credit - debit);
    }

    for (const l of expenseLedgers) {
        const { debit, credit } = await getPeriodBalance(l.id);
        totalExpense += (debit - credit);
    }

    const netProfit = totalIncome - totalExpense;

    res.json({
        year,
        totalIncome,
        totalExpense,
        netProfit,
        isProfit: netProfit >= 0
    });
});

// Close Financial Year
exports.closeFinancialYear = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { retainedEarningsLedgerId } = req.body; // Where to transfer P/L

    const year = await prisma.financialYear.findUnique({ where: { id: parseInt(id) } });
    if (!year) {
        res.status(404);
        throw new Error('Financial Year not found');
    }
    if (year.isClosed) {
        res.status(400);
        throw new Error('Year is already closed.');
    }

    // 1. Calculate P/L again (logic duplicated for safety, refactor later if needed)
    // ... For simplicity, we assume the preview logic is correct. 
    // We need to create a Journal Entry to zero out all P/L accounts.

    // Fetch Ledgers again
    const incomeGroups = await prisma.accountGroup.findMany({ where: { groupType: 'INCOME' }, select: { id: true } });
    const expenseGroups = await prisma.accountGroup.findMany({ where: { groupType: 'EXPENSES' }, select: { id: true } });

    // We need recursive group IDs if structure is nested, currently assuming 1-level for simplicity or flattened IDs.
    // Ideally use recursive helper, but for now assuming direct assignment or flat list.
    // FIXME: This might miss subgroups. 
    // Optimization: Just filter ledgers by groupType in JS or improved query.

    const allLedgers = await prisma.ledger.findMany({ include: { group: true } });
    const incomeLedgers = allLedgers.filter(l => l.group.groupType === 'INCOME');
    const expenseLedgers = allLedgers.filter(l => l.group.groupType === 'EXPENSES');

    const journalEntries = [];
    let netPnL = 0;

    // Zero out Income (Credit balance -> Debit it)
    for (const l of incomeLedgers) {
        // Get balance for period
        const debit = await prisma.journalEntry.aggregate({ _sum: { amount: true }, where: { debitLedgerId: l.id, voucher: { date: { gte: year.startDate, lte: year.endDate }, status: 'POSTED' } } });
        const credit = await prisma.journalEntry.aggregate({ _sum: { amount: true }, where: { creditLedgerId: l.id, voucher: { date: { gte: year.startDate, lte: year.endDate }, status: 'POSTED' } } });

        const balance = (Number(credit._sum.amount) || 0) - (Number(debit._sum.amount) || 0);

        if (balance !== 0) {
            // To Zero it, we Debit the income account
            journalEntries.push({
                debitLedgerId: l.id,
                amount: balance,
                description: `Closing Entry for FY ${year.name}`
            });
            netPnL += balance;
        }
    }

    // Zero out Expenses (Debit balance -> Credit it)
    for (const l of expenseLedgers) {
        const debit = await prisma.journalEntry.aggregate({ _sum: { amount: true }, where: { debitLedgerId: l.id, voucher: { date: { gte: year.startDate, lte: year.endDate }, status: 'POSTED' } } });
        const credit = await prisma.journalEntry.aggregate({ _sum: { amount: true }, where: { creditLedgerId: l.id, voucher: { date: { gte: year.startDate, lte: year.endDate }, status: 'POSTED' } } });

        const balance = (Number(debit._sum.amount) || 0) - (Number(credit._sum.amount) || 0);

        if (balance !== 0) {
            // To Zero it, we Credit the expense account
            journalEntries.push({
                creditLedgerId: l.id,
                amount: balance, // Positive amount for the entry (credit)
                description: `Closing Entry for FY ${year.name}`
            });
            netPnL -= balance; // Expenses reduce profit
        }
    }

    // Balancing Entry to Retained Earnings
    if (netPnL > 0) {
        // Profit: Income > Expense. We debited Income (total) > Credited Expense (total).
        // Difference needed on Credit side (Capital/Retained Earnings increases)
        journalEntries.push({
            creditLedgerId: parseInt(retainedEarningsLedgerId),
            amount: netPnL,
            description: `Net Profit Transfer for FY ${year.name}`
        });
    } else if (netPnL < 0) {
        // Loss: Expense > Income. We Credited Expense (total) > Debited Income (total).
        // Difference needed on Debit side (Capital/Retained Earnings decreases)
        journalEntries.push({
            debitLedgerId: parseInt(retainedEarningsLedgerId),
            amount: Math.abs(netPnL),
            description: `Net Loss Transfer for FY ${year.name}`
        });
    }

    if (journalEntries.length === 0) {
        res.status(400);
        throw new Error('No transactions to close.');
    }

    // Create the Voucher
    await prisma.$transaction(async (tx) => {
        // create voucher
        // note: reusing logic or simplifying.

        // Generate number (simplified)
        const vNum = `CLOSE-${year.name.replace(/\s/g, '-')}`;

        await tx.voucher.create({
            data: {
                voucherNumber: vNum,
                voucherType: 'JOURNAL',
                date: year.endDate, // Last day of FY
                narration: `System Generated Closing Entry for ${year.name}`,
                totalAmount: Math.abs(netPnL), // Approximation for voucher total, technically sum of debits
                status: 'POSTED',
                createdBy: req.user ? req.user.id : 1, // Fallback if no user
                entries: {
                    create: journalEntries.map(e => ({
                        debitLedgerId: e.debitLedgerId,
                        creditLedgerId: e.creditLedgerId,
                        amount: Math.abs(e.amount),
                        description: e.description
                    }))
                }
            }
        });

        // Mark Year as Closed and Locked
        await tx.financialYear.update({
            where: { id: year.id },
            data: { isClosed: true, isLocked: true }
        });
    });

    res.json({ message: 'Financial Year Closed Successfully' });
});
