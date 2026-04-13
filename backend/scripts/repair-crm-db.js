const { PrismaClient } = require('../prisma/client');
const prisma = new PrismaClient();

async function repair() {
    console.log('🚀 Starting CRM Database Repair Script...');
    
    try {
        // 1. Repair FollowUp Table
        console.log('--- Checking FollowUp Table ---');
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "FollowUp" 
            ADD COLUMN IF NOT EXISTS "outcome" TEXT,
            ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
            ADD COLUMN IF NOT EXISTS "nextFollowUpDate" TIMESTAMP(3);
        `);
        console.log('✅ FollowUp table repaired/verified.');

        // 2. Repair Lead Table
        console.log('--- Checking Lead Table ---');
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "Lead" 
            ADD COLUMN IF NOT EXISTS "lastFollowUpDate" TIMESTAMP(3),
            ADD COLUMN IF NOT EXISTS "nextFollowUpDate" TIMESTAMP(3),
            ADD COLUMN IF NOT EXISTS "outcome" TEXT,
            ADD COLUMN IF NOT EXISTS "reminderFlag" BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS "negotiationAmount" DECIMAL(15,2),
            ADD COLUMN IF NOT EXISTS "referredById" INTEGER,
            ADD COLUMN IF NOT EXISTS "commissionPercentage" DECIMAL(5,2),
            ADD COLUMN IF NOT EXISTS "commissionAmount" DECIMAL(15,2),
            ADD COLUMN IF NOT EXISTS "commissionPaid" BOOLEAN DEFAULT false;
        `);
        console.log('✅ Lead table repaired/verified.');

        console.log('\n✨ Database repair completed successfully!');
    } catch (error) {
        console.error('\n❌ Error during database repair:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

repair();
