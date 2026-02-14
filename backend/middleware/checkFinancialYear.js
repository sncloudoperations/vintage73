const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

const checkFinancialYear = asyncHandler(async (req, res, next) => {
    let dateToCheck;

    // Case 1: Create request (date in body)
    if (req.method === 'POST' && req.body.date) {
        dateToCheck = new Date(req.body.date);
    }
    // Case 2: Update request (date in body, or if not in body, need to check existing)
    if (req.params.id) {
        // This is an update or delete or cancel
        const voucherId = parseInt(req.params.id);
        const existingVoucher = await prisma.voucher.findUnique({ where: { id: voucherId } });

        if (!existingVoucher) {
            res.status(404);
            throw new Error('Voucher not found');
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
            res.status(403);
            throw new Error(`Cannot modify voucher in locked Financial Year: ${lockedYearOld.name}`);
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
            res.status(403);
            throw new Error(`Cannot record transaction provided in locked Financial Year: ${lockedYearNew.name}`);
        }
    }

    next();
});

module.exports = checkFinancialYear;
