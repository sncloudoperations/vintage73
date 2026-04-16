const prisma = require('../config/prisma');

async function consolidate() {
  const advances = await prisma.advance.findMany();
  
  // Group by customerId
  const grouped = {};
  for (const adv of advances) {
    if (!grouped[adv.customerId]) {
      grouped[adv.customerId] = {
        totalAmount: 0,
        usedAmount: 0,
        balance: 0,
        ids: []
      };
    }
    grouped[adv.customerId].totalAmount += Number(adv.totalAmount);
    grouped[adv.customerId].usedAmount += Number(adv.usedAmount);
    grouped[adv.customerId].balance += Number(adv.balance);
    grouped[adv.customerId].ids.push(adv.id);
  }

  for (const customerId in grouped) {
    const data = grouped[customerId];
    if (data.ids.length > 1) {
      console.log(`Consolidating ${data.ids.length} rows for Customer ${customerId}...`);
      
      // Update the first one
      await prisma.advance.update({
        where: { id: data.ids[0] },
        data: {
          totalAmount: data.totalAmount,
          usedAmount: data.usedAmount,
          balance: data.balance
        }
      });
      
      // Delete the rest
      const toDelete = data.ids.slice(1);
      await prisma.advance.deleteMany({
        where: { id: { in: toDelete } }
      });
      console.log(`Deleted ${toDelete.length} duplicate rows.`);
    }
  }
}

consolidate().catch(console.error).finally(() => prisma.$disconnect());
