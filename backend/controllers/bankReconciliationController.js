const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getUnreconciledTransactions = async (req, res) => {
    const { ledgerId } = req.query;
    if (!ledgerId) return res.status(400).json({ error: "Ledger ID is required" });

    try {
        const entries = await prisma.journalEntry.findMany({
            where: {
                OR: [
                    { debitLedgerId: parseInt(ledgerId) },
                    { creditLedgerId: parseInt(ledgerId) }
                ],
                isReconciled: false,
                voucher: {
                    status: 'POSTED'
                }
            },
            include: {
                voucher: true,
                debitLedger: { select: { name: true } },
                creditLedger: { select: { name: true } }
            },
            orderBy: {
                voucher: {
                    date: 'asc'
                }
            }
        });
        res.json(entries);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

exports.reconcileTransactions = async (req, res) => {
    const { reconciliations } = req.body; // Array of { entryId, bankDate, remarks }

    if (!Array.isArray(reconciliations)) {
        return res.status(400).json({ error: "Invalid reconciliation data" });
    }

    try {
        const updates = reconciliations.map(recon =>
            prisma.journalEntry.update({
                where: { id: parseInt(recon.entryId) },
                data: {
                    isReconciled: true,
                    bankDate: new Date(recon.bankDate),
                    reconRemarks: recon.remarks
                }
            })
        );

        await prisma.$transaction(updates);
        res.json({ message: "Transactions reconciled successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

exports.getReconciliationSummary = async (req, res) => {
    const { ledgerId } = req.query;
    if (!ledgerId) return res.status(400).json({ error: "Ledger ID is required" });

    try {
        const ledger = await prisma.ledger.findUnique({
            where: { id: parseInt(ledgerId) }
        });

        // System Balance (Sum of all posted entries)
        const entries = await prisma.journalEntry.findMany({
            where: {
                OR: [
                    { debitLedgerId: parseInt(ledgerId) },
                    { creditLedgerId: parseInt(ledgerId) }
                ],
                voucher: {
                    status: 'POSTED'
                }
            }
        });

        let systemBalance = parseFloat(ledger.openingBalance) * (ledger.balanceType === 'DEBIT' ? 1 : -1);
        let bankBalance = parseFloat(ledger.openingBalance) * (ledger.balanceType === 'DEBIT' ? 1 : -1);

        entries.forEach(entry => {
            const amount = parseFloat(entry.amount);
            const isDebit = entry.debitLedgerId === parseInt(ledgerId);

            const effect = isDebit ? amount : -amount;
            systemBalance += effect;

            if (entry.isReconciled) {
                bankBalance += effect;
            }
        });

        res.json({
            ledgerName: ledger.name,
            systemBalance,
            bankBalance,
            unreconciledCount: entries.filter(e => !e.isReconciled).length,
            unreconciledAmount: systemBalance - bankBalance
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};
