-- AlterTable: Add ticketId to Notification for deep-linking
ALTER TABLE "Notification" ADD COLUMN "ticketId" TEXT;
