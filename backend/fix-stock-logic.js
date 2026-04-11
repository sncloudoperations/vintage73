const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting POS Stock Logic Fix Script (QuickPOS)...');
  console.log('-----------------------------------------');

  try {
    // 1. Fetch all branches
    const branches = await prisma.branch.findMany();
    console.log(`✔ Found ${branches.length} branches in the database.`);

    let fixedCount = 0;
    let checkedCount = 0;

    for (const branch of branches) {
      checkedCount++;
      const currentVal = branch.stockIncluded;
      
      console.log(`Checking Branch [ID: ${branch.id}, Name: ${branch.name}] - stockIncluded: ${currentVal}`);

      // 2. Validate and Fix Data
      // Requirement: If stockIncluded is null or undefined, set to false (disabled)
      if (currentVal === null || currentVal === undefined) {
        console.log(`⚠️  Branch ${branch.id} has invalid stockIncluded value (${currentVal}). Fixing to false...`);
        
        await prisma.branch.update({
          where: { id: branch.id },
          data: { stockIncluded: false }
        });
        
        fixedCount++;
        console.log(`✅ Branch ${branch.id} updated successfully.`);
      } else {
        console.log(`✔ Branch ${branch.id} is consistent (value: ${currentVal}).`);
      }
    }

    console.log('-----------------------------------------');
    console.log('🏁 Execution Summary:');
    console.log(`✔ Branches checked: ${checkedCount}`);
    console.log(`✔ Invalid values fixed: ${fixedCount}`);
    console.log(`✔ Logic verified: All branches now have concrete boolean values.`);
    console.log('-----------------------------------------');
    console.log('💡 Note: POS controllers in quickpos/inventory/backend have been hardened to use strict check (=== true).');
    console.log('Any branch set to false (or previously null/undefined) will now skip stock validation.');

  } catch (error) {
    console.error('❌ Error during script execution:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
