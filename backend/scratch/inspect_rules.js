const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rules = await prisma.transactionPosting.findMany({
    where: { transactionType: 'SALES' },
    include: { ledger: { select: { name: true } } }
  });
  console.log(JSON.stringify(rules, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
