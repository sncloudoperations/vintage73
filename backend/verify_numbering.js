const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateNextNumber } = require('./services/numberingService');

async function test() {
    console.log('--- Numbering System Verification ---');

    try {
        // 1. Create a test branch
        const branch = await prisma.branch.upsert({
            where: { id: 999 },
            update: {},
            create: { id: 999, name: 'Test Branch', address: 'Test Address' }
        });
        console.log('Test Branch created/verified.');

        // 2. Create a test financial year
        const fy = await prisma.financialYear.upsert({
            where: { name_branchId: { name: 'FY 2026-Test', branchId: 999 } },
            update: {},
            create: {
                name: 'FY 2026-Test',
                startDate: new Date('2026-01-01'),
                endDate: new Date('2026-12-31'),
                branchId: 999,
                invoicePrefix: 'TINV',
                invoiceSequence: '001',
                quotationPrefix: 'TQT',
                quotationSequence: '001'
            }
        });
        console.log('Test Financial Year created/verified.');

        // 3. Generate some numbers
        const res1 = await generateNextNumber(prisma, 'invoice', 999, new Date('2026-06-01'));
        console.log('Next Invoice (Seq 001):', res1.number);
        if (res1.number !== 'TINV001') throw new Error('Invoice numbering failed at 001');

        // Simulate creation of a sale
        await prisma.sale.create({
            data: {
                invoiceNumber: res1.number,
                branchId: 999,
                totalAmount: 100,
                subTotal: 100,
                taxAmount: 0,
                financialYearId: res1.financialYearId,
                saleDate: new Date('2026-06-01')
            }
        });
        console.log('Mock Sale 1 created.');

        const res2 = await generateNextNumber(prisma, 'invoice', 999, new Date('2026-06-01'));
        console.log('Next Invoice (Seq 002):', res2.number);
        if (res2.number !== 'TINV002') throw new Error('Invoice numbering failed at 002');

        const resQ1 = await generateNextNumber(prisma, 'quotation', 999, new Date('2026-06-01'));
        console.log('Next Quotation (Seq 001):', resQ1.number);
        if (resQ1.number !== 'TQT001') throw new Error('Quotation numbering failed at 001');

        console.log('--- ALL TESTS PASSED ---');

    } catch (e) {
        console.error('VERIFICATION FAILED:', e.message);
        process.exit(1);
    } finally {
        // Cleanup test data
        try {
            await prisma.sale.deleteMany({ where: { branchId: 999 } });
            await prisma.financialYear.delete({ where: { id: 999 } }).catch(() => {}); // might fail if relations exist
            // await prisma.branch.delete({ where: { id: 999 } });
        } catch (cleanupErr) {
            // ignore
        }
        await prisma.$disconnect();
    }
}

test();
