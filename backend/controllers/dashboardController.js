const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

exports.getDashboardStats = asyncHandler(async (req, res) => {
    const { branchId: queryBranchId } = req.query;
    const user = req.user;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // --- BRANCH ENFORCEMENT & ISOLATION ---
    let branchId = queryBranchId;
    const isGlobalAdmin = user?.role === 'admin' && !user?.branchId;

    // If not global admin, they are strictly locked to their assigned branch
    if (!isGlobalAdmin) {
        if (!user?.branchId) {
            res.status(403);
            throw new Error('Access denied. No branch assigned to this account.');
        }
        branchId = user.branchId;
    }
    // If admin but didn't specify branchId, branchId remains undefined (GLOBAL VIEW)

    const parsedBranchId = branchId && !isNaN(parseInt(branchId)) ? parseInt(branchId) : undefined;
    const where = parsedBranchId ? { branchId: parsedBranchId } : {};

    // 1. Sales Metrics
    let totalSales = 0;
    let todaySales = 0;
    let totalOrders = 0;
    let todaySalesCount = 0;

    try {
        const totalSalesAgg = await prisma.sale.aggregate({ where, _sum: { totalAmount: true } });
        totalSales = Number(totalSalesAgg._sum.totalAmount) || 0;

        const todaySalesAgg = await prisma.sale.aggregate({
            where: { ...where, saleDate: { gte: today } },
            _sum: { totalAmount: true }
        });
        todaySales = Number(todaySalesAgg._sum.totalAmount) || 0;

        todaySalesCount = await prisma.sale.count({
            where: { ...where, saleDate: { gte: today } }
        });
        totalOrders = await prisma.sale.count({ where });
    } catch (e) {
        // Silent catch or log to monitoring service in production
    }

    // 2. Inventory Metrics
    let totalProducts = 0;
    let inStockProducts = 0;
    let stockBalance = [];

    try {
        totalProducts = await prisma.product.count();
        inStockProducts = await prisma.productStock.count({
            where: {
                ...(parsedBranchId ? { branchId: parsedBranchId } : {}),
                quantity: { gt: 0 }
            }
        });

        const stockBalanceRaw = await prisma.productStock.findMany({
            where: { ...(parsedBranchId ? { branchId: parsedBranchId } : {}) },
            orderBy: { quantity: 'asc' },
            take: 5,
            include: { product: true }
        });

        stockBalance = stockBalanceRaw.map(s => ({
            name: s.product ? s.product.name : 'Unknown Product',
            category: (s.product && s.product.categoryName) ? s.product.categoryName : 'Uncategorized',
            stock: s.quantity,
            price: s.product ? Number(s.product.price) : 0
        }));
    } catch (e) {
        console.error("Dashboard Inventory metrics error:", e);
    }

    // 3. Customer Metrics
    let totalCustomers = 0;
    let activeCustomers = 0;
    try {
        totalCustomers = await prisma.customer.count({
            where: parsedBranchId ? { branchId: parsedBranchId } : {}
        });

        const customerWhere = {};
        if (parsedBranchId) {
            customerWhere.branchId = parsedBranchId;
            customerWhere.sales = { some: { branchId: parsedBranchId } };
        } else {
            customerWhere.sales = { some: {} };
        }

        activeCustomers = await prisma.customer.count({ where: customerWhere });
    } catch (e) {
        console.error("Dashboard Customer metrics error:", e);
    }

    // 4. Financial Summary
    let totalReceipts = 0;
    let totalExpenses = 0;
    let totalPurchases = 0;

    try {
        const receiptsAgg = await prisma.payment.aggregate({
            where: { ...where, type: 'receipt' },
            _sum: { amount: true }
        });
        totalReceipts = Number(receiptsAgg._sum.amount) || 0;
    } catch (e) { console.error("Dashboard Receipts error:", e); }

    try {
        const expensesAgg = await prisma.expense.aggregate({ where, _sum: { amount: true } });
        totalExpenses = Number(expensesAgg._sum.amount) || 0;
    } catch (e) { console.error("Dashboard Expenses error:", e); }

    try {
        const purchasesAgg = await prisma.purchase.aggregate({
            where,
            _sum: { totalAmount: true }
        });
        totalPurchases = Number(purchasesAgg._sum.totalAmount) || 0;
    } catch (e) { console.error("Dashboard Purchases error:", e); }

    const netProfit = totalSales - totalExpenses - totalPurchases;

    // 5. Recent Sales
    let recentSales = [];
    try {
        recentSales = await prisma.sale.findMany({
            where,
            take: 5,
            orderBy: { saleDate: 'desc' },
            include: {
                customer: true,
                items: {
                    include: { product: true }
                }
            }
        });
    } catch (e) { console.error("Dashboard Recent sales error:", e); }

    // 6. Fast Moving Products
    let fastMovingProducts = [];
    try {
        const fastMovingRaw = await prisma.saleItem.groupBy({
            by: ['productId'],
            _sum: { quantity: true },
            where: { sale: where },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 5
        });

        fastMovingProducts = await Promise.all(fastMovingRaw.map(async item => {
            const product = await prisma.product.findUnique({
                where: { id: item.productId },
                select: { name: true, categoryName: true, price: true }
            });
            return {
                name: product ? product.name : 'Unknown',
                category: product ? product.categoryName : 'Uncategorized',
                sold: item._sum.quantity || 0,
                price: product ? Number(product.price) : 0
            };
        }));
    } catch (e) { console.error("Dashboard Fast moving products error:", e); }

    res.json({
        sales: {
            total: totalSales,
            today: todaySales,
            count: totalOrders,
            todayCount: todaySalesCount
        },
        inventory: {
            totalProducts,
            inStock: inStockProducts,
            stockBalance
        },
        customers: {
            total: totalCustomers,
            active: activeCustomers
        },
        finance: {
            receipts: totalReceipts,
            expenses: totalExpenses,
            purchases: totalPurchases,
            netProfit
        },
        recentSales,
        fastMovingProducts,
        scope: parsedBranchId ? `Branch: ${parsedBranchId}` : "Global"
    });
});
