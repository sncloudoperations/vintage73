const prisma = require('./utils/prismaClient');
const { ensureLedger } = require('./utils/accountingHelper');

// Mock request objects if we were calling controllers directly, 
// but here we will just call the logic or simulate it to verify helper and DB state.

async function testFlow() {
  console.log('Testing POS -> Accounts Integration...');

  const timestamp = Date.now();
  const branchId = 3; // Using existing branch

  // 1. Create Customer
  const customerName = `Test Customer ${timestamp}`;
  console.log(`Creating Customer: ${customerName}`);
  
  // Directly simulate controller logic for Customer
  const customer = await prisma.customer.create({
      data: { name: customerName, branchId }
  });
  
  // Simulate accounting hook
  try {
      await ensureLedger(prisma, customerName, 'Sundry Debtors');
      console.log('Customer Ledger ensured.');
  } catch (e) {
      console.error('Customer Ledger failed:', e);
  }

  // Verify Ledger exists
  const ledger = await prisma.ledger.findUnique({ where: { name: customerName } });
  if (!ledger) {
      throw new Error('Ledger not created for customer!');
  }
  console.log(`Ledger ID: ${ledger.id} verified.`);

  // 2. Simulate Sale
  // We won't call the huge controller, but we check if we can post a voucher using helper
  // linked to this customer.
  
  const { postVoucher } = require('./utils/accountingHelper');
  
  // Ensure Sales Account
  const salesLedger = await ensureLedger(prisma, 'Sales Account', 'Sales Accounts');
  
  console.log(`Posting Sales Voucher for ${customerName}...`);
  const voucher = await postVoucher(prisma, {
      type: 'SALES',
      amount: 1000,
      narration: 'Test Sale',
      reference: `INV-${timestamp}`
  }, [
      { ledgerId: ledger.id, type: 'DEBIT', amount: 1000 },
      { ledgerId: salesLedger.id, type: 'CREDIT', amount: 1000 }
  ]);
  
  console.log(`Voucher ${voucher.voucherNumber} posted.`);
  
  // Verify Journal Entries
  const entries = await prisma.journalEntry.findMany({ where: { voucherId: voucher.id } });
  if (entries.length !== 2) throw new Error('Incorrect number of journal entries');
  console.log('Journal entries verified.');
  
  console.log('TEST PASSED.');
}

testFlow()
  .catch(e => {
      console.error(e);
      process.exit(1);
  })
  .finally(async () => {
      await prisma.$disconnect();
  });
