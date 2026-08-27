const prisma = require('../config/prisma');
const { evaluateFormula } = require('./accountingUtils');

/**
 * Ensure a ledger exists for a given name and group.
 * @param {Object} tx - Prisma transaction client (optional) or prisma instance
 * @param {string} name - Ledger name (e.g., "Customer Name")
 * @param {string} groupName - Account Group name (e.g., "Sundry Debtors")
 * @returns {Promise<Object>} - The Ledger object
 */
async function ensureLedger(tx, name, groupName) {
  const client = tx || prisma;

  // 1. Find the group first
  let group = await client.accountGroup.findFirst({
    where: { name: groupName }
  });

  if (!group) {
    const defaultGroupTypes = {
      'Sundry Debtors': 'ASSETS',
      'Sundry Creditors': 'LIABILITIES',
      'Sales Accounts': 'INCOME',
      'Purchase Accounts': 'EXPENSES',
      'Duties & Taxes': 'LIABILITIES',
      'Bank Accounts': 'ASSETS',
      'Cash-in-Hand': 'ASSETS',
      'Indirect Expenses': 'EXPENSES',
      'Direct Incomes': 'INCOME',
      'Stock-in-Hand': 'ASSETS',
      'Direct Expenses': 'EXPENSES',
      'Indirect Incomes': 'INCOME',
      'Fixed Assets': 'ASSETS',
      'Current Assets': 'ASSETS',
      'Current Liabilities': 'LIABILITIES',
      'Capital Account': 'LIABILITIES'
    };
    const groupType = defaultGroupTypes[groupName] || 'EXPENSES';

    try {
      group = await client.accountGroup.upsert({
        where: { name: groupName },
        update: {},
        create: {
          name: groupName,
          groupType: groupType
        }
      });
    } catch (err) {
      group = await client.accountGroup.findFirst({
        where: { name: groupName }
      });
    }
  }

  if (!group) {
    throw new Error(`Accounting Group '${groupName}' not found and could not be created. Please run seed script.`);
  }

  // 2. Find or Create Ledger
  // Note: Ledger names must be unique.
  const ledger = await client.ledger.upsert({
    where: { name: name },
    update: {}, // No update if exists
    create: {
      name: name,
      groupId: group.id,
      balanceType: group.groupType === 'ASSETS' || group.groupType === 'EXPENSES' ? 'DEBIT' : 'CREDIT',
      openingBalance: 0,
      description: `Auto-created for ${name}`
    }
  });

  return ledger;
}

/**
 * Create a specialized Voucher (Sales, Receipt, etc.) with Journal Entries
 * @param {Object} tx - Prisma Transaction Client
 * @param {Object} params - { type: 'SALES'|'RECEIPT', date: Date, amount: Float, narration: string, reference: string, createdBy: Int }
 * @param {Array} entries - Array of { ledgerId: Int, type: 'DEBIT'|'CREDIT', amount: Float }
 */
