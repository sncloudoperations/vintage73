const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAllModules() {
  console.log('--- Testing POS Sale Numbering ---');
  try {
    // Simulate POS logic without the full transaction for simplicity, or just read the code's behavior
    const saleDate = new Date();
    const branchId = 1;
    
    const fy = await prisma.financialYear.findFirst({
      where: { startDate: { lte: saleDate }, endDate: { gte: saleDate }, isClosed: false }
    });

    if (fy) {
      const lastSale = await prisma.sale.findFirst({
        where: { branchId, financialYearId: fy.id },
        orderBy: { createdAt: 'desc' }
      });
      console.log(`POS Branch 1: FY Found (${fy.invoicePrefix}), Last Sale: ${lastSale?.invoiceNumber}`);
      
      let nextSeq;
      const startingSeq = fy.invoiceSequence || '001';
      if (lastSale && lastSale.invoiceNumber) {
        const prefix = fy.invoicePrefix || 'INV';
        const seqPart = lastSale.invoiceNumber.startsWith(prefix) ? lastSale.invoiceNumber.slice(prefix.length) : lastSale.invoiceNumber;
        nextSeq = (parseInt(seqPart, 10) + 1).toString().padStart(startingSeq.length, '0');
      } else {
        nextSeq = startingSeq;
      }
      console.log(`POS Expected Invoice: ${fy.invoicePrefix}${nextSeq}`);
    }
  } catch (e) { console.error(e); }

  console.log('\n--- Testing B2B Sale Numbering ---');
  try {
    const branchId = 2;
    const fy = await prisma.financialYear.findFirst({
        where: { startDate: { lte: new Date() }, endDate: { gte: new Date() }, isClosed: false }
    });
    if (fy) {
        const lastSale = await prisma.sale.findFirst({
          where: { branchId, financialYearId: fy.id },
          orderBy: { createdAt: 'desc' }
        });
        console.log(`B2B Branch 2: FY Found (${fy.invoicePrefix}), Last Sale: ${lastSale?.invoiceNumber}`);
        // ... same logic ...
    }
  } catch (e) { console.error(e); }
}

testAllModules().catch(console.error).finally(() => prisma.$disconnect());
