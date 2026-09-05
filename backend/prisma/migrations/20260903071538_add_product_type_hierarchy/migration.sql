-- DropIndex
DROP INDEX "Lead_phone_key";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "productTypeId" INTEGER,
ADD COLUMN     "productTypeName" TEXT,
ADD COLUMN     "size" TEXT,
ADD COLUMN     "sizeStocks" JSONB;

-- CreateTable
CREATE TABLE "ProductType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "genders" JSONB DEFAULT '["Men", "Women", "Boy", "Girl", "Unisex"]',
    "attributes" JSONB,
    "sizes" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_name_categoryId_key" ON "ProductType"("name", "categoryId");

-- AddForeignKey
ALTER TABLE "ProductType" ADD CONSTRAINT "ProductType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
