const prisma = require('../utils/prismaClient');

// ==================== ACCOUNT GROUPS ====================

exports.getAccountGroups = async (req, res) => {
  try {
    const groups = await prisma.accountGroup.findMany({
      include: {
        parent: true,
        subGroups: true,
        ledgers: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createAccountGroup = async (req, res) => {
  try {
    const { name, groupType, parentId } = req.body;
    
    const group = await prisma.accountGroup.create({
      data: {
        name,
        groupType,
        parentId: parentId ? parseInt(parentId) : null
      }
    });
    
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== LEDGERS ====================

exports.getLedgers = async (req, res) => {
  try {
    const ledgers = await prisma.ledger.findMany({
      include: {
        group: true
      },
      orderBy: { name: 'asc' }
    });
    
    // Calculate current balance for each ledger
    const ledgersWithBalance = await Promise.all(
      ledgers.map(async (ledger) => {
        const balance = await calculateLedgerBalance(ledger.id);
        return {
          ...ledger,
          currentBalance: balance
        };
      })
    );
    
    res.json(ledgersWithBalance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createLedger = async (req, res) => {
  try {
    const { name, groupId, openingBalance, balanceType, description } = req.body;
    
    const ledger = await prisma.ledger.create({
      data: {
        name,
        groupId: parseInt(groupId),
        openingBalance: parseFloat(openingBalance || 0),
        balanceType: balanceType || 'DEBIT',
        description
      },
      include: {
        group: true
      }
    });
    
    res.json(ledger);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateLedger = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, groupId, openingBalance, balanceType, description, isActive } = req.body;
    
    const ledger = await prisma.ledger.update({
      where: { id: parseInt(id) },
      data: {
        name,
        groupId: groupId ? parseInt(groupId) : undefined,
        openingBalance: openingBalance !== undefined ? parseFloat(openingBalance) : undefined,
        balanceType,
        description,
        isActive
      },
      include: {
        group: true
      }
    });
    
    res.json(ledger);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteLedger = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if ledger has transactions
    const debitCount = await prisma.journalEntry.count({
      where: { debitLedgerId: parseInt(id) }
    });
    
    const creditCount = await prisma.journalEntry.count({
      where: { creditLedgerId: parseInt(id) }
    });
    
    if (debitCount > 0 || creditCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete ledger with existing transactions. Deactivate it instead.' 
      });
    }
    
    await prisma.ledger.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ message: 'Ledger deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== VOUCHERS ====================

// Generate voucher number
async function generateVoucherNumber(voucherType) {
  const prefix = {
    'PAYMENT': 'PAY',
    'RECEIPT': 'REC',
    'JOURNAL': 'JV',
    'CONTRA': 'CON',
    'SALES': 'SAL',
    'PURCHASE': 'PUR'
  }[voucherType] || 'VOU';
  
  const year = new Date().getFullYear().toString().slice(-2);
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  
  const lastVoucher = await prisma.voucher.findFirst({
    where: {
      voucherNumber: {
        startsWith: `${prefix}${year}${month}`
      }
    },
    orderBy: { voucherNumber: 'desc' }
  });
  
  let sequence = 1;
  if (lastVoucher) {
    const lastSequence = parseInt(lastVoucher.voucherNumber.slice(-4));
    sequence = lastSequence + 1;
  }
  
  return `${prefix}${year}${month}${sequence.toString().padStart(4, '0')}`;
}

// Create Payment Voucher
exports.createPaymentVoucher = async (req, res) => {
  try {
    const { date, paymentAccount, expenseAccount, amount, narration, reference } = req.body;
    const user = req.user;
    
    if (!paymentAccount || !expenseAccount || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const voucherNumber = await generateVoucherNumber('PAYMENT');
    
    const voucher = await prisma.voucher.create({
      data: {
        voucherNumber,
        voucherType: 'PAYMENT',
        date: new Date(date),
        narration,
        reference,
        totalAmount: parseFloat(amount),
        createdBy: user.id,
        entries: {
          create: [
            {
              debitLedgerId: parseInt(expenseAccount),
              amount: parseFloat(amount),
              description: narration
            },
            {
              creditLedgerId: parseInt(paymentAccount),
              amount: parseFloat(amount),
              description: narration
            }
          ]
        }
      },
      include: {
        entries: {
          include: {
            debitLedger: true,
            creditLedger: true
          }
        }
      }
    });
    
    res.json(voucher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create Receipt Voucher
exports.createReceiptVoucher = async (req, res) => {
  try {
    const { date, receiptAccount, incomeAccount, amount, narration, reference } = req.body;
    const user = req.user;
    
    if (!receiptAccount || !incomeAccount || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const voucherNumber = await generateVoucherNumber('RECEIPT');
    
    const voucher = await prisma.voucher.create({
      data: {
        voucherNumber,
        voucherType: 'RECEIPT',
        date: new Date(date),
        narration,
        reference,
        totalAmount: parseFloat(amount),
        createdBy: user.id,
        entries: {
          create: [
            {
              debitLedgerId: parseInt(receiptAccount),
              amount: parseFloat(amount),
              description: narration
            },
            {
              creditLedgerId: parseInt(incomeAccount),
              amount: parseFloat(amount),
              description: narration
            }
          ]
        }
      },
      include: {
        entries: {
          include: {
            debitLedger: true,
            creditLedger: true
          }
        }
      }
    });
    
    res.json(voucher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create Journal Entry
exports.createJournalEntry = async (req, res) => {
  try {
    const { date, entries, narration, reference } = req.body;
    const user = req.user;
    
    if (!entries || entries.length < 2) {
      return res.status(400).json({ error: 'Journal entry must have at least 2 entries' });
    }
    
    // Validate that total debits = total credits
    const totalDebit = entries
      .filter(e => e.type === 'DEBIT')
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);
    
    const totalCredit = entries
      .filter(e => e.type === 'CREDIT')
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ 
        error: `Total debits (${totalDebit}) must equal total credits (${totalCredit})` 
      });
    }
    
    const voucherNumber = await generateVoucherNumber('JOURNAL');
    
    const journalEntries = entries.map(entry => ({
      debitLedgerId: entry.type === 'DEBIT' ? parseInt(entry.ledgerId) : null,
      creditLedgerId: entry.type === 'CREDIT' ? parseInt(entry.ledgerId) : null,
      amount: parseFloat(entry.amount),
      description: entry.description || narration
    }));
    
    const voucher = await prisma.voucher.create({
      data: {
        voucherNumber,
        voucherType: 'JOURNAL',
        date: new Date(date),
        narration,
        reference,
        totalAmount: totalDebit,
        createdBy: user.id,
        entries: {
          create: journalEntries
        }
      },
      include: {
        entries: {
          include: {
            debitLedger: true,
            creditLedger: true
          }
        }
      }
    });
    
    res.json(voucher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create Contra Entry
exports.createContraEntry = async (req, res) => {
  try {
    const { date, fromAccount, toAccount, amount, narration, reference } = req.body;
    const user = req.user;
    
    if (!fromAccount || !toAccount || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const voucherNumber = await generateVoucherNumber('CONTRA');
    
    const voucher = await prisma.voucher.create({
      data: {
        voucherNumber,
        voucherType: 'CONTRA',
        date: new Date(date),
        narration,
        reference,
        totalAmount: parseFloat(amount),
        createdBy: user.id,
        entries: {
          create: [
            {
              debitLedgerId: parseInt(toAccount),
              amount: parseFloat(amount),
              description: narration
            },
            {
              creditLedgerId: parseInt(fromAccount),
              amount: parseFloat(amount),
              description: narration
            }
          ]
        }
      },
      include: {
        entries: {
          include: {
            debitLedger: true,
            creditLedger: true
          }
        }
      }
    });
    
    res.json(voucher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all vouchers
exports.getVouchers = async (req, res) => {
  try {
    const { voucherType, startDate, endDate, status } = req.query;
    
    const where = {};
    if (voucherType) where.voucherType = voucherType;
    if (status) where.status = status;
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    
    const vouchers = await prisma.voucher.findMany({
      where,
      include: {
        entries: {
          include: {
            debitLedger: true,
            creditLedger: true
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      },
      orderBy: { date: 'desc' }
    });
    
    res.json(vouchers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single voucher
exports.getVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    
    const voucher = await prisma.voucher.findUnique({
      where: { id: parseInt(id) },
      include: {
        entries: {
          include: {
            debitLedger: true,
            creditLedger: true
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      }
    });
    
    if (!voucher) {
      return res.status(404).json({ error: 'Voucher not found' });
    }
    
    res.json(voucher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cancel voucher
exports.cancelVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    
    const voucher = await prisma.voucher.update({
      where: { id: parseInt(id) },
      data: { status: 'CANCELLED' }
    });
    
    res.json(voucher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Voucher
exports.updateVoucher = async (req, res) => {
  const { id } = req.params;
  const { date, narration, reference, totalAmount, entries } = req.body;
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete existing entries (Cascade is on schema, but explicit delete entries if needed)
      // Actually with onDelete: Cascade, we just need to replace them.
      // But Prisma doesn't have a "replace" for relations in update unless using disconnect/connect or deleteMany.
      await tx.journalEntry.deleteMany({
        where: { voucherId: parseInt(id) }
      });

      // 2. Update voucher record and create new entries
      const voucher = await tx.voucher.update({
        where: { id: parseInt(id) },
        data: {
          date: date ? new Date(date) : undefined,
          narration,
          reference,
          totalAmount: totalAmount ? parseFloat(totalAmount) : undefined,
          entries: {
            create: entries.map(e => ({
              debitLedgerId: e.debitLedgerId ? parseInt(e.debitLedgerId) : (e.type === 'DEBIT' ? parseInt(e.ledgerId) : null),
              creditLedgerId: e.creditLedgerId ? parseInt(e.creditLedgerId) : (e.type === 'CREDIT' ? parseInt(e.ledgerId) : null),
              amount: parseFloat(e.amount),
              description: e.description || narration
            }))
          }
        },
        include: {
          entries: true
        }
      });

      return voucher;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete Voucher
exports.deleteVoucher = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.voucher.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Voucher deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== HELPER FUNCTIONS ====================

async function calculateLedgerBalance(ledgerId) {
  const ledger = await prisma.ledger.findUnique({
    where: { id: ledgerId }
  });
  
  if (!ledger) return 0;
  
  // Get all debit entries
  const debitEntries = await prisma.journalEntry.findMany({
    where: { 
      debitLedgerId: ledgerId,
      voucher: { status: 'POSTED' }
    }
  });
  
  // Get all credit entries
  const creditEntries = await prisma.journalEntry.findMany({
    where: { 
      creditLedgerId: ledgerId,
      voucher: { status: 'POSTED' }
    }
  });
  
  const totalDebit = debitEntries.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const totalCredit = creditEntries.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  
  // Calculate balance based on ledger type
  let balance = parseFloat(ledger.openingBalance);
  
  if (ledger.balanceType === 'DEBIT') {
    balance = balance + totalDebit - totalCredit;
  } else {
    balance = balance + totalCredit - totalDebit;
  }
  
  return balance;
}

exports.calculateLedgerBalance = calculateLedgerBalance;
