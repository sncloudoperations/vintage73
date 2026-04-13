-- AlterTable
ALTER TABLE "FollowUp" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "outcome" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "lastFollowUpDate" TIMESTAMP(3),
ADD COLUMN     "nextFollowUpDate" TIMESTAMP(3),
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "reminderFlag" BOOLEAN NOT NULL DEFAULT false;
