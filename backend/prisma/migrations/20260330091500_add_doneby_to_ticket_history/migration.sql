-- AlterTable: Add foreign key constraint for TicketHistory.doneById -> User.id
ALTER TABLE "TicketHistory" ADD CONSTRAINT "TicketHistory_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Add foreign key constraint for TicketMessage.senderId -> User.id
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
