const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany();
    const branchId = 1; // branch1

    console.log(`Setting up stock for branch ${branchId}...`);

    for (const product of products) {
        await prisma.productStock.upsert({
            where: {
                branchId_productId: {
                    branchId: branchId,
                    productId: product.id
                }
            },
            update: {
                quantity: 100
            },
            create: {
                branchId: branchId,
                productId: product.id,
                quantity: 100
            }
        });
        console.log(`Updated stock for ${product.name} to 100`);
    }

    process.exit(0);
}

main();
