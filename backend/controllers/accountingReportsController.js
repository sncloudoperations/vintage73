const prisma = require('../config/prisma');
const { calculateLedgerBalance } = require('./accountingController');
const asyncHandler = require('../middleware/asyncHandler');

// ==================== TRIAL BALANCE ====================

exports.getTrialBalance = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);

  const ledgers = await prisma.ledger.findMany({
    where: { isActive: true },
    include: { group: true },
    orderBy: { name: 'asc' }
  });

  // 1. Get Pre-Period Totals (Opening Balances)
  const preDebits = await prisma.journalEntry.groupBy({
    by: ['debitLedgerId'],
    _sum: { amount: true },
    where: {
      debitLedgerId: { not: null },
      voucher: { status: 'POSTED', ...(start ? { date: { lt: start } } : { id: -1 }) } // If no start, no pre-entries
    }
  });

  const preCredits = await prisma.journalEntry.groupBy({
    by: ['creditLedgerId'],
    _sum: { amount: true },
    where: {
      creditLedgerId: { not: null },
      voucher: { status: 'POSTED', ...(start ? { date: { lt: start } } : { id: -1 }) }
    }
  });

  // 2. Get Period Totals
  const periodDebits = await prisma.journalEntry.groupBy({
    by: ['debitLedgerId'],
    _sum: { amount: true },
    where: {
      debitLedgerId: { not: null },
      voucher: {
        status: 'POSTED',
        date: { gte: start || new Date(0), lte: end }
      }
    }
  });

  const periodCredits = await prisma.journalEntry.groupBy({
    by: ['creditLedgerId'],
    _sum: { amount: true },
    where: {
      creditLedgerId: { not: null },
      voucher: {
        status: 'POSTED',
        date: { gte: start || new Date(0), lte: end }
      }
    }
  });

  // Helper maps for quick lookup
  const preDebMap = new Map(preDebits.map(i => [i.debitLedgerId, Number(i._sum.amount || 0)]));
  const preCredMap = new Map(preCredits.map(i => [i.creditLedgerId, Number(i._sum.amount || 0)]));
  const perDebMap = new Map(periodDebits.map(i => [i.debitLedgerId, Number(i._sum.amount || 0)]));
  const perCredMap = new Map(periodCredits.map(i => [i.creditLedgerId, Number(i._sum.amount || 0)]));

  const trialBalance = ledgers.map(ledger => {
    const preDeb = preDebMap.get(ledger.id) || 0;
    const preCred = preCredMap.get(ledger.id) || 0;
    const perDeb = perDebMap.get(ledger.id) || 0;
    const perCred = perCredMap.get(ledger.id) || 0;

    let openingBalance = Number(ledger.openingBalance);
    // Adjust opening if a start date was provided
    if (start) {
      if (ledger.balanceType === 'DEBIT') {
        openingBalance += preDeb - preCred;
      } else {
        openingBalance += preCred - preDeb;
      }
    }

    const debitValue = perDeb;
    const creditValue = perCred;

    let closingBalance = 0;
    if (ledger.balanceType === 'DEBIT') {
      closingBalance = openingBalance + debitValue - creditValue;
    } else {
      closingBalance = openingBalance + creditValue - debitValue;
    }

    return {
      ledgerId: ledger.id,
      ledgerName: ledger.name,
      groupName: ledger.group.name,
      groupType: ledger.group.groupType,
      balanceType: ledger.balanceType,
      openingBalance,
      debit: debitValue,
      credit: creditValue,
      closingBalance
    };
  });

  const filteredResults = trialBalance.filter(item =>
    Math.abs(item.openingBalance) > 0.01 ||
    item.debit > 0 ||
    item.credit > 0 ||
    Math.abs(item.closingBalance) > 0.01
  );

  res.json({
    trialBalance: filteredResults,
    totalOpening: filteredResults.reduce((sum, i) => sum + i.openingBalance, 0),
    totalDebit: filteredResults.reduce((sum, i) => sum + i.debit, 0),
    totalCredit: filteredResults.reduce((sum, i) => sum + i.credit, 0),
    totalClosing: filteredResults.reduce((sum, i) => sum + i.closingBalance, 0)
  });
});

// ==================== PROFIT & LOSS ====================

