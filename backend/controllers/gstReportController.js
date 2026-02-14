const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { startOfMonth, endOfMonth, startOfDay, endOfDay } = require('date-fns');

// Helper to get date range
const getDateRange = (period, customStartDate, customEndDate) => {
    let startDate, endDate;
    const now = new Date();

    if (period === 'this_month') {
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
    } else if (period === 'last_month') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate = startOfMonth(lastMonth);
        endDate = endOfMonth(lastMonth);
    } else if (customStartDate && customEndDate) {
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
    } else {
        // Default to this month
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
    }

    return {
        gte: startOfDay(startDate),
        lte: endOfDay(endDate)
    };
};

exports.getGSTR1 = asyncHandler(async (req, res) => {
    const { period, startDate, endDate, branchId } = req.query;
    const dateFilter = getDateRange(period, startDate, endDate);

    const where = {
        saleDate: dateFilter,
        status: 'completed', // Only completed sales
    };

    if (branchId) where.branchId = parseInt(branchId);

    const sales = await prisma.sale.findMany({
        where,
        include: {
            customer: true,
            items: {
                include: { product: true }
            }
        },
        orderBy: { saleDate: 'asc' } // GSTR-1 usually chronological
    });

    // Categorize into B2B and B2C
    const b2b = [];
    const b2c = [];

    for (const sale of sales) {
        // Basic Logic: If customer has GSTIN, it's B2B. Else B2C.
        const hasGst = sale.customer && sale.customer.gstNumber && sale.customer.gstNumber.trim() !== '';

        const saleData = {
            ...sale,
            invoiceDate: sale.saleDate.toISOString().split('T')[0],
            placeOfSupply: sale.customer?.state || 'Local', // Fallback
            gstin: sale.customer?.gstNumber || '',
            customerName: sale.customer?.name || 'Walk-in Customer',
        };

        if (hasGst) {
            b2b.push(saleData);
        } else {
            b2c.push(saleData);
        }
    }

    res.json({
        period: { startDate, endDate },
        b2b,
        b2c,
        summary: {
            totalB2B: b2b.length,
            totalB2BValue: b2b.reduce((sum, s) => sum + Number(s.totalAmount), 0),
            totalB2C: b2c.length,
            totalB2CValue: b2c.reduce((sum, s) => sum + Number(s.totalAmount), 0),
        }
    });
});

exports.getGSTR3B = asyncHandler(async (req, res) => {
    const { period, startDate, endDate, branchId } = req.query;
    const dateFilter = getDateRange(period, startDate, endDate);

    const where = {
        saleDate: dateFilter,
        status: 'completed'
    };
    if (branchId) where.branchId = parseInt(branchId);

    const sales = await prisma.sale.findMany({
        where,
        include: { items: true, customer: true }
    });

    let totalTaxable = 0;
    let totalIGST = 0;
    let totalCGST = 0;
    let totalSGST = 0;

    // Need company state to determine Local vs Interstate
    const company = await prisma.companyProfile.findFirst();
    const companyState = company?.state?.toLowerCase() || '';

    for (const sale of sales) {
        const taxable = Number(sale.subTotal);
        const tax = Number(sale.taxAmount);

        totalTaxable += taxable;

        // Determine Tax Split
        const customerState = sale.customer?.state?.toLowerCase() || companyState; // Default to local if unknown
        const isLocal = customerState === companyState;

        if (isLocal) {
            totalCGST += tax / 2;
            totalSGST += tax / 2;
        } else {
            totalIGST += tax;
        }
    }

    res.json({
        outwardSupplies: {
            taxableValue: totalTaxable,
            igst: totalIGST,
            cgst: totalCGST,
            sgst: totalSGST,
            cess: 0, // Not implemented yet
            totalTax: totalIGST + totalCGST + totalSGST
        }
    });
});

exports.getHSNSummary = asyncHandler(async (req, res) => {
    const { period, startDate, endDate, branchId } = req.query;
    const dateFilter = getDateRange(period, startDate, endDate);

    const where = {
        sale: {
            saleDate: dateFilter,
            status: 'completed'
        }
    };
    if (branchId) where.sale.branchId = parseInt(branchId);

    // Fetch all sale items 
    const items = await prisma.saleItem.findMany({
        where,
        include: {
            product: true,
            sale: true // to get state for tax split if needed
        }
    });

    // Group by HSN
    const hsnMap = {};

    for (const item of items) {
        const hsn = item.product.hsnCode || 'NA';
        const uqc = item.product.unit || 'NOS';

        if (!hsnMap[hsn]) {
            hsnMap[hsn] = {
                hsnCode: hsn,
                description: item.product.name, // Just taking one name, ideally distinct descriptions
                uqc,
                totalQuantity: 0,
                totalValue: 0, // Total Invoice Value (incl tax)
                taxableValue: 0,
                igst: 0,
                cgst: 0,
                sgst: 0,
                cess: 0
            };
        }

        // Aggregation
        const total = Number(item.total);
        const taxable = Number(item.total) - Number(item.taxAmount);
        const tax = Number(item.taxAmount);

        hsnMap[hsn].totalQuantity += item.quantity;
        hsnMap[hsn].totalValue += total;
        hsnMap[hsn].taxableValue += taxable;

        hsnMap[hsn].cgst += tax / 2;
        hsnMap[hsn].sgst += tax / 2;
    }

    const hsnSummary = Object.values(hsnMap);

    res.json(hsnSummary);
});
