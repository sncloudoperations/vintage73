-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "accessPermissions" JSONB,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'customer',
ADD COLUMN     "username" TEXT;
