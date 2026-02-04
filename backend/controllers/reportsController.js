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
