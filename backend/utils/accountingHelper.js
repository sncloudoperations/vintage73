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
  const group = await client.accountGroup.findFirst({
    where: { name: groupName }
  });

  if (!group) {
    throw new Error(`Accounting Group '${groupName}' not found. Please run seed script.`);
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
 */
async function processPurchasePosting(tx, purchase, userId) {
  const reference = purchase.invoiceNumber || `PUR-${purchase.id}`;

  // Dynamic Posting based on setup
  await postTransaction(tx, 'PURCHASE', purchase, userId, reference, `Purchase Bill #${reference}`);
}

module.exports = {
  ensureLedger,
  postVoucher,
  getLedgerByRole,
  evaluateFormula,
  processSalePosting,
  processPurchasePosting
};