exports.getProfitLoss = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);

  // Get all income and expense ledgers
  const ledgers = await prisma.ledger.findMany({
    where: {
      isActive: true,
      group: { groupType: { in: ['INCOME', 'EXPENSES'] } }
    },
    include: { group: true }
  });

  // Calculate balances in bulk
  const [debitSums, creditSums] = await Promise.all([
    prisma.journalEntry.groupBy({
      by: ['debitLedgerId'],
      _sum: { amount: true },
      where: {
        debitLedgerId: { in: ledgers.map(l => l.id) },
        voucher: { status: 'POSTED', date: { gte: start || new Date(0), lte: end } }
      }
    }),
    prisma.journalEntry.groupBy({
      by: ['creditLedgerId'],
      _sum: { amount: true },
      where: {
        creditLedgerId: { in: ledgers.map(l => l.id) },
        voucher: { status: 'POSTED', date: { gte: start || new Date(0), lte: end } }
      }
    })
  ]);

  const debMap = new Map(debitSums.map(s => [s.debitLedgerId, Number(s._sum.amount || 0)]));
  const credMap = new Map(creditSums.map(s => [s.creditLedgerId, Number(s._sum.amount || 0)]));

  const incomeItems = [];
  const expenseItems = [];

  for (const ledger of ledgers) {
    const totalDebit = debMap.get(ledger.id) || 0;
    const totalCredit = credMap.get(ledger.id) || 0;

    let balance = 0;
    // For P&L, we usually only care about the net movement in the period
    // If opening balance should be included (e.g., retained earnings), it's handled differently.
    // Standard P&L is just period transactions.
    if (ledger.balanceType === 'DEBIT') {
      balance = totalDebit - totalCredit;
    } else {
      balance = totalCredit - totalDebit;
    }

    if (Math.abs(balance) > 0.01) {
      const item = {
        ledgerId: ledger.id,
        ledgerName: ledger.name,
        groupName: ledger.group.name,
        amount: balance
      };

      if (ledger.group.groupType === 'INCOME') {
        incomeItems.push(item);
      } else {
        expenseItems.push(item);
      }
    }
  }

  const totalIncome = incomeItems.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenseItems.reduce((sum, item) => sum + item.amount, 0);
  const netProfit = totalIncome - totalExpenses;

  res.json({
    income: incomeItems,
    expenses: expenseItems,
    totalIncome,
    totalExpenses,
    netProfit,
    isProfitable: netProfit >= 0
  });
});

// ==================== BALANCE SHEET ====================

exports.getBalanceSheet = asyncHandler(async (req, res) => {
  const { asOfDate } = req.query;
  const end = asOfDate ? new Date(asOfDate) : new Date();
  end.setHours(23, 59, 59, 999);

  // Get all asset, liability, and equity ledgers
  const ledgers = await prisma.ledger.findMany({
    where: {
      isActive: true,
      group: { groupType: { in: ['ASSETS', 'LIABILITIES', 'EQUITY'] } }
    },
    include: { group: true }
  });

  const [debitSums, creditSums] = await Promise.all([
    prisma.journalEntry.groupBy({
      by: ['debitLedgerId'],
      _sum: { amount: true },
      where: {
        debitLedgerId: { in: ledgers.map(l => l.id) },
        voucher: { status: 'POSTED', date: { lte: end } }
      }
    }),
    prisma.journalEntry.groupBy({
      by: ['creditLedgerId'],
      _sum: { amount: true },
      where: {
        creditLedgerId: { in: ledgers.map(l => l.id) },
        voucher: { status: 'POSTED', date: { lte: end } }
      }
    })
  ]);

  const debMap = new Map(debitSums.map(s => [s.debitLedgerId, Number(s._sum.amount || 0)]));
  const credMap = new Map(creditSums.map(s => [s.creditLedgerId, Number(s._sum.amount || 0)]));

  const assets = [];
  const liabilities = [];
  const equity = [];

  for (const ledger of ledgers) {
    const totalDebit = debMap.get(ledger.id) || 0;
    const totalCredit = credMap.get(ledger.id) || 0;

    let balance = Number(ledger.openingBalance);
    if (ledger.balanceType === 'DEBIT') {
      balance = balance + totalDebit - totalCredit;
    } else {
      balance = balance + totalCredit - totalDebit;
    }

    if (Math.abs(balance) > 0.01) {
      const item = {
        ledgerId: ledger.id,
        ledgerName: ledger.name,
        groupName: ledger.group.name,
        amount: balance
      };

      if (ledger.group.groupType === 'ASSETS') {
        assets.push(item);
      } else if (ledger.group.groupType === 'LIABILITIES') {
        liabilities.push(item);
      } else {
        equity.push(item);
      }
    }
  }

  // Calculate P&L (net profit) as of Date
  const plResult = await getProfitLossData(end);
  if (plResult.netProfit !== 0) {
    equity.push({
      ledgerId: null,
      ledgerName: plResult.netProfit >= 0 ? 'Net Profit (Current Period)' : 'Net Loss (Current Period)',
      groupName: 'Equity',
      amount: Math.abs(plResult.netProfit),
      isLoss: plResult.netProfit < 0
    });
  }

  const totalAssets = assets.reduce((sum, item) => sum + item.amount, 0);
  const totalLiabilities = liabilities.reduce((sum, item) => sum + item.amount, 0);

  // For equity, if it's a loss, we should subtract it if it's stored as positive.
  // Actually, to balance: Assets = Liabilities + Equity
  // Let's adjust totalEquity calculation:
  const totalEquity = equity.reduce((sum, item) => {
    if (item.ledgerName.includes('Net Loss')) return sum - item.amount;
    return sum + item.amount;
  }, 0);

  const balanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

  res.json({
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    balanced,
    difference: totalAssets - (totalLiabilities + totalEquity)
  });
});

