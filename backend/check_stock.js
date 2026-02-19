const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const branches = await prisma.branch.findMany();
        console.log('--- BRANCHES ---');
        console.table(branches.map(b => ({ id: b.id, name: b.name })));

        const branch1 = branches.find(b => b.name.toLowerCase().includes('branch1'));
        if (branch1) {
            console.log(`\n--- STOCK FOR ${branch1.name} (ID: ${branch1.id}) ---`);
            const stocks = await prisma.productStock.findMany({
                where: { branchId: branch1.id },
                include: { product: true }
            });
            console.table(stocks.map(s => ({
                productId: s.productId,
                productName: s.product.name,
                quantity: s.quantity
            })));
        } else {
            console.log('\nBRANCH1 not found');
        }
    } catch (e) {
        console.error('Diagnostic failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
