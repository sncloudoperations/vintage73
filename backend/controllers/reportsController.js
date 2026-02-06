const prisma = require('../utils/prismaClient');

exports.getSalesReports = async (req, res) => {
  const { branchId, startDate, endDate } = req.query;
  try {
    const where = {};
    if (branchId) where.branchId = parseInt(branchId);
    if (startDate && endDate) {
      where.saleDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        customer: true,
        items: true
      },
      orderBy: {
        saleDate: 'desc'
      }
    });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDailyPaymentReport = async (req, res) => {
  try {
    const { date } = req.query;
    const searchDate = date ? new Date(date) : new Date();

    // Set range for the whole day
    const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));
    const { branchId } = req.query;

    const where = {
      paymentDate: {
        gte: startOfDay,
        lte: endOfDay
      }
    };
    if (branchId) where.branchId = parseInt(branchId);

    const payments = await prisma.payment.findMany({
      where
    });

    // Group by method
    const summary = payments.reduce((acc, p) => {
      const method = p.method || 'Other';
      if (!acc[method]) {
        acc[method] = { method, receipts: 0, payments: 0, net: 0 };
      }

      const amt = parseFloat(p.amount);
      if (p.type === 'receipt') {
        acc[method].receipts += amt;
        acc[method].net += amt;
      } else {
        acc[method].payments += amt;
        acc[method].net -= amt;
      }
      return acc;
    }, {});

    res.json(Object.values(summary));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getStockMovementRegister = async (req, res) => {
  const { productId, branchId, startDate, endDate } = req.query;

  if (!productId) {
    return res.status(400).json({ error: "Product ID is required for Stock Movement Register" });
  }

  try {
    const pId = parseInt(productId);
    const bId = branchId && branchId !== 'all' ? parseInt(branchId) : null;
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // 1. Calculate Opening Balance (Transactions BEFORE start date)
    const openingCriteria = {
      product: { id: pId },
      dateBefore: start
    };

    const getAggregates = async (beforeDate) => {
      // Purchases
      const purchases = await prisma.purchaseItem.findMany({
        where: {
          productId: pId,
          purchase: {
            purchaseDate: { lt: beforeDate },
            ...(bId ? { branchId: bId } : {})
          }
        },
        select: { quantity: true }
      });
      const purchaseIn = purchases.reduce((sum, item) => sum + item.quantity, 0);

      // Sales
      const sales = await prisma.saleItem.findMany({
        where: {
          productId: pId,
          sale: {
            saleDate: { lt: beforeDate },
            status: { not: 'cancelled' },
            ...(bId ? { branchId: bId } : {})
          }
        },
        include: { sale: { select: { isReturn: true } } }
      });
      const saleOut = sales.reduce((sum, item) => sum + (item.sale.isReturn ? 0 : item.quantity), 0);
      const saleReturnIn = sales.reduce((sum, item) => sum + (item.sale.isReturn ? item.quantity : 0), 0);

      // Transfers In
      const transfersIn = await prisma.stockTransferItem.findMany({
        where: {
          productId: pId,
          transfer: {
            transferDate: { lt: beforeDate },
            status: 'RECEIVED',
            ...(bId ? { toBranchId: bId } : {})
          }
        },
        select: { quantity: true }
      });
      const transferIn = transfersIn.reduce((sum, item) => sum + item.quantity, 0);

      // Transfers Out
      const transfersOut = await prisma.stockTransferItem.findMany({
        where: {
          productId: pId,
          transfer: {
            transferDate: { lt: beforeDate },
            status: { not: 'CANCELLED' },
            ...(bId ? { fromBranchId: bId } : {})
          }
        },
        select: { quantity: true }
      });
      const transferOut = transfersOut.reduce((sum, item) => sum + item.quantity, 0);

      // Delivery Challans (Assuming they reduce stock)
      const challans = await prisma.deliveryChallanItem.findMany({
        where: {
          productId: pId,
          challan: {
            challanDate: { lt: beforeDate },
            status: { not: 'cancelled' },
            ...(bId ? { branchId: bId } : {})
          }
        },
        select: { quantity: true }
      });
      const challanOut = challans.reduce((sum, item) => sum + item.quantity, 0);

      return (purchaseIn + transferIn + saleReturnIn) - (saleOut + transferOut + challanOut);
    };

    const openingStock = await getAggregates(start);

    // 2. Fetch Movements (Transactions WITHIN date range)
    const movements = [];

    // Purchases
    const pItems = await prisma.purchaseItem.findMany({
      where: {
        productId: pId,
        purchase: {
          purchaseDate: { gte: start, lte: end },
          ...(bId ? { branchId: bId } : {})
        }
      },
      include: { purchase: { include: { supplier: true } } }
    });
    pItems.forEach(item => {
      movements.push({
        date: item.purchase.purchaseDate,
        reference: item.purchase.invoiceNumber || `Pur #${item.purchase.id}`,
        type: 'Purchase',
        party: item.purchase.supplier?.name || 'Cash Supplier',
        inQty: item.quantity,
        outQty: 0
      });
    });

    // Sales
    const sItems = await prisma.saleItem.findMany({
      where: {
        productId: pId,
        sale: {
          saleDate: { gte: start, lte: end },
          status: { not: 'cancelled' },
          ...(bId ? { branchId: bId } : {})
        }
      },
      include: { sale: { include: { customer: true } } }
    });
    sItems.forEach(item => {
      const isReturn = item.sale.isReturn;
      movements.push({
        date: item.sale.saleDate,
        reference: item.sale.invoiceNumber,
        type: isReturn ? 'Sales Return' : 'Sale',
        party: item.sale.customer?.name || 'Walk-in Customer',
        inQty: isReturn ? item.quantity : 0,
        outQty: isReturn ? 0 : item.quantity
      });
    });

    // Transfers In
    const transIn = await prisma.stockTransferItem.findMany({
      where: {
        productId: pId,
        transfer: {
          transferDate: { gte: start, lte: end },
          status: 'RECEIVED',
          ...(bId ? { toBranchId: bId } : {})
        }
      },
      include: { transfer: { include: { fromBranch: true } } }
    });
    transIn.forEach(item => {
      movements.push({
        date: item.transfer.transferDate,
        reference: `Trf #${item.transfer.id}`,
        type: 'Transfer In',
        party: `From ${item.transfer.fromBranch.name}`,
        inQty: item.quantity,
        outQty: 0
      });
    });

    // Transfers Out
    const transOut = await prisma.stockTransferItem.findMany({
      where: {
        productId: pId,
        transfer: {
          transferDate: { gte: start, lte: end },
          status: { not: 'CANCELLED' },
          ...(bId ? { fromBranchId: bId } : {})
        }
      },
      include: { transfer: { include: { toBranch: true } } }
    });
    transOut.forEach(item => {
      movements.push({
        date: item.transfer.transferDate,
        reference: `Trf #${item.transfer.id}`,
        type: 'Transfer Out',
        party: `To ${item.transfer.toBranch.name}`,
        inQty: 0,
        outQty: item.quantity
      });
    });

    // Challans
    const cItems = await prisma.deliveryChallanItem.findMany({
      where: {
        productId: pId,
        challan: {
          challanDate: { gte: start, lte: end },
          status: { not: 'cancelled' },
          ...(bId ? { branchId: bId } : {})
        }
      },
      include: { challan: { include: { customer: true } } }
    });
    cItems.forEach(item => {
      movements.push({
        date: item.challan.challanDate,
        reference: item.challan.challanNumber,
        type: 'Delivery Challan',
        party: item.challan.customer?.name || 'Manual Dispatch',
        inQty: 0,
        outQty: item.quantity
      });
    });

    // Sort movements by date
    movements.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    let currentBalance = openingStock;
    const result = movements.map(m => {
      currentBalance = currentBalance + m.inQty - m.outQty;
      return { ...m, balance: currentBalance };
    });

    res.json({
      openingStock,
      movements: result,
      closingStock: currentBalance
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.getCurrentStockBalance = async (req, res) => {
  const { branchId, categoryId } = req.query;
  try {
    const where = {};
    if (branchId && branchId !== 'all') where.branchId = parseInt(branchId);
    if (categoryId && categoryId !== 'all') {
      where.product = { categoryId: parseInt(categoryId) };
    }

    const stocks = await prisma.productStock.findMany({
      where,
      include: {
        product: {
          include: { category: true }
        }
      },
      orderBy: {
        product: { name: 'asc' }
      }
    });

    const result = stocks.map(s => ({
      productId: s.productId,
      productName: s.product.name,
      category: s.product.category?.name || 'Uncategorized',
      barcode: s.product.barcode,
      currentPrice: s.product.price,
      quantity: s.quantity,
      minStock: s.product.minStockLevel
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.getStockSummary = async (req, res) => {
  const { branchId, startDate, endDate, categoryId } = req.query;
  try {
    const bId = branchId && branchId !== 'all' ? parseInt(branchId) : null;
    const catId = categoryId && categoryId !== 'all' ? parseInt(categoryId) : null;
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // 1. Get all products (optionally filtered by category)
    const products = await prisma.product.findMany({
      where: catId ? { categoryId: catId } : {},
      select: { id: true, name: true, barcode: true, category: { select: { name: true } } }
    });

    const report = [];

    // For efficiency, we'll process in bulk or use a helper for each product
    // For now, let's use a simplified approach that reuses the logic
    // In a high-perf scenario, we would use raw SQL or complex groupBy
    for (const prod of products) {
      const pId = prod.id;

      // Helper to aggregate based on date range
      const getPeriodAggregation = async (sDate, eDate) => {
        const dateFilter = eDate ? { gte: sDate, lte: eDate } : { lt: sDate };

        const [purchases, sales, transIn, transOut, challans] = await Promise.all([
          prisma.purchaseItem.aggregate({
            where: { productId: pId, purchase: { purchaseDate: dateFilter, ...(bId ? { branchId: bId } : {}) } },
            _sum: { quantity: true }
          }),
          prisma.saleItem.findMany({
            where: { productId: pId, sale: { saleDate: dateFilter, status: { not: 'cancelled' }, ...(bId ? { branchId: bId } : {}) } },
            include: { sale: { select: { isReturn: true } } }
          }),
          prisma.stockTransferItem.aggregate({
            where: { productId: pId, transfer: { transferDate: dateFilter, status: 'RECEIVED', ...(bId ? { toBranchId: bId } : {}) } },
            _sum: { quantity: true }
          }),
          prisma.stockTransferItem.aggregate({
            where: { productId: pId, transfer: { transferDate: dateFilter, status: { not: 'CANCELLED' }, ...(bId ? { fromBranchId: bId } : {}) } },
            _sum: { quantity: true }
          }),
          prisma.deliveryChallanItem.aggregate({
            where: { productId: pId, challan: { challanDate: dateFilter, status: { not: 'cancelled' }, ...(bId ? { branchId: bId } : {}) } },
            _sum: { quantity: true }
          })
        ]);

        const pIn = purchases._sum.quantity || 0;
        const sOut = sales.reduce((sum, i) => sum + (i.sale.isReturn ? 0 : i.quantity), 0);
        const sReturnIn = sales.reduce((sum, i) => sum + (i.sale.isReturn ? i.quantity : 0), 0);
        const tIn = transIn._sum.quantity || 0;
        const tOut = transOut._sum.quantity || 0;
        const cOut = challans._sum.quantity || 0;

        return {
          in: pIn + tIn + sReturnIn,
          out: sOut + tOut + cOut
        };
      };

      // Calculate Opening
      const opening = await getPeriodAggregation(start, null);
      const openingStock = opening.in - opening.out;

      // Calculate Period Movement
      const period = await getPeriodAggregation(start, end);

      report.push({
        productId: pId,
        productName: prod.name,
        barcode: prod.barcode,
        category: prod.category?.name || 'Uncategorized',
        openingStock,
        periodIn: period.in,
        periodOut: period.out,
        closingStock: openingStock + period.in - period.out
      });
    }

    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
