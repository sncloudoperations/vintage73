const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const q = await prisma.quotation.findUnique({
    where: { id: 6 }, // The latest error was for quotation 6
    select: { id: true, branchId: true }
  });
  console.log('Quotation 6:', q);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
