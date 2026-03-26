const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const group = await prisma.accountGroup.findFirst({
      where: { name: 'Cash-in-Hand' }
    });
    console.log('Successfully found Cash-in-Hand group:', group);
  } catch (error) {
    console.error('Query failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