async function postVoucher(tx, params, entries) {
  const { type, date, amount, narration, reference, createdBy } = params;

  const { generateVoucherNumber } = require('../services/dynamicPostingService');
  const voucherNumber = await generateVoucherNumber(tx, type);

  // Validate Totals
  const totalDebit = entries
    .filter(e => e.type === 'DEBIT')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalCredit = entries
    .filter(e => e.type === 'CREDIT')
    .reduce((sum, e) => sum + e.amount, 0);

  // Allow small floating point diff
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Accounting Error: Dr (${totalDebit}) != Cr (${totalCredit}) in ${type}`);
  }

  const voucher = await tx.voucher.create({
    data: {
      voucherNumber,
      voucherType: type,
      date: date || new Date(),
      totalAmount: parseFloat(amount),
      narration,
      reference,
      status: 'POSTED',
      createdBy: createdBy || 1, // Default admin if null
      entries: {
        create: entries.map(e => ({
          debitLedgerId: e.type === 'DEBIT' ? e.ledgerId : null,
          creditLedgerId: e.type === 'CREDIT' ? e.ledgerId : null,
          amount: parseFloat(e.amount),
          description: narration
        }))
      }
    }
  });

  return voucher;
}

/**
 * Get configured ledger ID for a specific transaction role.
 * Falls back to hardcoded defaults if not configured in TransactionPosting.
 * @param {Object} tx - Prisma Transaction Client
 * @param {string} transactionType - e.g. 'SALES'
 * @param {string} role - e.g. 'MAIN_ACCOUNT'
 * @param {string} defaultLedgerName - Fallback name
 * @param {string} defaultGroupName - Fallback group
 * @returns {Promise<Object>} - Ledger object
 */
async function getLedgerByRole(tx, transactionType, role, defaultLedgerName, defaultGroupName) {
  const client = tx || prisma;

  const setup = await client.transactionPosting.findUnique({
    where: {
      transactionType_role: {
        transactionType,
        role
      }
    },
    include: { ledger: true }
  });

  if (setup && setup.ledger) {
    // Return setup with ledger attached
    return {
      id: setup.ledger.id,
      name: setup.ledger.name,
      ledger: setup.ledger,
      targetTable: setup.targetTable,
      postingMethod: setup.postingMethod,
      amountField: setup.amountField,
      customFormula: setup.customFormula
    };
  }

  // Fallback to ensuring the default ledger exists
  const ledger = await ensureLedger(tx, defaultLedgerName, defaultGroupName);
  return {
    id: ledger.id,
    name: ledger.name,
    ledger: ledger,
    postingMethod: 'SUM',
    amountField: null,
    customFormula: null
  };
}

// evaluateFormula moved to accountingUtils.js to break circular dependency

const { postTransaction } = require('../services/dynamicPostingService');

/**
 * Centralized logic for Sale posting.
 */
async function processSalePosting(tx, sale, userId) {
  const { invoiceNumber, totalAmount, paidAmount, paymentMethod, saleDate } = sale;

  // 1. Dynamic Posting for the Sale itself (Ledger Setup handles Dr/Cr for Customers, Sales, Taxes, etc.)
  await postTransaction(tx, 'SALES', sale, userId, invoiceNumber, `Sales Invoice #${invoiceNumber}`);

  // 2. Handle Receipt if paid (Optional: this could also be a dynamic 'PAYMENT' posting rule)
  if (paidAmount > 0) {
    const payMethod = paymentMethod || 'Cash';
    let role = 'CASH';
    let defaultLedger = 'Cash';
    let defaultGroup = 'Cash-in-Hand';

    if (payMethod.toLowerCase().includes('online') || payMethod.toLowerCase().includes('bank') || payMethod.toLowerCase().includes('card')) {
      role = 'BANK';
      defaultLedger = 'Bank Account';
      defaultGroup = 'Bank Accounts';
    }

    const assetLedger = await getLedgerByRole(tx, 'PAYMENT', role, defaultLedger, defaultGroup);

    // We can use postTransaction here too if we want it setup driven
    // For now, let's keep the receipt simple or use the service with 'PAYMENT' type
    const customerLedger = await ensureLedger(tx, sale.customer ? sale.customer.name : 'Walk-in Customer', 'Sundry Debtors');

    await postVoucher(tx, {
      type: 'RECEIPT',
      date: saleDate ? new Date(saleDate) : new Date(),
      amount: paidAmount,
      narration: `Payment for #${invoiceNumber}`,
      reference: invoiceNumber,
      createdBy: userId
    }, [
      { ledgerId: assetLedger.id, type: 'DEBIT', amount: paidAmount },
      { ledgerId: customerLedger.id, type: 'CREDIT', amount: paidAmount }
    ]);
  }
}

/**
 * Centralized logic for Purchase posting.
 * Uses hardcoded Dr/Cr logic so it works even if TransactionPosting DB rules are missing.
 */
async function processPurchasePosting(tx, purchase, userId) {
  const reference = purchase.invoiceNumber || `PUR-${purchase.id}`;
  const { paymentMethod, purchaseDate, supplier } = purchase;
  const totalAmount = parseFloat(String(purchase.totalAmount || 0));

  if (!totalAmount || totalAmount === 0) {
    console.warn('Purchase totalAmount is 0, skipping accounting posting.');
    return;
  }

  // 1. Resolve ledgers
  const purchaseLedger = await ensureLedger(tx, 'Purchase Account', 'Purchase Accounts');
  const supplierLedger = supplier
    ? await ensureLedger(tx, supplier.name, 'Sundry Creditors')
    : await ensureLedger(tx, 'Sundry Creditors (General)', 'Sundry Creditors');

  // 2. Post Purchase Voucher: Dr Purchase Account, Cr Supplier
  const mainNarration = `${paymentMethod || 'Credit'} Purchase Bill #${reference}`;
  await postVoucher(tx, {
    type: 'PURCHASE',
    date: purchaseDate || new Date(),
    amount: totalAmount,
    narration: mainNarration,
    reference: reference,
    createdBy: userId
  }, [
    { ledgerId: purchaseLedger.id, type: 'DEBIT', amount: totalAmount },
    { ledgerId: supplierLedger.id, type: 'CREDIT', amount: totalAmount }
  ]);

  // 3. If Payment is not Credit, also settle the Supplier Ledger (Cr Bank/Cash, Dr Supplier)
  const isSettled = paymentMethod && paymentMethod.toUpperCase() !== 'CREDIT';

  if (isSettled) {
    let paymentLedger;
    const methodUpper = paymentMethod.toUpperCase();
    if (methodUpper.includes('CASH')) {
      paymentLedger = await getLedgerByRole(tx, 'PAYMENT', 'CASH', 'Cash', 'Cash-in-Hand');
    } else {
      paymentLedger = await getLedgerByRole(tx, 'PAYMENT', 'BANK', 'Bank Account', 'Bank Accounts');
    }

    await postVoucher(tx, {
      type: 'PAYMENT',
      date: purchaseDate || new Date(),
      amount: totalAmount,
      narration: `${paymentMethod} Settlement for Bill #${reference}`,
      reference: reference,
      createdBy: userId
    }, [
      { ledgerId: supplierLedger.id, type: 'DEBIT', amount: totalAmount },
      { ledgerId: paymentLedger.id, type: 'CREDIT', amount: totalAmount }
    ]);
  }
}

module.exports = {
  ensureLedger,
  postVoucher,
  getLedgerByRole,
  evaluateFormula,
  processSalePosting,
  processPurchasePosting
};
