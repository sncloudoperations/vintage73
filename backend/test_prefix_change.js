const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPrefixChange() {
  const fyId = 1;
  const branchId = 1;
  const newPrefix = "PRF26";

  console.log('--- Updating FY Prefix to ' + newPrefix + ' ---');
  await prisma.financialYear.update({
    where: { id: fyId },
    data: { invoicePrefix: newPrefix }
  });

  const fy = await prisma.financialYear.findUnique({ where: { id: fyId } });
  
  // Simulation of controller logic
  const last = await prisma.sale.findFirst({
    where: { 
        branchId: branchId, 
        financialYearId: fyId,
        invoiceNumber: { startsWith: fy.invoicePrefix }
    },
    orderBy: { createdAt: 'desc' }
  });

  let nextSeq;
  const start = fy.invoiceSequence || '001';
  if (last && last.invoiceNumber) {
    const seqPart = last.invoiceNumber.slice(fy.invoicePrefix.length);
    nextSeq = (parseInt(seqPart, 10) + 1).toString().padStart(start.length, '0');
  } else {
    nextSeq = start;
  }

  const invoiceNumber = fy.invoicePrefix + nextSeq;
  console.log('Generated Invoice:', invoiceNumber);

  if (invoiceNumber.startsWith(newPrefix)) {
    console.log('SUCCESS: Prefix updated correctly');
  } else {
    console.log('FAILURE: Prefix did not update');
  }
}

testPrefixChange().catch(console.error).finally(() => prisma.$disconnect());
