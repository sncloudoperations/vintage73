const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedAccounting() {
    console.log('Seeding Accounting System...');

    // 1. Account Groups
    const groups = [
        { name: 'Sundry Creditors', groupType: 'LIABILITIES' },
        { name: 'Sundry Debtors', groupType: 'ASSETS' },
        { name: 'Cash-in-Hand', groupType: 'ASSETS' },
        { name: 'Bank Accounts', groupType: 'ASSETS' },
        { name: 'Purchase Accounts', groupType: 'EXPENSES' },
        { name: 'Sales Accounts', groupType: 'INCOME' }
    ];

    for (const g of groups) {
        await prisma.accountGroup.upsert({
            where: { name: g.name },
            update: { groupType: g.groupType },
            create: g
        });
    }

    // 2. Ledgers
    const purchaseGroup = await prisma.accountGroup.findUnique({ where: { name: 'Purchase Accounts' } });
    const cashGroup = await prisma.accountGroup.findUnique({ where: { name: 'Cash-in-Hand' } });

    const purchaseLedger = await prisma.ledger.upsert({
        where: { name: 'Purchase Account' },
        update: {},
        create: { name: 'Purchase Account', groupId: purchaseGroup.id, balanceType: 'DEBIT' }
    });

    const cashLedger = await prisma.ledger.upsert({
        where: { name: 'Cash' },
        update: {},
        create: { name: 'Cash', groupId: cashGroup.id, balanceType: 'DEBIT' }
    });

    // 3. Transaction Posting Rules for PURCHASE
    // Standard Accounting: Purchase Dr, Supplier Cr
    await prisma.transactionPosting.upsert({
        where: { transactionType_role: { transactionType: 'PURCHASE', role: 'PURCHASE_ACCOUNT' } },
        update: { ledgerId: purchaseLedger.id, side: 'DEBIT', amountField: 'totalAmount' },
        create: {
            transactionType: 'PURCHASE',
            role: 'PURCHASE_ACCOUNT',
            ledgerId: purchaseLedger.id,
            side: 'DEBIT',
            amountField: 'totalAmount',
            label: 'Purchase Dr'
        }
    });

    await prisma.transactionPosting.upsert({
        where: { transactionType_role: { transactionType: 'PURCHASE', role: 'SUPPLIER' } },
        update: { ledgerId: purchaseLedger.id, side: 'CREDIT', amountField: 'totalAmount' },
        create: {
            transactionType: 'PURCHASE',
            role: 'SUPPLIER',
            ledgerId: purchaseLedger.id, // Placeholder
            side: 'CREDIT',
            amountField: 'totalAmount',
            label: 'Supplier Cr'
        }
    });

    console.log('Accounting Seeding Complete.');
}

seedAccounting()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
