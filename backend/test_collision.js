const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCollisionFix() {
  const invoiceNum = "TEST-COLLISION-001";
  
  console.log(`Attempting to create sale for Branch 1 with ${invoiceNum}...`);
  try {
    const s1 = await prisma.sale.create({
      data: {
        invoiceNumber: invoiceNum,
        branchId: 1,
        subTotal: 100,
        taxAmount: 10,
        totalAmount: 110,
        status: 'completed',
        isInvoice: true
      }
    });
    console.log('Branch 1 success:', s1.id);
  } catch (e) {
    console.error('Branch 1 failed:', e.message);
  }

  console.log(`Attempting to create sale for Branch 2 with ${invoiceNum}...`);
  try {
    const s2 = await prisma.sale.create({
      data: {
        invoiceNumber: invoiceNum,
        branchId: 2,
        subTotal: 100,
        taxAmount: 10,
        totalAmount: 110,
        status: 'completed',
        isInvoice: true
      }
    });
    console.log('Branch 2 success:', s2.id);
  } catch (e) {
    console.error('Branch 2 failed:', e.message);
  }
}

testCollisionFix().catch(console.error).finally(() => prisma.$disconnect());
