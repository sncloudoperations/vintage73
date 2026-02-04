const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'CompanyProfile'
    `;
    console.log('CompanyProfile columns:', JSON.stringify(columns, null, 2));

    const gstColumns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'GSTSettings'
    `;
    console.log('GSTSettings columns:', JSON.stringify(gstColumns, null, 2));

    const company = await prisma.companyProfile.findFirst();
    console.log('Company Profile fetch success:', company ? 'Yes' : 'No');
  } catch (e) {
    console.error('Error during diagnostic:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
