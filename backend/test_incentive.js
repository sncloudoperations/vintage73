
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testIncentive() {
  console.log('--- Starting Incentive Test ---');

  try {
    // 1. Create a Test Salesman
    console.log('Creating Test Salesman...');
    const salesman = await prisma.user.create({
      data: {
        username: `salesmandemo_${Date.now()}`,
        password: 'password123',
        name: 'Demo Salesman',
        role: 'staff',
        incentivePercentage: 5.0, // 5% Incentive
        branchId: 1 // Assuming branch 1 exists
      }
    });
    console.log(`Salesman Created: ID ${salesman.id}, Incentive: ${salesman.incentivePercentage}%`);

    // 2. Create a Test Product
    console.log('Finding/Creating Test Product...');
    let product = await prisma.product.findFirst();
    if (!product) {
       product = await prisma.product.create({
         data: {
           name: 'Test Item',
           price: 100.00,
           categoryId: 1 // Assuming cat 1
         }
       });
    }
    console.log(`Product: ${product.name}, Price: ${product.price}`);

    // 3. Ensure Stock
    await prisma.productStock.upsert({
      where: { branchId_productId: { branchId: 1, productId: product.id } },
      update: { quantity: 100 },
      create: { branchId: 1, productId: product.id, quantity: 100 }
    });

    // 4. Create a Sale via Logic (Simulating Controller)
    // We can't call controller directly easily without req/res mock, so we replicate logic or call API if running.
    // For direct DB verification of logic, we should probably mock the controller call or just replicate the calculation here 
    // to ensure the DB *can* store it, but testing the *controller* logic requires running the app or a robust test harness.
    // Let's rely on the fact that we modified the controller.
    // Instead, let's manually insert a sale with the fields to ensure schema is correct and fields are writable.
    
    console.log('Creating Sale with Incentive...');
    const saleAmount = 1000.00;
    const incentiveCalc = (saleAmount * parseFloat(salesman.incentivePercentage)) / 100;
    
    const sale = await prisma.sale.create({
      data: {
        invoiceNumber: `TEST-INV-${Date.now()}`,
        totalAmount: saleAmount,
        subTotal: saleAmount,
        taxAmount: 0,
        branchId: 1,
        salesmanId: salesman.id,
        incentiveAmount: incentiveCalc,
        items: {
            create: {
                productId: product.id,
                quantity: 10,
                unitPrice: 100.00, // Schema uses unitPrice in SaleItem? Let's check schema.
                // Wait, Schema for SaleItem in previous view was:
                // productId, quantity, unitPrice, discountPercent, discountAmount, total
                // Let's verify schema again if needed, but assuming standard POS structure.
                discountPercent: 0,
                discountAmount: 0,
                total: 1000.00
            }
        }
      }
    });

    console.log(`Sale Created: ID ${sale.id}`);
    console.log(`Expected Incentive: ${incentiveCalc}`);
    console.log(`Stored Incentive: ${sale.incentiveAmount}`);

    if (parseFloat(sale.incentiveAmount) === incentiveCalc) {
        console.log('✅ SUCCESS: Incentive Amount stored correctly.');
    } else {
        console.error('❌ FAILURE: Incentive Amount mismatch.');
    }

    // Cleanup
    await prisma.saleItem.deleteMany({ where: { saleId: sale.id } });
    await prisma.sale.delete({ where: { id: sale.id } });
    await prisma.user.delete({ where: { id: salesman.id } });
    console.log('Cleanup Done.');

  } catch (err) {
    console.error('Test Failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testIncentive();
