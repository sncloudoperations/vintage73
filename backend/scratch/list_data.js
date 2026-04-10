const { PrismaClient } = require('../prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ take: 5 });
  console.log('Users:', users.map(u => ({ username: u.username, role: u.role })));
  
  const branches = await prisma.branch.findMany({ take: 5 });
  console.log('Branches:', branches.map(b => ({ id: b.id, name: b.name, stockIncluded: b.stockIncluded })));
  
  const products = await prisma.product.findMany({ take: 5, include: { stocks: true } });
  console.log('Products:', products.map(p => ({ id: p.id, name: p.name, stock: p.stocks })));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
