const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRules() {
  const rules = await prisma.transactionPosting.findMany({
    where: { transactionType: 'PURCHASE' },
    include: { ledger: true }
  });
  console.log('--- PURCHASE Transaction Posting Rules ---');
  console.log(JSON.stringify(rules, null, 2));

  const groups = await prisma.accountGroup.findMany();
  console.log('--- Account Groups ---');
  console.log(groups.map(g => g.name).join(', '));

  const ledgers = await prisma.ledger.findMany({
    include: { group: true }
  });
  console.log('--- Ledgers ---');
  ledgers.forEach(l => console.log(`${l.name} (${l.group.name})`));

  await prisma.$disconnect();
}

checkRules().catch(console.error);
