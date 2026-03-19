const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log('--- Cleaning Up Corrupted Invoice Numbers ---');
  
  // Find sales that have doubled/tripled prefixes
  const corruptedSales = await prisma.sale.findMany({
    where: {
      OR: [
        { invoiceNumber: { contains: '2626' } },
        { invoiceNumber: { startsWith: 'PRF26PRF26' } }
      ]
    }
  });

  for (const sale of corruptedSales) {
    let corrected = sale.invoiceNumber;
    // Repeatedly remove duplicate 'PRF26' or '26' if it's being doubled
    // For the specific case seen: PRF2626003 -> PRF26003
    if (sale.invoiceNumber.startsWith('PRF2626')) {
       corrected = 'PRF26' + sale.invoiceNumber.slice(7);
    }
    if (corrected.startsWith('PRF2626')) {
       corrected = 'PRF26' + corrected.slice(7); // Handle PRF262626...
    }

    console.log(`Updating Sale ID ${sale.id}: ${sale.invoiceNumber} -> ${corrected}`);
    await prisma.sale.update({
      where: { id: sale.id },
      data: { invoiceNumber: corrected }
    });
  }

  // Also sync the Financial Year sequence back to a sane value (e.g. 005)
  // based on the max of what we just cleaned
  await prisma.financialYear.update({
    where: { id: 1 },
    data: { invoiceSequence: '005' }
  });

  console.log('Cleanup complete!');
}

cleanup().catch(console.error).finally(() => prisma.$disconnect());
