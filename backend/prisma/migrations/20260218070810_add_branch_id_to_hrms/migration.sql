-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "branchId" INTEGER;

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "branchId" INTEGER;

-- AlterTable
ALTER TABLE "MissPunchRequest" ADD COLUMN     "branchId" INTEGER;

-- AlterTable
ALTER TABLE "Payroll" ADD COLUMN     "branchId" INTEGER;

-- AlterTable
ALTER TABLE "SalaryAdvance" ADD COLUMN     "branchId" INTEGER;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissPunchRequest" ADD CONSTRAINT "MissPunchRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
