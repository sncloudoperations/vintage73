const prisma = require('./prismaClient');

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

  // Generate Voucher Number (Simple timestamp/random based for now to avoid concurrency issues in helper, 
  // or re-use the logic from accountingController if extracted. 
  // Let's use a simpler unique string here or copying logic.)
  
  // Quick Voucher Number Logic
  const prefix = type.substring(0, 3).toUpperCase();
  const timestamp = Date.now().toString().slice(-8); // Short timestamp
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const voucherNumber = `${prefix}-${timestamp}-${random}`;

  // Validate Totals
  const totalDebit = entries
    .filter(e => e.type === 'DEBIT')
    .reduce((sum, e) => sum + e.amount, 0);
  
  const totalCredit = entries
    .filter(e => e.type === 'CREDIT')
    .reduce((sum, e) => sum + e.amount, 0);

  // Allow small floating point diff
  if (Math.abs(totalDebit - totalCredit) > 0.1) {
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

module.exports = {
  ensureLedger,
  postVoucher
};
