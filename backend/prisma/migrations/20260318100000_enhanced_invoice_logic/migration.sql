-- AlterTable
ALTER TABLE "FinancialYear" ADD COLUMN IF NOT EXISTS "invoicePrefix" TEXT NOT NULL DEFAULT 'INV';
ALTER TABLE "FinancialYear" ADD COLUMN IF NOT EXISTS "invoiceSequence" TEXT NOT NULL DEFAULT '001';

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "financialYearId" INTEGER;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "isInvoice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "quotationId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_quotationId_key" ON "Sale"("quotationId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
