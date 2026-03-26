-- DropIndex
DROP INDEX IF EXISTS "DeliveryChallan_challanNumber_key";

-- DropIndex
DROP INDEX IF EXISTS "Quotation_quotationNumber_key";

-- AlterTable
ALTER TABLE "DeliveryChallan" ADD COLUMN IF NOT EXISTS "financialYearId" INTEGER;

-- AlterTable
ALTER TABLE "FinancialYear" 
ADD COLUMN IF NOT EXISTS "challanPrefix" TEXT NOT NULL DEFAULT 'DC',
ADD COLUMN IF NOT EXISTS "challanSequence" TEXT NOT NULL DEFAULT '001',
ADD COLUMN IF NOT EXISTS "purchasePrefix" TEXT NOT NULL DEFAULT 'PUR',
ADD COLUMN IF NOT EXISTS "purchaseSequence" TEXT NOT NULL DEFAULT '001',
ADD COLUMN IF NOT EXISTS "quotationPrefix" TEXT NOT NULL DEFAULT 'QT',
ADD COLUMN IF NOT EXISTS "quotationSequence" TEXT NOT NULL DEFAULT '001';

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "financialYearId" INTEGER;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "financialYearId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryChallan_branchId_challanNumber_financialYearId_key" ON "DeliveryChallan"("branchId", "challanNumber", "financialYearId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Purchase_branchId_invoiceNumber_financialYearId_key" ON "Purchase"("branchId", "invoiceNumber", "financialYearId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Quotation_branchId_quotationNumber_financialYearId_key" ON "Quotation"("branchId", "quotationNumber", "financialYearId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Purchase_financialYearId_fkey') THEN
        ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Quotation_financialYearId_fkey') THEN
        ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryChallan_financialYearId_fkey') THEN
        ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
