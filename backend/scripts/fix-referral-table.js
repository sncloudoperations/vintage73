const { PrismaClient } = require('../prisma/client');
const prisma = new PrismaClient();

async function createTable() {
    console.log('🚀 Checking for ReferralPayment table...');
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "ReferralPayment" (
                "id" SERIAL PRIMARY KEY,
                "leadId" INTEGER NOT NULL,
                "paymentDate" TIMESTAMP(3) NOT NULL,
                "amountPaid" DECIMAL(15, 2) NOT NULL,
                "paymentMethod" TEXT NOT NULL,
                "bankName" TEXT,
                "transactionNumber" TEXT,
                "notes" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL,
                CONSTRAINT "ReferralPayment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
            );
        `);
        console.log('✅ ReferralPayment table verified/created.');
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

createTable();
