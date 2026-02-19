const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyFix() {
    console.log("Testing Sale Creation with new logic...");
    try {
        // We need a valid branch, customer, product for a real test
        // But we can just try to run the logic in a transaction and rollback

        const branch = await prisma.branch.findFirst();
        if (!branch) {
            console.error("No branch found for testing.");
            return;
        }

        const product = await prisma.product.findFirst();
        if (!product) {
            console.error("No product found for testing.");
            return;
        }

        const customer = await prisma.customer.findFirst();

        const result = await prisma.$transaction(async (tx) => {
            const sale = await tx.sale.create({
                data: {
                    invoiceNumber: `TEST-FIX-${Date.now()}`,
                    customer: customer ? { connect: { id: customer.id } } : undefined,
                    paymentMethod: "Cash",
                    subTotal: 100,
                    taxAmount: 0,
                    totalAmount: 100,
                    roundOffAmount: 0,
                    paidAmount: 100,
                    balanceAmount: 0,
                    saleDate: new Date(),
                    branch: { connect: { id: branch.id } },
                    items: {
                        create: [{
                            productId: product.id,
                            quantity: 1,
                            unitPrice: 100,
                            total: 100,
                            taxAmount: 0,
                            taxRate: 0
                        }]
                    }
                }
            });
            console.log("Sale created successfully:", sale.invoiceNumber);
            throw new Error("Rollback for safety");
        });
    } catch (err) {
        if (err.message === "Rollback for safety") {
            console.log("Verification Success (Transaction rolled back as expected)");
        } else {
            console.error("Verification Failed:", err);
        }
    } finally {
        await prisma.$disconnect();
    }
}

verifyFix();
