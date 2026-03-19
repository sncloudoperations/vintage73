const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSync() {
  const fyId = 1;
  const branchId = 3; 

  console.log('--- BEFORE ---');
  let fy = await prisma.financialYear.findUnique({ where: { id: fyId } });
  console.log('FY Sequence:', fy.invoiceSequence);

  // Simulation of SALES controller logic (simplified)
  const lastSale = await prisma.sale.findFirst({
    where: { branchId: branchId, financialYearId: fyId },
    orderBy: { createdAt: 'desc' }
  });
  
  const startingSeq = fy.invoiceSequence || '001';
  const prefix = fy.invoicePrefix || 'INV26';
  
  let nextSeq;
  if (lastSale && lastSale.invoiceNumber) {
    const seqPart = lastSale.invoiceNumber.startsWith(prefix) ? lastSale.invoiceNumber.slice(prefix.length) : lastSale.invoiceNumber;
    nextSeq = (parseInt(seqPart, 10) + 1).toString().padStart(startingSeq.length, '0');
  } else {
    nextSeq = startingSeq;
  }

  console.log('Generated Next:', nextSeq);

  await prisma.$transaction(async (tx) => {
      // Logic from controller:
      const currentGlobalSeqNum = parseInt(startingSeq, 10);
      const nextSeqNum = parseInt(nextSeq, 10);
      
      console.log('Checking:', nextSeqNum, '>=', currentGlobalSeqNum);
      if (nextSeqNum >= currentGlobalSeqNum) {
        const updateVal = (nextSeqNum + 1).toString().padStart(startingSeq.length, '0');
        console.log('Updating FY to:', updateVal);
        await tx.financialYear.update({
          where: { id: fyId },
          data: { invoiceSequence: updateVal }
        });
      }
  });

  console.log('\n--- AFTER ---');
  fy = await prisma.financialYear.findUnique({ where: { id: fyId } });
  console.log('FY Sequence:', fy.invoiceSequence);
}

testSync().catch(console.error).finally(() => prisma.$disconnect());
