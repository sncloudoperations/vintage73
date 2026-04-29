-- CreateTable
CREATE TABLE "ReferralPayment" (
    "id" SERIAL NOT NULL,
    "leadId" INTEGER NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "amountPaid" DECIMAL(15,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "bankName" TEXT,
    "transactionNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralPayment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ReferralPayment" ADD CONSTRAINT "ReferralPayment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
