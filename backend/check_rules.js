const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.transactionPosting.count({
    where: { transactionType: 'PURCHASE', role: 'SUPPLIER' }
  });
  console.log('SUPPLIER_RULE_COUNT:', count);
  fs.writeFileSync('rule_count.txt', 'SUPPLIER_RULE_COUNT: ' + count);
}
main().catch(e => fs.writeFileSync('rule_count_error.txt', e.stack)).finally(()=>prisma.$disconnect());
