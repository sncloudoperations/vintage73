const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testBranchSequencing() {
  const saleDate = new Date();
  
  // Find active FY
  const fy = await prisma.financialYear.findFirst({
    where: { startDate: { lte: saleDate }, endDate: { gte: saleDate }, isClosed: false }
  });

  if (!fy) {
    console.log('No active Financial Year found. Test skipped.');
    return;
  }

  console.log(`Testing with FY: ${fy.name} (Prefix: ${fy.invoicePrefix}, Starting Seq: ${fy.invoiceSequence})`);

  const branches = [1, 2];
  for (const bId of branches) {
    const lastSale = await prisma.sale.findFirst({
      where: { branchId: bId, financialYearId: fy.id },
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true }
    });

    console.log(`Branch ${bId} Last Sale Invoice: ${lastSale ? lastSale.invoiceNumber : 'None'}`);
    
    let nextSeq;
    const startingSeq = fy.invoiceSequence || '001';
    
    if (lastSale && lastSale.invoiceNumber) {
      const prefix = fy.invoicePrefix || 'INV';
      const lastInvoiceNum = lastSale.invoiceNumber;
      const seqPart = lastInvoiceNum.startsWith(prefix) ? lastInvoiceNum.slice(prefix.length) : lastInvoiceNum;
      const lastNum = parseInt(seqPart, 10);
      nextSeq = (lastNum + 1).toString().padStart(startingSeq.length, '0');
    } else {
      nextSeq = startingSeq;
    }
    
    console.log(`Branch ${bId} Next Calculated Invoice: ${fy.invoicePrefix}${nextSeq}`);
  }
}

testBranchSequencing().catch(console.error).finally(() => prisma.$disconnect());
