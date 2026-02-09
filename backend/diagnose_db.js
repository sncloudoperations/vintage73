const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('Tables in database:', tables.map(t => t.table_name).join(', '));

    const bankColumns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Bank'
    `;
    console.log('Bank columns:', JSON.stringify(bankColumns, null, 2));

    const company = await prisma.companyProfile.findFirst({
      include: { bank: true }
    });
    console.log('Company Profile fetch with bank success:', company ? 'Yes' : 'No');
  } catch (e) {
    console.error('Error during diagnostic:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
