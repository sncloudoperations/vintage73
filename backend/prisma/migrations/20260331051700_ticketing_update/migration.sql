-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "resignReason" TEXT,
ALTER COLUMN "status" SET DEFAULT 'CREATED';

-- AlterTable
ALTER TABLE "TicketHistory" ADD COLUMN     "reason" TEXT;
