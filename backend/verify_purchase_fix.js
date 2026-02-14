const prisma = require('./utils/prismaClient');
const { processPurchasePosting } = require('./utils/accountingHelper');

async function verify() {
  console.log('Verifying Purchase Posting...');

  // Get a valid branch
  const branch = await prisma.branch.findFirst();
  if (!branch) {
      console.error('No branch found, cannot create purchase.');
      return;
  }

  const timestamp = Date.now();
  const supplierName = `Test Supplier ${timestamp}`;
  
  // ensure supplier
  const supplier = await prisma.supplier.create({
      data: { name: supplierName, contactPerson: 'Tester' }
  });

  const purchase = await prisma.purchase.create({
      data: {
          supplierId: supplier.id,
          invoiceNumber: `TEST-${timestamp}`,
          purchaseDate: new Date(),
          subTotal: 1000,
          taxAmount: 0,
          totalAmount: 1000, // Matching the rules we added
          status: 'completed',
          branchId: branch.id,
          paymentMethod: 'Cash',
          items: {
               // Minimal item to satisfy constraints if any, though schema allows empty? 
               // PurchaseItem is related. Schema says items PurchaseItem[].
               // But usually create is okay without items if not strict in DB, but let's be safe?
               // The controller checks for items, but DB model doesn't enforce non-empty array usually unless logic does.
               // We will skip items for this accounting test.
          }
      },
      include: { supplier: true }
  });

  console.log(`Created Test Purchase: ${purchase.id}`);

  try {
      // 2. Attempt Posting
      // This is the function that was failing with "Dr != Cr"
      await processPurchasePosting(prisma, purchase, 1); 
      console.log('✅ Accounting Posting Successful!');
      
      // 3. Verify Voucher
      const voucher = await prisma.voucher.findFirst({
          where: { reference: `Purchase Bill #${purchase.invoiceNumber}`, voucherType: 'PURCHASE' }, // reference format in helper
          include: { entries: true }
      });
      
      // Helper sets reference to `Purchase Bill #${reference}` or just reference depending on line 198 in helper
      // Helper line 198: await postTransaction(..., `Purchase Bill #${reference}`);
      // Note: verify script uses reference: purchase.invoiceNumber.
      
      if (!voucher) {
          // Try searching by createdBy or order by latest
           const lastVoucher = await prisma.voucher.findFirst({ orderBy: { id: 'desc' }, take: 1, include: { entries: true } });
           console.log('Last voucher found:', lastVoucher ? lastVoucher.reference : 'None');
      }

      if (voucher) {
          console.log(`Voucher ${voucher.voucherNumber} created with ${voucher.entries.length} entries.`);
          
          const dr = voucher.entries.filter(e=>e.debitLedgerId).reduce((s,e)=>s+Number(e.amount),0);
          const cr = voucher.entries.filter(e=>e.creditLedgerId).reduce((s,e)=>s+Number(e.amount),0);
          
          console.log(`Debit: ${dr}, Credit: ${cr}`);
          
          if (Math.abs(dr - cr) > 0.1) throw new Error('Voucher Unbalanced!');
      }
      
  } catch (e) {
      console.error('❌ Verification Failed:', e);
  } finally {
      // Cleanup
      // Delete vouchers first (foreign key)
      const vouch = await prisma.voucher.findFirst({ where: { reference: { contains: `TEST-${timestamp}` } }});
      if(vouch) {
          await prisma.journalEntry.deleteMany({ where: { voucherId: vouch.id }});
          await prisma.voucher.delete({ where: { id: vouch.id }});
      }

      await prisma.purchase.delete({ where: { id: purchase.id } });
      await prisma.supplier.delete({ where: { id: supplier.id } });
      console.log('Cleaned up test data.');
  }
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
