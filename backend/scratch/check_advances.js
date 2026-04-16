const prisma = require('../config/prisma');

async function check() {
  const advances = await prisma.advance.findMany();
  console.log('Advances:', JSON.stringify(advances, null, 2));
  
  const customerIds = advances.map(a => a.customerId);
  const duplicates = customerIds.filter((item, index) => customerIds.indexOf(item) !== index);
  console.log('Duplicate CustomerIds:', duplicates);
}

check().catch(console.error).finally(() => prisma.$disconnect());
