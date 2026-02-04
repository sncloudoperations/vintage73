const prisma = require('../utils/prismaClient');
const { calculateLedgerBalance } = require('./accountingController');

// ==================== TRIAL BALANCE ====================

exports.getTrialBalance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : new Date();
    
    const ledgers = await prisma.ledger.findMany({
      where: { isActive: true },
      include: {
        group: true
      },
      orderBy: { name: 'asc' }
    });
    
    const trialBalance = await Promise.all(
      ledgers.map(async (ledger) => {
        // 1. Calculate Opening Balance (entries before startDate)
        let openingBalance = parseFloat(ledger.openingBalance);
        
        if (start) {
          const preDebit = await prisma.journalEntry.aggregate({
            _sum: { amount: true },
            where: {
              debitLedgerId: ledger.id,
              voucher: { status: 'POSTED', date: { lt: start } }
            }
          });
          const preCredit = await prisma.journalEntry.aggregate({
            _sum: { amount: true },
            where: {
              creditLedgerId: ledger.id,
              voucher: { status: 'POSTED', date: { lt: start } }
            }
          });
          
          openingBalance += (preDebit._sum.amount || 0) - (preCredit._sum.amount || 0);
        }

        // 2. Calculate Period Transactions (within range)
        const periodDebit = await prisma.journalEntry.aggregate({
          _sum: { amount: true },
          where: {
            debitLedgerId: ledger.id,
            voucher: { 
              status: 'POSTED', 
              date: { 
                gte: start || new Date(0), 
                lte: end 
              } 
            }
          }
        });
        const periodCredit = await prisma.journalEntry.aggregate({
          _sum: { amount: true },
          where: {
            creditLedgerId: ledger.id,
            voucher: { 
              status: 'POSTED', 
              date: { 
                gte: start || new Date(0), 
                lte: end 
              } 
            }
          }
        });

        const debitValue = parseFloat(periodDebit._sum.amount || 0);
        const creditValue = parseFloat(periodCredit._sum.amount || 0);
        const closingBalance = parseFloat(openingBalance) + debitValue - creditValue;
        
        return {
          ledgerId: ledger.id,
          ledgerName: ledger.name,
          groupName: ledger.group.name,
          groupType: ledger.group.groupType,
          openingBalance: parseFloat(openingBalance),
          debit: debitValue,
          credit: creditValue,
          closingBalance: parseFloat(closingBalance)
        };
      })
    );
    
    // Filter out ledgers with zero transactions and zero balance
    const filteredResults = trialBalance.filter(item => 
      Math.abs(item.openingBalance) > 0.01 || 
      item.debit > 0 || 
      item.credit > 0 || 
      Math.abs(item.closingBalance) > 0.01
    );

    const totalOpening = filteredResults.reduce((sum, item) => sum + item.openingBalance, 0);
    const totalDebit = filteredResults.reduce((sum, item) => sum + item.debit, 0);
    const totalCredit = filteredResults.reduce((sum, item) => sum + item.credit, 0);
    const totalClosing = filteredResults.reduce((sum, item) => sum + item.closingBalance, 0);
    
    res.json({
      trialBalance: filteredResults,
      totalOpening,
      totalDebit,
      totalCredit,
      totalClosing,
      balanced: Math.abs(totalClosing) < 0.01 // In a net trial balance, sum of net should be ~0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== PROFIT & LOSS ====================

exports.getProfitLoss = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Get all income and expense ledgers
    const ledgers = await prisma.ledger.findMany({
      where: {
        isActive: true,
        group: {
          groupType: {
            in: ['INCOME', 'EXPENSES']
          }
        }
      },
      include: {
        group: true
      }
    });
    
    const incomeItems = [];
    const expenseItems = [];
    
    for (const ledger of ledgers) {
      const balance = await calculateLedgerBalance(ledger.id);
      
      if (balance > 0) {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== BALANCE SHEET ====================

exports.getBalanceSheet = async (req, res) => {
  try {
    const { asOfDate } = req.query;
    
    // Get all asset, liability, and equity ledgers
    const ledgers = await prisma.ledger.findMany({
      where: {
        isActive: true,
        group: {
          groupType: {
            in: ['ASSETS', 'LIABILITIES', 'EQUITY']
          }
        }
      },
      include: {
        group: true
      }
    });
    
    const assets = [];
    const liabilities = [];
    const equity = [];
    
    for (const ledger of ledgers) {
      const balance = await calculateLedgerBalance(ledger.id);
      
      if (balance > 0) {
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
    
    // Calculate P&L and add to equity
    const plResult = await getProfitLossData();
    if (plResult.netProfit !== 0) {
      equity.push({
        ledgerId: null,
        ledgerName: plResult.netProfit >= 0 ? 'Net Profit' : 'Net Loss',
        groupName: 'Equity',
        amount: Math.abs(plResult.netProfit)
      });
    }
    
    const totalAssets = assets.reduce((sum, item) => sum + item.amount, 0);
    const totalLiabilities = liabilities.reduce((sum, item) => sum + item.amount, 0);
    const totalEquity = equity.reduce((sum, item) => sum + item.amount, 0);
    
    const balanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;
    
    res.json({
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      balanced
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== LEDGER STATEMENT ====================

// ==================== LEDGER STATEMENT ====================

exports.getLedgerStatement = async (req, res) => {
  try {
    const { ledgerId, startDate, endDate } = req.query;
    
    if (!ledgerId) {
      return res.status(400).json({ error: 'Ledger ID is required' });
    }
    
    const ledger = await prisma.ledger.findUnique({
      where: { id: parseInt(ledgerId) },
      include: { group: true }
    });
    
    if (!ledger) {
      return res.status(404).json({ error: 'Ledger not found' });
    }

    // 1. Calculate Opening Balance as of startDate
    let calculatedOpeningBalance = parseFloat(ledger.openingBalance); // Initial Opening Balance

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

        const totalPreDebit = preDebit._sum.amount || 0;
        const totalPreCredit = preCredit._sum.amount || 0;

        if (ledger.balanceType === 'DEBIT') {
            calculatedOpeningBalance = calculatedOpeningBalance + parseFloat(totalPreDebit) - parseFloat(totalPreCredit);
        } else {
            calculatedOpeningBalance = calculatedOpeningBalance + parseFloat(totalPreCredit) - parseFloat(totalPreDebit);
        }
    }
    
    // 2. Build date filter for current period
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
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
    
    // 4. Combine and sort
    const allEntries = [
      ...debitEntries.map(e => ({
        id: e.id,
        date: e.voucher.date,
        voucherNumber: e.voucher.voucherNumber,
        voucherType: e.voucher.voucherType,
        particulars: e.creditLedger?.name || 'Multiple Accounts',
        debit: parseFloat(e.amount),
        credit: 0,
        narration: e.voucher.narration
      })),
      ...creditEntries.map(e => ({
        id: e.id,
        date: e.voucher.date,
        voucherNumber: e.voucher.voucherNumber,
        voucherType: e.voucher.voucherType,
        particulars: e.debitLedger?.name || 'Multiple Accounts',
        debit: 0,
        credit: parseFloat(e.amount),
        narration: e.voucher.narration
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));
    
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
        balanceType: ledger.balanceType
      },
      statement,
      closingBalance: runningBalance
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== DAY BOOK ====================

exports.getDayBook = async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== HELPER FUNCTIONS ====================

async function getProfitLossData() {
  const ledgers = await prisma.ledger.findMany({
    where: {
      isActive: true,
      group: {
        groupType: {
          in: ['INCOME', 'EXPENSES']
        }
      }
    },
    include: {
      group: true
    }
  });
  
  let totalIncome = 0;
  let totalExpenses = 0;
  
  for (const ledger of ledgers) {
    const balance = await calculateLedgerBalance(ledger.id);
    
    if (balance > 0) {
      if (ledger.group.groupType === 'INCOME') {
        totalIncome += balance;
      } else {
        totalExpenses += balance;
      }
    }
  }
  
  return {
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses
  };
}
