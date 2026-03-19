const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testIndependentSequencing() {
  const saleDate = new Date();
  
  // Find the active FY (id: 1)
  const fyId = 1;
  const branch1Id = 1;
  const branch2Id = 2;

  console.log('--- Checking Branch 1 last sale ---');
  const lastB1 = await prisma.sale.findFirst({
    where: { branchId: branch1Id, financialYearId: fyId },
    orderBy: { createdAt: 'desc' }
  });
  console.log('Branch 1 Last:', lastB1?.invoiceNumber || 'NONE');

  console.log('\n--- Checking Branch 2 last sale ---');
  const lastB2 = await prisma.sale.findFirst({
    where: { branchId: branch2Id, financialYearId: fyId },
    orderBy: { createdAt: 'desc' }
  });
  console.log('Branch 2 Last:', lastB2?.invoiceNumber || 'NONE');

  // Logic simulation
  const prefix = "INV26";
  const startSeq = "001";
  
  const getNext = (last) => {
    if (!last) return startSeq;
    const seqPart = last.startsWith(prefix) ? last.slice(prefix.length) : last;
    return (parseInt(seqPart, 10) + 1).toString().padStart(3, '0');
  };

  console.log('\n--- Simulation ---');
  console.log('Next for Branch 1:', prefix + getNext(lastB1?.invoiceNumber));
  console.log('Next for Branch 2:', prefix + getNext(lastB2?.invoiceNumber));
}

testIndependentSequencing().catch(console.error).finally(() => prisma.$disconnect());
