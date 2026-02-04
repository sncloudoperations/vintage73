const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting Branch Migration...');

  // 1. Create Default Branch (if not exists)
  let branch = await prisma.branch.findFirst({ where: { name: 'Main Branch' } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        name: 'Main Branch',
        address: 'Head Office',
        isActive: true
      }
    });
    console.log('Created Main Branch');
  } else {
    console.log('Main Branch already exists');
  }

  const branchId = branch.id;

  // 2. Link Users
  const userUpdate = await prisma.user.updateMany({
    where: { branchId: null },
    data: { branchId }
  });
  console.log(`Linked ${userUpdate.count} Users to Main Branch`);

  // 3. Link Customers
  const customerUpdate = await prisma.customer.updateMany({
    where: { branchId: null },
    data: { branchId }
  });
  console.log(`Linked ${customerUpdate.count} Customers to Main Branch`);

  // 4. Link Sales
  const saleUpdate = await prisma.sale.updateMany({
    where: { branchId: null },
    data: { branchId }
  });
  console.log(`Linked ${saleUpdate.count} Sales to Main Branch`);

  // 5. Link Purchases
  const purchaseUpdate = await prisma.purchase.updateMany({
    where: { branchId: null },
    data: { branchId }
  });
  console.log(`Linked ${purchaseUpdate.count} Purchases to Main Branch`);

  // 6. Link Expenses
  const expenseUpdate = await prisma.expense.updateMany({
    where: { branchId: null },
    data: { branchId }
  });
  console.log(`Linked ${expenseUpdate.count} Expenses to Main Branch`);

  // 7. Link Payments
  const paymentUpdate = await prisma.payment.updateMany({
    where: { branchId: null },
    data: { branchId }
  });
  console.log(`Linked ${paymentUpdate.count} Payments to Main Branch`);

  // 8. Migrate Stock
  const products = await prisma.product.findMany();
  let stockCreated = 0;
  for (const product of products) {
    // Check if stock entry already exists
    const existingStock = await prisma.productStock.findUnique({
      where: {
        branchId_productId: {
          branchId,
          productId: product.id
        }
      }
    });

    if (!existingStock) {
      await prisma.productStock.create({
        data: {
          branchId,
          productId: product.id,
          quantity: product.stock
        }
      });
      stockCreated++;
    }
  }
  console.log(`Migrated stock for ${stockCreated} products`);

  console.log('Branch Migration Completed successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
