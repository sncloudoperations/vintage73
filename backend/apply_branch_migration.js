const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Applying migration: Adding stockIncluded to Branch...');
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Branch' AND column_name='stockIncluded') THEN
          ALTER TABLE "Branch" ADD COLUMN "stockIncluded" BOOLEAN NOT NULL DEFAULT true;
        END IF;
      END $$;
    `);
    console.log('Migration successful!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
