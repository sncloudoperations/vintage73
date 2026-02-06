const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const postings = [
        { label: 'Advance Collection', transactionType: 'RECEIPT', role: 'ADVANCE', isSystem: true },
        { label: 'Bank Transaction', transactionType: 'CONTRA', role: 'BANK', isSystem: true },
        { label: 'Card Payments', transactionType: 'SALES', role: 'CARD', isSystem: true },
        { label: 'Cash Transaction', transactionType: 'CONTRA', role: 'CASH', isSystem: true },
        { label: 'Certification Charge Paid', transactionType: 'PURCHASE', role: 'CERT_CHARGE', isSystem: true },
        { label: 'Cess Collection', transactionType: 'SALES', role: 'CESS', isSystem: true },
        { label: 'CGST Input', transactionType: 'PURCHASE', role: 'TAX_CGST', isSystem: true },
        { label: 'CGST Output', transactionType: 'SALES', role: 'TAX_CGST', isSystem: true },
        { label: 'Compliment gift coin', transactionType: 'SALES', role: 'GIFT_COIN', isSystem: true },
        { label: 'Credit Settlement', transactionType: 'RECEIPT', role: 'CREDIT_SETTLE', isSystem: true },
        { label: 'Credit Settlement Discount', transactionType: 'RECEIPT', role: 'DISCOUNT', isSystem: true },
        { label: 'Customer Account', transactionType: 'SALES', role: 'MAIN_ACCOUNT', isSystem: true },
        { label: 'Discount Account', transactionType: 'SALES', role: 'DISCOUNT', isSystem: true },
        { label: 'Hallmarking Charges', transactionType: 'SALES', role: 'HALLMARK', isSystem: true },
        { label: 'HUID Collected', transactionType: 'SALES', role: 'HUID', isSystem: true },
        { label: 'HUID Payed', transactionType: 'PURCHASE', role: 'HUID', isSystem: true },
        { label: 'IGST Input', transactionType: 'PURCHASE', role: 'TAX_IGST', isSystem: true },
        { label: 'IGST Output', transactionType: 'SALES', role: 'TAX_IGST', isSystem: true },
        { label: 'Making Charges Collected', transactionType: 'SALES', role: 'MAKING_CHARGE', isSystem: true },
        { label: 'Making Charges Payed', transactionType: 'PURCHASE', role: 'MAKING_CHARGE', isSystem: true },
        { label: 'Old Gold Purchase', transactionType: 'PURCHASE', role: 'OLD_GOLD', isSystem: true },
        { label: 'Old Gold Sales', transactionType: 'SALES', role: 'OLD_GOLD', isSystem: true },
        { label: 'Purchase', transactionType: 'PURCHASE', role: 'MAIN_ACCOUNT', isSystem: true },
        // Add more to reach ~41 or as needed
    ];

    // Get a default ledger to avoid foreign key errors during seeding if none exists
    let defaultLedger = await prisma.ledger.findFirst();
    if (!defaultLedger) {
        const group = await prisma.accountGroup.upsert({
            where: { name: 'Suspense Accounts' },
            update: {},
            create: { name: 'Suspense Accounts', groupType: 'LIABILITIES' }
        });
        defaultLedger = await prisma.ledger.create({
            data: { name: 'Default Suspense Ledger', groupId: group.id }
        });
    }

    console.log('Seeding Posting Rules...');
    for (const p of postings) {
        await prisma.transactionPosting.upsert({
            where: {
                transactionType_role: {
                    transactionType: p.transactionType,
                    role: p.role
                }
            },
            update: {
                label: p.label,
                isSystem: p.isSystem
            },
            create: {
                ...p,
                ledgerId: defaultLedger.id
            }
        });
    }
    console.log('Seeding completed.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
