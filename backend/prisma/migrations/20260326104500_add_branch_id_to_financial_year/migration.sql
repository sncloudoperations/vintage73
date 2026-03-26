-- DropIndex
DROP INDEX IF EXISTS "FinancialYear_name_key";

-- DropIndex
DROP INDEX IF EXISTS "Sale_invoiceNumber_key";

-- AlterTable
ALTER TABLE "FinancialYear" ADD COLUMN IF NOT EXISTS "branchId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "FinancialYear_name_branchId_key" ON "FinancialYear"("name", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_branchId_invoiceNumber_financialYearId_key" ON "Sale"("branchId", "invoiceNumber", "financialYearId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinancialYear_branchId_fkey') THEN
        ALTER TABLE "FinancialYear" ADD CONSTRAINT "FinancialYear_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
