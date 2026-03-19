const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const branch = await prisma.branch.findUnique({
    where: { id: 1 },
    select: { id: true, name: true, stockIncluded: true }
  });
  console.log('Branch 1:', branch);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