// ==================== LEDGER STATEMENT ====================

exports.getLedgerStatement = asyncHandler(async (req, res) => {
  const { ledgerId, startDate, endDate } = req.query;

  if (!ledgerId) {
    res.status(400);
    throw new Error('Ledger ID is required');
  }

  const ledger = await prisma.ledger.findUnique({
    where: { id: parseInt(ledgerId) },
    include: { group: true }
  });

  if (!ledger) {
    res.status(404);
    throw new Error('Ledger not found');
  }

  // 1. Calculate Opening Balance as of startDate
  let calculatedOpeningBalance = parseFloat(ledger.openingBalance); // Initial Opening Balance
  let openingDebit = 0;
  let openingCredit = 0;

  if (startDate) {
    const start = new Date(startDate);

    // aggregate all debits before start date
    const preDebit = await prisma.journalEntry.aggregate({
      _sum: { amount: true },
      where: {
        debitLedgerId: parseInt(ledgerId),
        voucher: {
          status: 'POSTED',
          date: { lt: start }
        }
      }
    });

    // aggregate all credits before start date
    const preCredit = await prisma.journalEntry.aggregate({
      _sum: { amount: true },
      where: {
        creditLedgerId: parseInt(ledgerId),
        voucher: {
          status: 'POSTED',
          date: { lt: start }
        }
      }
    });

    const totalPreDebitRaw = preDebit._sum.amount ? parseFloat(preDebit._sum.amount) : 0;
    const totalPreCreditRaw = preCredit._sum.amount ? parseFloat(preCredit._sum.amount) : 0;

    const masterOpening = parseFloat(ledger.openingBalance);
    if (ledger.balanceType === 'DEBIT') {
      calculatedOpeningBalance = masterOpening + totalPreDebitRaw - totalPreCreditRaw;
    } else {
      calculatedOpeningBalance = masterOpening + totalPreCreditRaw - totalPreDebitRaw;
    }

    // Store separate aggregates for the report summary
    openingDebit = totalPreDebitRaw + (ledger.balanceType === 'DEBIT' ? masterOpening : 0);
    openingCredit = totalPreCreditRaw + (ledger.balanceType === 'CREDIT' ? masterOpening : 0);
  } else {
    openingDebit = ledger.balanceType === 'DEBIT' ? parseFloat(ledger.openingBalance) : 0;
    openingCredit = ledger.balanceType === 'CREDIT' ? parseFloat(ledger.openingBalance) : 0;
  }

  // 2. Build date filter for current period
  const dateFilter = {};
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    dateFilter.date = {
      gte: start,
      lte: end
    };
  }

  // 3. Get all entries for this ledger in the period
  const debitEntries = await prisma.journalEntry.findMany({
    where: {
      debitLedgerId: parseInt(ledgerId),
      voucher: {
        status: 'POSTED',
        ...dateFilter
      }
    },
    include: {
      voucher: true,
      creditLedger: true
    }
  });

  const creditEntries = await prisma.journalEntry.findMany({
    where: {
      creditLedgerId: parseInt(ledgerId),
      voucher: {
        status: 'POSTED',
        ...dateFilter
      }
    },
    include: {
      voucher: true,
      debitLedger: true
    }
  });

  // 4. Combine and enrich with counterpart names
  const allEntriesRaw = [...debitEntries.map(e => ({ ...e, type: 'DEBIT' })), ...creditEntries.map(e => ({ ...e, type: 'CREDIT' }))];

  const entriesWithParticulars = await Promise.all(allEntriesRaw.map(async (e) => {
    let particulars = 'Multiple Accounts';

    // Fetch all entries for this voucher to determine the "Particulars"
    const voucherEntries = await prisma.journalEntry.findMany({
      where: { voucherId: e.voucherId },
      include: { debitLedger: true, creditLedger: true }
    });

    // Find other ledgers involved in this voucher
    const otherLedgers = voucherEntries
      .map(ve => ({
        id: ve.debitLedgerId || ve.creditLedgerId,
        name: ve.debitLedger?.name || ve.creditLedger?.name
      }))
      .filter(l => l.id !== parseInt(ledgerId));

    // Dedup by name
    const uniqueOtherNames = [...new Set(otherLedgers.map(l => l.name))];

    if (uniqueOtherNames.length === 1) {
      particulars = uniqueOtherNames[0];
    } else if (uniqueOtherNames.length > 1) {
      particulars = `Multiple (${uniqueOtherNames.slice(0, 2).join(', ')}${uniqueOtherNames.length > 2 ? '...' : ''})`;
    } else {
      // Fallback for simple rows
      particulars = e.type === 'DEBIT' ? (e.creditLedger?.name || 'Related Ledger') : (e.debitLedger?.name || 'Related Ledger');
    }

    return {
      id: e.id,
      date: e.voucher.date,
      voucherNumber: e.voucher.voucherNumber,
      voucherType: e.voucher.voucherType,
      particulars: particulars,
      debit: e.type === 'DEBIT' ? parseFloat(e.amount) : 0,
      credit: e.type === 'CREDIT' ? parseFloat(e.amount) : 0,
      narration: e.voucher.narration
    };
  }));

  let allEntries = entriesWithParticulars.sort((a, b) => new Date(a.date) - new Date(b.date));

  // 5. Calculate running balance
  let runningBalance = calculatedOpeningBalance;
  const statement = allEntries.map(entry => {
    if (ledger.balanceType === 'DEBIT') {
      runningBalance = runningBalance + entry.debit - entry.credit;
    } else {
      runningBalance = runningBalance + entry.credit - entry.debit;
    }

    return {
      ...entry,
      balance: runningBalance
    };
  });

  res.json({
    ledger: {
      id: ledger.id,
      name: ledger.name,
      groupName: ledger.group.name,
      openingBalance: calculatedOpeningBalance, // This is the opening balance FOR THIS PERIOD
      balanceType: ledger.balanceType,
      openingDebit,
      openingCredit
    },
    statement,
    closingBalance: runningBalance
  });
});

