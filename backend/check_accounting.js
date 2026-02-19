const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const groups = ['Sundry Debtors', 'Cash-in-Hand', 'Bank Accounts', 'Sales Accounts', 'Direct Incomes'];
    console.log('--- ACCOUNTING GROUPS CHECK ---');
    for (const g of groups) {
        const found = await prisma.accountGroup.findFirst({ where: { name: g } });
        console.log(`${g}: ${found ? 'FOUND (ID: ' + found.id + ')' : 'MISSING'}`);
    }

    const ledgers = ['Cash', 'Bank Account', 'Sales', 'Walk-in Customer'];
    console.log('\n--- ESSENTIAL LEDGERS CHECK ---');
    for (const l of ledgers) {
        const found = await prisma.ledger.findFirst({ where: { name: l } });
        console.log(`${l}: ${found ? 'FOUND (ID: ' + found.id + ')' : 'MISSING'}`);
    }

    process.exit(0);
}

main();
