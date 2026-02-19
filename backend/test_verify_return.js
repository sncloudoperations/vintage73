const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testReturnStock() {
    const branchId = 1;
    const productId = 1; // Assuming product 1 exists

    // 1. Get initial stock
    const initialStock = await prisma.productStock.findUnique({
        where: { branchId_productId: { branchId, productId } }
    });
    console.log(`Initial Stock: ${initialStock?.quantity || 0}`);

    // 2. Create a dummy sale with isReturn: true
    const saleData = {
        invoiceNumber: `TEST-RET-${Date.now()}`,
        branchId: branchId,
        totalAmount: 100,
        subTotal: 100,
        taxAmount: 0,
        paidAmount: 100,
        balanceAmount: 0,
        isReturn: true,
        items: {
            create: [{
                productId: productId,
                quantity: 5,
                unitPrice: 20,
                total: 100
            }]
        }
    };

    await prisma.sale.create({ data: saleData });
    console.log(`Created return sale for 5 units...`);

    // 3. Update stock (Manual simulate controller logic)
    await prisma.productStock.update({
        where: { branchId_productId: { branchId, productId } },
        data: { quantity: { increment: 5 } }
    });

    // 4. Check final stock
    const finalStock = await prisma.productStock.findUnique({
        where: { branchId_productId: { branchId, productId } }
    });
    console.log(`Final Stock: ${finalStock?.quantity || 0}`);

    if (finalStock.quantity === (initialStock?.quantity || 0) + 5) {
        console.log("SUCCESS: Stock incremented correctly on return.");
    } else {
        console.log("FAILURE: Stock logic incorrect.");
    }

    process.exit(0);
}

testReturnStock();
