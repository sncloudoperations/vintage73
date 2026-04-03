-- CreateTable
CREATE TABLE "InvoiceSetting" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSetting_type_key" ON "InvoiceSetting"("type");
