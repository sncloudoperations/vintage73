const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testQuery() {
  const branchId = 4;
  const fyId = 1;
  const prefix = "INV26";

  const lastSale = await prisma.sale.findFirst({
    where: { 
        branchId: branchId, 
        financialYearId: fyId,
        invoiceNumber: { startsWith: prefix }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Branch ${branchId} - Prefix ${prefix}:`, lastSale?.invoiceNumber || 'NONE');
  
  const allInBranch = await prisma.sale.findMany({
    where: { branchId: branchId },
    select: { invoiceNumber: true }
  });
  console.log(`All in Branch ${branchId}:`, allInBranch.map(s => s.invoiceNumber));
}

testQuery().catch(console.error).finally(() => prisma.$disconnect());
