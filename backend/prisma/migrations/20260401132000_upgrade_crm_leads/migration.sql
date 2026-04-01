-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "address" TEXT,
ADD COLUMN     "budget" DECIMAL(15,2),
ADD COLUMN     "followUpDate" TIMESTAMP(3),
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "productId" INTEGER,
ADD COLUMN     "quantity" INTEGER,
ADD COLUMN     "quotationId" INTEGER,
ADD COLUMN     "saleId" INTEGER;

-- AlterTable
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Notification_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Notification_id_seq";

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" SERIAL NOT NULL,
    "leadId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "nextFollowUpDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" SERIAL NOT NULL,
    "leadId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_phone_key" ON "Lead"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_quotationId_key" ON "Lead"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_saleId_key" ON "Lead"("saleId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketClosureRequest" ADD CONSTRAINT "TicketClosureRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

