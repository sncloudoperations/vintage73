-- AlterTable
ALTER TABLE "Advance" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "AdvanceHistory" (
    "id" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "advanceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "balanceAfter" DECIMAL(10,2) NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvanceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Advance_customerId_key" ON "Advance"("customerId");

-- AddForeignKey
ALTER TABLE "AdvanceHistory" ADD CONSTRAINT "AdvanceHistory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
