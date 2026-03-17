const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPurchasePosting() {
  console.log('Fixing PURCHASE TransactionPosting rules...');
  try {
    // 1. Fix Purchase Account Rule (Should be DEBIT)
    const purchaseResult = await prisma.transactionPosting.updateMany({
      where: { 
        transactionType: 'PURCHASE', 
        role: 'PURCHASE_ACCOUNT' 
      },
      data: { 
        side: 'DEBIT', 
        amountField: 'totalAmount' 
      }
    });
    console.log(`Updated ${purchaseResult.count} rule(s) for PURCHASE_ACCOUNT to DEBIT.`);

    // 2. Fix Supplier Rule (Should be CREDIT)
    const supplierResult = await prisma.transactionPosting.updateMany({
      where: { 
        transactionType: 'PURCHASE', 
        role: 'SUPPLIER' 
      },
      data: { 
        side: 'CREDIT', 
        amountField: 'totalAmount' 
      }
    });
    console.log(`Updated ${supplierResult.count} rule(s) for SUPPLIER to CREDIT.`);

    console.log('Successfully applied fixes to the database!');
  } catch (error) {
    console.error('Failed to fix rules:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixPurchasePosting();
