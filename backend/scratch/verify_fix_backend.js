const { PrismaClient } = require('../prisma/client');
const prisma = new PrismaClient();

async function testStockValidation() {
  console.log('--- Testing Stock Validation (Truthy Checks) ---');
  
  // 1. Prepare data
  const branchId = 1; // branch A
  const productId = 1; // top
  
  const testCases = [
    { label: 'FALSE', value: false, expectValidation: false },
    { label: 'TRUE', value: true, expectValidation: true },
    { label: 'NULL', value: null, expectValidation: false },
  ];

  for (const tc of testCases) {
    console.log(`\nTesting with stockIncluded = ${tc.label}`);
    
    await prisma.branch.update({
      where: { id: branchId },
      data: { stockIncluded: tc.value }
    });

    const fetchBranch = await prisma.branch.findUnique({ where: { id: branchId } });
    
    // THE LOGIC UNDER TEST (as in salesController.js)
    const stockIncluded = !!fetchBranch?.stockIncluded;
    console.log(`Logic check result (!!fetchBranch?.stockIncluded): ${stockIncluded}`);

    const items = [{ productId, quantity: 9999 }];
    let validationError = null;

    if (stockIncluded) {
      const stockCheck = await prisma.productStock.findUnique({
        where: { branchId_productId: { branchId, productId } }
      });
      if (!stockCheck || stockCheck.quantity < items[0].quantity) {
        validationError = `Insufficient stock`;
      }
    }

    if (tc.expectValidation) {
       if (validationError) {
         console.log(`✅ PASS: Correctly blocked as expected.`);
       } else {
         console.error(`❌ FAIL: Should have blocked but PASSED.`);
       }
    } else {
       if (validationError) {
         console.error(`❌ FAIL: Blocked even though validation should be skipped.`);
       } else {
         console.log(`✅ PASS: Correctly skipped as expected.`);
       }
    }
  }

  // Final cleanup
  await prisma.branch.update({
    where: { id: branchId },
    data: { stockIncluded: false }
  });
}

testStockValidation()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
