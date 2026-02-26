const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const groups = await prisma.accountGroup.findMany();
    console.log('--- Groups ---');
    groups.forEach(g => console.log(`${g.name} (${g.groupType})`));

    const ledgers = await prisma.ledger.findMany({ include: { group: true } });
    console.log('--- Ledgers ---');
    ledgers.forEach(l => console.log(`${l.name} (${l.group.name} - ${l.balanceType})`));

    const postings = await prisma.transactionPosting.findMany({ include: { ledger: true } });
    console.log('--- Transaction Postings ---');
    postings.forEach(p => console.log(`${p.transactionType} - ${p.role}: ${p.ledger.name} (${p.side})`));

    await prisma.$disconnect();
}

main().catch(console.error);
