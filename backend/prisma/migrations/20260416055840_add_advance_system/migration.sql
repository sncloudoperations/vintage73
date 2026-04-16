-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "advanceUsed" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Advance" (
    "id" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "usedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "Advance_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