// ==================== DAY BOOK ====================

exports.getDayBook = asyncHandler(async (req, res) => {
  const { date } = req.query;

  if (!date) {
    res.status(400);
    throw new Error('Date is required');
  }

  const selectedDate = new Date(date);
  const nextDate = new Date(selectedDate);
  nextDate.setDate(nextDate.getDate() + 1);

  const vouchers = await prisma.voucher.findMany({
    where: {
      date: {
        gte: selectedDate,
        lt: nextDate
      },
      status: 'POSTED'
    },
    include: {
      entries: {
        include: {
          debitLedger: true,
          creditLedger: true
        }
      }
    },
    orderBy: { voucherNumber: 'asc' }
  });

  const summary = vouchers.reduce((acc, v) => {
    acc[v.voucherType] = (acc[v.voucherType] || 0) + 1;
    return acc;
  }, {});

  res.json({
    date: selectedDate,
    vouchers,
    summary,
    totalVouchers: vouchers.length
  });
});

// ==================== HELPER FUNCTIONS ====================

async function getProfitLossData(endDate) {
  const end = endDate || new Date();

  const ledgers = await prisma.ledger.findMany({
    where: {
      isActive: true,
      group: { groupType: { in: ['INCOME', 'EXPENSES'] } }
    },
    include: { group: true }
  });

  const [debitSums, creditSums] = await Promise.all([
    prisma.journalEntry.groupBy({
      by: ['debitLedgerId'],
      _sum: { amount: true },
      where: {
        debitLedgerId: { in: ledgers.map(l => l.id) },
        voucher: { status: 'POSTED', date: { lte: end } }
      }
    }),
    prisma.journalEntry.groupBy({
      by: ['creditLedgerId'],
      _sum: { amount: true },
      where: {
        creditLedgerId: { in: ledgers.map(l => l.id) },
        voucher: { status: 'POSTED', date: { lte: end } }
      }
    })
  ]);

  const debMap = new Map(debitSums.map(s => [s.debitLedgerId, Number(s._sum.amount || 0)]));
  const credMap = new Map(creditSums.map(s => [s.creditLedgerId, Number(s._sum.amount || 0)]));

  let totalIncome = 0;
  let totalExpenses = 0;

  for (const ledger of ledgers) {
    const totalDebit = debMap.get(ledger.id) || 0;
    const totalCredit = credMap.get(ledger.id) || 0;

    let balance = 0;
    if (ledger.balanceType === 'DEBIT') {
      balance = totalDebit - totalCredit;
    } else {
      balance = totalCredit - totalDebit;
    }

    if (ledger.group.groupType === 'INCOME') {
      totalIncome += balance;
    } else {
      totalExpenses += balance;
    }
  }

  return {
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses
  };
}
