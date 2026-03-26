const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const fy = await prisma.financialYear.findFirst({
      select: { id: true, branchId: true }
    });
    console.log('Successfully queried FinancialYear:', fy);
  } catch (error) {
    console.error('Query failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
