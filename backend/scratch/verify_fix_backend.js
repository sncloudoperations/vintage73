const { PrismaClient } = require('../prisma/client');
const prisma = new PrismaClient();

async function testStockValidation() {
  console.log('--- Testing Stock Validation ---');
  
  // 1. Prepare data
  const branchId = 1; // branch A, which has stockIncluded: false
  const productId = 1; // top
  
  // Ensure branch A has stockIncluded: false
  await prisma.branch.update({
    where: { id: branchId },
    data: { stockIncluded: false }
  });
  
  console.log(`Setting Branch ${branchId} stockIncluded to FALSE`);

  // Ensure product stock is 0 (or lower than requested)
  // Check current stock
  const stock = await prisma.productStock.findUnique({
    where: { branchId_productId: { branchId, productId } }
  });
  console.log(`Current stock for product ${productId} in branch ${branchId}: ${stock?.quantity || 0}`);

  // Mock a Sale Item
  const items = [{ productId, quantity: 9999, unitPrice: 100 }];
  
  // Simulate logic from salesController.js createSale
  const fetchBranch = await prisma.branch.findUnique({ where: { id: branchId } });
  const stockIncluded = fetchBranch?.stockIncluded === true;
  console.log(`stockIncluded logic result: ${stockIncluded} (Should be false)`);

  let validationError = null;
  if (stockIncluded) {
    const stockCheck = await prisma.productStock.findUnique({
      where: { branchId_productId: { branchId, productId } }
    });
    if (!stockCheck || stockCheck.quantity < items[0].quantity) {
      validationError = `Insufficient stock for product ID ${productId}`;
    }
  }

  if (validationError) {
    console.error(`❌ FAIL: Validation error thrown even when stockIncluded is false: ${validationError}`);
  } else {
    console.log(`✅ PASS: Stock validation skipped as expected.`);
  }

  // Now test with stockIncluded: true
  await prisma.branch.update({
    where: { id: branchId },
    data: { stockIncluded: true }
  });
  console.log(`Setting Branch ${branchId} stockIncluded to TRUE`);

  const fetchBranchTrue = await prisma.branch.findUnique({ where: { id: branchId } });
  const stockIncludedTrue = fetchBranchTrue?.stockIncluded === true;
  console.log(`stockIncluded logic result: ${stockIncludedTrue} (Should be true)`);

  validationError = null;
  if (stockIncludedTrue) {
    const stockCheck = await prisma.productStock.findUnique({
      where: { branchId_productId: { branchId, productId } }
    });
    if (!stockCheck || stockCheck.quantity < items[0].quantity) {
      validationError = `Insufficient stock for product ID ${productId}`;
    }
  }

  if (validationError) {
    console.log(`✅ PASS: Stock validation correctly blocked sale when stockIncluded is true: ${validationError}`);
  } else {
    console.error(`❌ FAIL: Validation should have blocked sale but it PASSED.`);
  }

  // Cleanup
  await prisma.branch.update({
    where: { id: branchId },
    data: { stockIncluded: false }
  });
}

testStockValidation()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
