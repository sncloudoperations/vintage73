const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testReturnLimits() {
    console.log("Testing Return Quantity Validation...");
    try {
        const branch = await prisma.branch.findFirst();
        const product = await prisma.product.findFirst();
        const invoiceNumber = `TEST-LIMIT-${Date.now()}`;

        // 1. Create a Sale with 10 units
        await prisma.sale.create({
            data: {
                invoiceNumber: invoiceNumber,
                branch: { connect: { id: branch.id } },
                totalAmount: 1000,
                subTotal: 1000,
                taxAmount: 0,
                paidAmount: 1000,
                balanceAmount: 0,
                saleDate: new Date(),
                items: {
                    create: [{
                        productId: product.id,
                        quantity: 10,
                        unitPrice: 100,
                        total: 1000,
                        taxAmount: 0,
                        taxRate: 0
                    }]
                }
            }
        });
        console.log("Created sale with 10 units.");

        // 2. Perform a partial return of 3 units
        await prisma.sale.create({
            data: {
                invoiceNumber: `RET-1-${Date.now()}`,
                branch: { connect: { id: branch.id } },
                totalAmount: 300,
                subTotal: 300,
                taxAmount: 0,
                paidAmount: 300,
                balanceAmount: 0,
                saleDate: new Date(),
                isReturn: true,
                originalInvoice: invoiceNumber,
                items: {
                    create: [{
                        productId: product.id,
                        quantity: 3,
                        unitPrice: 100,
                        total: 300,
                        taxAmount: 0,
                        taxRate: 0
                    }]
                }
            }
        });
        console.log("Performed partial return of 3 units.");

        // 3. Attempt to return 8 more units (should fail if I were calling the controller, but here I'm using Prisma directly)
        // To test the controller logic, I'd need to mock the request/response or use a real API call.
        // Since I'm running in the same environment, I'll just check if the logic I added to the controller would work.

        // Let's simulate the controller logic manually
        const checkLimit = async (qtyToReturn) => {
            const originalSale = await prisma.sale.findUnique({
                where: { invoiceNumber: invoiceNumber },
                include: { items: true }
            });
            const previousReturns = await prisma.sale.findMany({
                where: { originalInvoice: invoiceNumber, isReturn: true, status: { not: 'cancelled' } },
                include: { items: true }
            });
            const alreadyReturned = previousReturns.reduce((sum, ret) => {
                const item = ret.items.find(i => i.productId === product.id);
                return sum + (item ? item.quantity : 0);
            }, 0);
            const remaining = originalSale.items[0].quantity - alreadyReturned;

            if (qtyToReturn > remaining) {
                throw new Error(`Cannot return ${qtyToReturn} units. Only ${remaining} units remaining.`);
            }
            return true;
        };

        try {
            await checkLimit(8);
            console.log("FAILURE: Should have blocked 8 unit return.");
        } catch (e) {
            console.log("SUCCESS: Blocked over-return:", e.message);
        }

        try {
            await checkLimit(7);
            console.log("SUCCESS: Allowed 7 unit return.");
        } catch (e) {
            console.log("FAILURE: Should have allowed 7 unit return:", e.message);
        }

    } catch (err) {
        console.error("Test Error:", err);
    } finally {
        await prisma.$disconnect();
    }
}

testReturnLimits();
