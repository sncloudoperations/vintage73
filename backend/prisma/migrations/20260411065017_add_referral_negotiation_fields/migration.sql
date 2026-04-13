-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "branchId" INTEGER,
ADD COLUMN     "commissionAmount" DECIMAL(15,2),
ADD COLUMN     "commissionPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "commissionPercentage" DECIMAL(5,2),
ADD COLUMN     "negotiationAmount" DECIMAL(15,2),
ADD COLUMN     "referredById" INTEGER;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
