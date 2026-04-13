const { PrismaClient } = require('./prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const leadCols = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Lead'
    `;
    console.log('--- Lead Columns ---');
    console.log(leadCols);

    const followUpCols = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'FollowUp'
    `;
    console.log('--- FollowUp Columns ---');
    console.log(followUpCols);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
