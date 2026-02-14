const prisma = require('../config/prisma');

async function main() {
  console.log('Fixing Purchase Posting Rules...');

  // 1. Ensure "Purchase Accounts" Group
  let purchaseGroup = await prisma.accountGroup.findFirst({ where: { name: 'Purchase Accounts' } });
  if (!purchaseGroup) {
    purchaseGroup = await prisma.accountGroup.create({
      data: { name: 'Purchase Accounts', groupType: 'EXPENSES' }
    });
    console.log('Created Account Group: Purchase Accounts');
  }

  // 2. Ensure "Purchase Account" Ledger
  let purchaseLedger = await prisma.ledger.findUnique({ where: { name: 'Purchase Account' } });
  if (!purchaseLedger) {
    purchaseLedger = await prisma.ledger.create({
      data: { name: 'Purchase Account', groupId: purchaseGroup.id, balanceType: 'DEBIT' }
    });
    console.log('Created Ledger: Purchase Account');
  }

  // 3. Ensure "Sundry Creditors" Group (for default Supplier ledger context)
  let creditorGroup = await prisma.accountGroup.findFirst({ where: { name: 'Sundry Creditors' } });
  if (!creditorGroup) {
    creditorGroup = await prisma.accountGroup.create({
      data: { name: 'Sundry Creditors', groupType: 'LIABILITIES' }
    });
     console.log('Created Account Group: Sundry Creditors');
  }
  
  // Get a default ledger for the rule config (Supplier rule needs a valid ledgerId reference even if dynamic)
  let defaultSupplierLedger = await prisma.ledger.findFirst({ where: { groupId: creditorGroup.id } });
    if (!defaultSupplierLedger) {
        defaultSupplierLedger = await prisma.ledger.create({
            data: { name: 'Default Supplier Ledger', groupId: creditorGroup.id, balanceType: 'CREDIT' }
        });
        console.log('Created Default Supplier Ledger (Placeholder)');
    }

  // 4. Upsert Transaction Posting Rules
  
  // Rule A: Debit Purchase Account (Total Amount)
  // We use totalAmount to match the CREDIT side (total payable). 
  // If Tax rules are added later, this should change to 'subTotal' and tax rules added.
  await prisma.transactionPosting.upsert({
    where: { transactionType_role: { transactionType: 'PURCHASE', role: 'MAIN_ACCOUNT' } },
    update: {
        ledgerId: purchaseLedger.id,
        side: 'DEBIT',
        amountField: 'totalAmount'
    },
    create: {
      transactionType: 'PURCHASE',
      role: 'MAIN_ACCOUNT',
      ledgerId: purchaseLedger.id,
      side: 'DEBIT',
      amountField: 'totalAmount', 
      label: 'Purchase Entry',
      isSystem: true
    }
  });
  console.log('Upserted Rule: PURCHASE -> MAIN_ACCOUNT (Debit)');

  // Rule B: Credit Supplier (Total Amount)
  await prisma.transactionPosting.upsert({
    where: { transactionType_role: { transactionType: 'PURCHASE', role: 'SUPPLIER' } },
    update: {
        ledgerId: defaultSupplierLedger.id,
        side: 'CREDIT',
        amountField: 'totalAmount'
    },
    create: {
      transactionType: 'PURCHASE',
      role: 'SUPPLIER', // Dynamic role handled in code
      ledgerId: defaultSupplierLedger.id, // Placeholder
      side: 'CREDIT',
      amountField: 'totalAmount',
      label: 'Supplier Payable',
      isSystem: true
    }
  });
  console.log('Upserted Rule: PURCHASE -> SUPPLIER (Credit)');

  console.log('Fix applied successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
