const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugDashboard() {
  console.log("Starting debug...");
  try {
    const branchId = undefined; // Test with undefined first (superuser view)
    // const branchId = 1; // You can uncomment to test specific branch

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parsedBranchId = branchId && !isNaN(parseInt(branchId)) ? parseInt(branchId) : undefined;
    const where = parsedBranchId ? { branchId: parsedBranchId } : {};

    console.log("Where clause:", JSON.stringify(where, null, 2));

    console.log("1. fetching Sales Metrics...");
    const totalSalesAgg = await prisma.sale.aggregate({ 
      where,
      _sum: { totalAmount: true } 
    }).catch(e => { console.error("Sales Agg Error:", e); throw e; });
    console.log("Sales Agg done.");

    console.log("2. fetching Inventory Metrics...");
    const inStockProducts = await prisma.productStock.count({ 
      where: { 
        branchId: parsedBranchId,
        quantity: { gt: 0 } 
      } 
    }).catch(e => { console.error("Stock Count Error:", e); throw e; });
    
    // Check stock balance query specifically
    console.log("Fetching stock balance...");
    const stockBalanceRaw = await prisma.productStock.findMany({
      where: {
        branchId: parsedBranchId
      },
      orderBy: { quantity: 'asc' },
      take: 5,
      include: { product: true }
    }).catch(e => { console.error("Stock Balance Error:", e); throw e; });
    console.log("Stock balance fetched. Mapping...");
    
    const stockBalance = stockBalanceRaw.map(s => {
        try {
            return {
                name: s.product ? s.product.name : 'Unknown Product',
                category: (s.product && s.product.categoryName) ? s.product.categoryName : 'Uncategorized',
                stock: s.quantity,
                price: s.product ? s.product.price : 0
            };
        } catch(err) {
            console.error("Map Error on item:", s);
            throw err;
        }
    });
    console.log("Inventory done.");

    console.log("3. fetching Customer Metrics...");
    const activeCustomers = await prisma.customer.count({ 
      where: { 
        ...where, 
        sales: { 
          some: { 
            branchId: parsedBranchId 
          } 
        } 
      } 
    }).catch(e => { console.error("Active Customer Error:", e); throw e; });
    console.log("Customers done.");

    console.log("4. fetching Financial Summary...");
    const receiptsAgg = await prisma.payment.aggregate({
      where: { ...where, type: 'receipt' },
      _sum: { amount: true }
    }).catch(e => { console.error("Receipts Error:", e); throw e; });

    const expensesAgg = await prisma.expense.aggregate({
      where,
      _sum: { amount: true }
    }).catch(e => { console.error("Expenses Error:", e); throw e; });

    // This is where I made changes
    console.log("Fetching Purchases Aggr...");
    const purchasesAgg = await prisma.purchase.aggregate({
      where,
      _sum: { totalAmount: true }
    }).catch(e => { console.error("Purchases Agg Error:", e); throw e; });
    console.log("Finance done.");

    console.log("DEBUG SUCCEEDED. No errors found in main queries.");

  } catch (error) {
    console.error("\n!!! DEBUG FAILED !!!");
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

debugDashboard();
