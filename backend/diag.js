const { PrismaClient } = require('./prisma/client');
const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.branch.findMany({
    select: { id: true, name: true, stockIncluded: true }
  });
  console.log('Branches:', branches);
  
  const stocks = await prisma.productStock.findMany({
      take: 10
  });
  console.log('Sample Stocks:', stocks);
}

main().catch(console.error).finally(() => prisma.$disconnect());
