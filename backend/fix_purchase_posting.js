const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPurchasePosting() {
  console.log('Fixing PURCHASE TransactionPosting rules...');
  try {
    // Find the Purchase Account ledger
    let purchaseLedger = await prisma.ledger.findFirst({ where: { name: 'Purchase Account' } });

    if (!purchaseLedger) {
      console.log('Purchase Account ledger not found, creating it...');
      // Find or create Account Group
      let purchaseGroup = await prisma.accountGroup.findFirst({ where: { name: 'Purchase Accounts' } });
      if (!purchaseGroup) {
        purchaseGroup = await prisma.accountGroup.create({
          data: { name: 'Purchase Accounts', groupType: 'EXPENSES' }
        });
        console.log('Created Purchase Accounts group.');
      }
      purchaseLedger = await prisma.ledger.create({
        data: { name: 'Purchase Account', groupId: purchaseGroup.id, balanceType: 'DEBIT' }
      });
      console.log('Created Purchase Account ledger.');
    }

    // 1. Upsert PURCHASE_ACCOUNT rule (DEBIT)
    await prisma.transactionPosting.upsert({
      where: { transactionType_role: { transactionType: 'PURCHASE', role: 'PURCHASE_ACCOUNT' } },
      update: { side: 'DEBIT', amountField: 'totalAmount', ledgerId: purchaseLedger.id },
      create: {
        transactionType: 'PURCHASE',
        role: 'PURCHASE_ACCOUNT',
        label: 'Purchase Dr',
        ledgerId: purchaseLedger.id,
        side: 'DEBIT',
        amountField: 'totalAmount'
      }
    });
    console.log('PURCHASE_ACCOUNT rule -> DEBIT: OK');

    // 2. Upsert SUPPLIER rule (CREDIT)
    await prisma.transactionPosting.upsert({
      where: { transactionType_role: { transactionType: 'PURCHASE', role: 'SUPPLIER' } },
      update: { side: 'CREDIT', amountField: 'totalAmount', ledgerId: purchaseLedger.id },
      create: {
        transactionType: 'PURCHASE',
        role: 'SUPPLIER',
        label: 'Supplier Cr',
        ledgerId: purchaseLedger.id, // placeholder; resolved dynamically at runtime
        side: 'CREDIT',
        amountField: 'totalAmount'
      }
    });
    console.log('SUPPLIER rule -> CREDIT: OK');

    console.log('\n✅ Fixes applied successfully! Restart your backend server now.');
  } catch (error) {
    console.error('❌ Failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixPurchasePosting();
