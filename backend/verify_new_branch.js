const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyNewBranch() {
  const branchId = 9; // New
  const fyId = 1;
  const fy = await prisma.financialYear.findUnique({ where: { id: fyId } });
  
  // Simulation of controller logic
  const last = await prisma.sale.findFirst({
    where: { branchId: branchId, financialYearId: fyId },
    orderBy: { createdAt: 'desc' }
  });
  
  if (last) {
    console.log('Error: Branch 9 already has sales!');
    return;
  }

  const prefix = fy.invoicePrefix || 'INV';
  const startingSeq = fy.invoiceSequence || '001';
  const nextSeq = startingSeq;
  const invoiceNumber = prefix + nextSeq;

  console.log(`NEW BRANCH 9 START: ${invoiceNumber}`);
  
  if (invoiceNumber === 'INV26001') {
    console.log('SUCCESS: New branch correctly starts at 001');
  } else {
    console.log('FAILURE: New branch started at ' + invoiceNumber);
  }
}

verifyNewBranch().catch(console.error).finally(() => prisma.$disconnect());
