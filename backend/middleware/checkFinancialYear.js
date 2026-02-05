const prisma = require('../utils/prismaClient');

const checkFinancialYear = async (req, res, next) => {
    try {
        let dateToCheck;

        // Case 1: Create request (date in body)
        if (req.method === 'POST' && req.body.date) {
            dateToCheck = new Date(req.body.date);
        }
        // Case 2: Update request (date in body, or if not in body, need to check existing)
        // For simplicity, if we are updating a voucher, we should check BOTH the old date and the new date.
        // If the old date was in a locked period -> Cannot change.
        // If the new date is in a locked period -> Cannot move to there.

        // However, handling both requires fetching the voucher first for updates/deletes.
        // Let's handle the specific route params.

        if (req.params.id) {
            // This is an update or delete or cancel
            const voucherId = parseInt(req.params.id);
            const existingVoucher = await prisma.voucher.findUnique({ where: { id: voucherId } });

            if (!existingVoucher) {
                return res.status(404).json({ error: 'Voucher not found' });
            }

            // Check if existing voucher is in a locked period
            const lockedYearOld = await prisma.financialYear.findFirst({
                where: {
                    startDate: { lte: existingVoucher.date },
                    endDate: { gte: existingVoucher.date },
                    isLocked: true
                }
            });

            if (lockedYearOld) {
                return res.status(403).json({ error: `Cannot modify voucher in locked Financial Year: ${lockedYearOld.name}` });
            }

            // If updating date, check the new date too
            if (req.body.date) {
                dateToCheck = new Date(req.body.date);
            }
        }

        if (dateToCheck) {
            const lockedYearNew = await prisma.financialYear.findFirst({
                where: {
                    startDate: { lte: dateToCheck },
                    endDate: { gte: dateToCheck },
                    isLocked: true
                }
            });

            if (lockedYearNew) {
                return res.status(403).json({ error: `Cannot record transaction provided in locked Financial Year: ${lockedYearNew.name}` });
            }
        }

        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = checkFinancialYear;
