-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "adminId" INTEGER;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
