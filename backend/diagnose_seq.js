const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnose() {
  console.log('--- Financial Year Table ---');
  const fys = await prisma.financialYear.findMany({
    orderBy: { startDate: 'desc' }
  });
  fys.forEach(fy => {
    console.log(`ID: ${fy.id}, Name: ${fy.name}, Prefix: ${fy.invoicePrefix}, Current Seq: ${fy.invoiceSequence}, BranchID: ${fy.branchId}, DATES: ${fy.startDate.toISOString().slice(0,10)} to ${fy.endDate.toISOString().slice(0,10)}`);
  });

  console.log('\n--- Recent Invoices (Tax Invoices) ---');
  const sales = await prisma.sale.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { invoiceNumber: true, branchId: true, financialYearId: true, createdAt: true, saleDate: true }
  });
  sales.forEach(s => {
    console.log(`Invoice: ${s.invoiceNumber}, Branch: ${s.branchId}, FY_ID: ${s.financialYearId}, SaleDate: ${s.saleDate.toISOString().slice(0,10)}, Created: ${s.createdAt}`);
  });
}

diagnose().catch(console.error).finally(() => prisma.$disconnect());
