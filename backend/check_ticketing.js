const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const cats = await prisma.ticketCategory.findMany();
    console.log('Ticket Categories:', cats);
    const tickets = await prisma.ticket.findMany({ take: 5, include: { category: true } });
    console.log('Sample Tickets:', JSON.stringify(tickets, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
