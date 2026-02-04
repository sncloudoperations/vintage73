-- AlterTable
ALTER TABLE "GSTSettings" ADD COLUMN     "apiMode" TEXT NOT NULL DEFAULT 'SANDBOX',
ADD COLUMN     "autoGenerateEinvoice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "einvoiceClientId" TEXT,
ADD COLUMN     "einvoiceClientSecret" TEXT,
ADD COLUMN     "einvoicePassword" TEXT,
ADD COLUMN     "einvoiceUsername" TEXT,
ADD COLUMN     "ewayBillClientId" TEXT,
ADD COLUMN     "ewayBillClientSecret" TEXT,
ADD COLUMN     "gspName" TEXT DEFAULT 'CDSL';
