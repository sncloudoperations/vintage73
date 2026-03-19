const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, branchId: true, branch: { select: { name: true, stockIncluded: true } } }
  });
  console.log('Users and their Branches:', JSON.stringify(users, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
