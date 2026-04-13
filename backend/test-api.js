const { PrismaClient } = require('./prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('--- Testing Lead query ---');
    const lead = await prisma.lead.findFirst({
        select: { id: true, outcome: true, lastFollowUpDate: true }
    });
    console.log('Lead sample:', lead);

    console.log('--- Testing FollowUp query ---');
    const followUp = await prisma.followUp.findFirst({
        select: { id: true, outcome: true }
    });
    console.log('FollowUp sample:', followUp);
  } catch (err) {
    console.error('❌ QUERY ERROR:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
