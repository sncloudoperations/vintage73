-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "city" TEXT,
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "partyType" TEXT NOT NULL DEFAULT 'B2C',
ADD COLUMN     "pincode" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "ewayBillDate" TIMESTAMP(3),
ADD COLUMN     "ewayBillNumber" TEXT,
ADD COLUMN     "isB2B" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "placeOfSupply" TEXT,
ADD COLUMN     "transportMode" TEXT,
ADD COLUMN     "transporterId" TEXT,
ADD COLUMN     "transporterName" TEXT,
ADD COLUMN     "vehicleNumber" TEXT;

-- CreateTable
CREATE TABLE "GSTSettings" (
    "id" SERIAL NOT NULL,
    "ewayBillUsername" TEXT,
    "ewayBillPassword" TEXT,
    "ewayBillThreshold" DECIMAL(10,2) NOT NULL DEFAULT 50000,
    "autoGenerateEwayBill" BOOLEAN NOT NULL DEFAULT false,
    "defaultPlaceOfSupply" TEXT,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "challanPrefix" TEXT NOT NULL DEFAULT 'DC',
    "termsAndConditions" TEXT,
    "bankDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GSTSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryChallan" (
    "id" SERIAL NOT NULL,
    "challanNumber" TEXT NOT NULL,
    "customerId" INTEGER,
    "challanDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transportMode" TEXT,
    "vehicleNumber" TEXT,
    "transporterName" TEXT,
    "transporterId" TEXT,
    "reasonForMovement" TEXT,
    "placeOfSupply" TEXT,
    "dispatchFrom" TEXT,
    "dispatchTo" TEXT,
    "ewayBillNumber" TEXT,
    "ewayBillDate" TIMESTAMP(3),
    "branchId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryChallan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryChallanItem" (
    "id" SERIAL NOT NULL,
    "challanId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "hsnCode" TEXT,
    "description" TEXT,

    CONSTRAINT "DeliveryChallanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryChallan_challanNumber_key" ON "DeliveryChallan"("challanNumber");

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanItem" ADD CONSTRAINT "DeliveryChallanItem_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "DeliveryChallan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryChallanItem" ADD CONSTRAINT "DeliveryChallanItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
