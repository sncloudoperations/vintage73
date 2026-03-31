const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.ticketHistory.deleteMany();
    await prisma.ticketReassignRequest.deleteMany();
    await prisma.ticket.deleteMany();
    console.log('Successfully cleared ticketing data');
  } catch (err) {
    console.error('Error clearing data:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
