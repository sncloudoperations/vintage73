const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnose() {
  const fyId = 1;
  const fy = await prisma.financialYear.findUnique({ where: { id: fyId } });
  console.log('FY Settings:', { prefix: fy.invoicePrefix, sequence: fy.invoiceSequence });

  const branches = [1, 2, 3, 4]; // Include a new one
  
  for (const bId of branches) {
    const last = await prisma.sale.findFirst({
      where: { branchId: bId, financialYearId: fyId },
      orderBy: { createdAt: 'desc' }
    });
    
    let next;
    const prefix = fy.invoicePrefix || 'INV';
    const start = fy.invoiceSequence || '001';
    
    if (last && last.invoiceNumber) {
      const seqPart = last.invoiceNumber.startsWith(prefix) ? last.invoiceNumber.slice(prefix.length) : last.invoiceNumber;
      next = (parseInt(seqPart, 10) + 1).toString().padStart(start.length, '0');
    } else {
      next = start;
    }
    
    console.log(`Branch ${bId}: Last=${last?.invoiceNumber || 'NONE'}, Predicted Next=${prefix + next}`);
  }
}

diagnose().catch(console.error).finally(() => prisma.$disconnect());
