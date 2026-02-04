const prisma = require('../utils/prismaClient');

// Attendance
exports.checkIn = async (req, res) => {
  const { userId } = req.body;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already checked in
    const existing = await prisma.attendance.findFirst({
      where: {
        userId,
        date: { gte: today }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Already checked in for today' });
    }

    const attendance = await prisma.attendance.create({
      data: {
        userId,
        checkIn: new Date(),
        status: 'PRESENT'
      }
    });

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.checkOut = async (req, res) => {
  const { userId } = req.body;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.findFirst({
      where: {
        userId,
        date: { gte: today }
      }
    });

    if (!attendance) {
      return res.status(400).json({ error: 'No check-in record found for today' });
    }

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: { checkOut: new Date() }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAttendanceStatus = async (req, res) => {
    const { userId } = req.query;
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const attendance = await prisma.attendance.findFirst({
            where: {
                userId: parseInt(userId),
                date: { gte: today }
            }
        });
        res.json({ attendance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

exports.getAttendanceHistory = async (req, res) => {
    const { userId, month, year } = req.query;
    try {
        const where = { userId: parseInt(userId) };
        const leaveWhere = { 
            userId: parseInt(userId),
            status: 'APPROVED'
        };

        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0); // Last day of month
            endDate.setHours(23, 59, 59, 999);
            
            where.date = {
                gte: startDate,
                lte: endDate
            };

            // Leaves that overlap with this month
            leaveWhere.OR = [
                { startDate: { lte: endDate }, endDate: { gte: startDate } }
            ];
        }

        const attendance = await prisma.attendance.findMany({
            where,
            orderBy: { date: 'asc' }
        });

        const leaves = await prisma.leaveRequest.findMany({
            where: leaveWhere,
            include: { leaveType: true },
            orderBy: { startDate: 'asc' }
        });

        res.json({ attendance, leaves });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}


// Leave Types
exports.createLeaveType = async (req, res) => {
    const { name, isPaid, monthlyLimit, color } = req.body;
    try {
        const type = await prisma.leaveType.create({
            data: { 
                name, 
                isPaid: isPaid ?? true, 
                monthlyLimit: parseInt(monthlyLimit) || 0,
                color: color || '#3B82F6'
            }
        });
        res.json(type);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getLeaveTypes = async (req, res) => {
    try {
        const types = await prisma.leaveType.findMany({
            where: { isActive: true }
        });
        res.json(types);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateLeaveType = async (req, res) => {
    const { id } = req.params;
    const { name, isPaid, monthlyLimit, color } = req.body;
    try {
        const type = await prisma.leaveType.update({
            where: { id: parseInt(id) },
            data: { 
                name, 
                isPaid, 
                monthlyLimit: parseInt(monthlyLimit) || 0,
                color 
            }
        });
        res.json(type);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteLeaveType = async (req, res) => {
    const { id } = req.params;
    try {
        // Soft delete
        const type = await prisma.leaveType.update({
            where: { id: parseInt(id) },
            data: { isActive: false }
        });
        res.json(type);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// Leaves
exports.applyLeave = async (req, res) => {
  const { userId, startDate, endDate, reason, leaveTypeId, isHalfDay } = req.body;
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // 1. Calculate requested duration
    let requestedDays = 0;
    if (isHalfDay) {
        requestedDays = 0.5;
        // Optional: Ensure start == end for half day? 
        // For now, if half day is checked, we assume it applies to the single day or the range is just treated as 0.5 overall (usually half day is for 1 day).
        // Let's enforce start == end for half day to avoid confusion
        if (startDate.split('T')[0] !== endDate.split('T')[0]) {
             // return res.status(400).json({ error: "Half day can only be applied for a single date." });
             // Or just let it be, but count as 0.5? Let's assume user knows. 
             // Better: If isHalfDay, we ignore duration and take 0.5.
        }
    } else {
        const diffTime = Math.abs(end - start);
        requestedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
    }

    // 2. Check Limit if leaveTypeId provided
    if (leaveTypeId) {
        const type = await prisma.leaveType.findUnique({ where: { id: parseInt(leaveTypeId) } });
        if (!type) return res.status(404).json({ error: "Invalid Leave Type" });

        if (type.monthlyLimit > 0) {
            // Count leaves taken/requested of this type in the START month
            const startMonth = start.getMonth();
            const startYear = start.getFullYear();
            
            const monthStart = new Date(startYear, startMonth, 1);
            const monthEnd = new Date(startYear, startMonth + 1, 0);

            const existingLeaves = await prisma.leaveRequest.findMany({
                where: {
                    userId,
                    leaveTypeId: parseInt(leaveTypeId),
                    status: { in: ['APPROVED', 'PENDING'] },
                    startDate: { gte: monthStart, lte: monthEnd }
                }
            });

            let usedDays = 0;
            existingLeaves.forEach(l => {
                if (l.isHalfDay) {
                    usedDays += 0.5;
                } else {
                    const lStart = new Date(l.startDate);
                    const lEnd = new Date(l.endDate);
                    const lDiff = Math.abs(lEnd - lStart);
                    usedDays += Math.ceil(lDiff / (1000 * 60 * 60 * 24)) + 1;
                }
            });

            if (usedDays + requestedDays > type.monthlyLimit) {
                return res.status(400).json({ 
                    error: `Monthly limit exceeded. Limit: ${type.monthlyLimit}, Used: ${usedDays}, Requested: ${requestedDays}` 
                });
            }
        }
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        userId,
        startDate: start,
        endDate: end,
        reason,
        leaveTypeId: leaveTypeId ? parseInt(leaveTypeId) : null,
        isHalfDay: !!isHalfDay
      }
    });
    res.json(leave);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getLeaveRequests = async (req, res) => {
    const { userId, status } = req.query;
    try {
        const where = {};
        if (userId) where.userId = parseInt(userId);
        if (status) where.status = status;

        const leaves = await prisma.leaveRequest.findMany({
            where,
            include: { 
                user: { select: { name: true, username: true } },
                leaveType: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(leaves);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateLeaveStatus = async (req, res) => {
  const { id } = req.params;
  const { status, approvedById } = req.body; 
  try {
    const leave = await prisma.leaveRequest.update({
      where: { id: parseInt(id) },
      data: { 
        status, 
        approvedById: approvedById ? parseInt(approvedById) : undefined 
      }
    });
    res.json(leave);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Payroll
// Helper for payroll calculation
const calculatePayrollData = async ({ userId, fromDate, toDate, basicSalary }) => {
    let basic = Number(basicSalary);
    let payableDays = 0;
    let totalDays = 0;
    let presentCount = 0;
    let absentCount = 0;
    let halfDayCount = 0;
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    let weekendDays = 0;

    if (fromDate && toDate) {
        const start = new Date(fromDate);
        const end = new Date(toDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        totalDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
        
        const attendance = await prisma.attendance.findMany({
            where: {
                userId: parseInt(userId),
                date: { gte: start, lte: end }
            }
        });
        
        const leaves = await prisma.leaveRequest.findMany({
            where: {
                userId: parseInt(userId),
                status: 'APPROVED',
                startDate: { lte: end },
                endDate: { gte: start }
            },
            include: { leaveType: true }
        });

        // Strict Logic: Iterate through each day
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const isWeekend = d.getDay() === 0 || d.getDay() === 6; // Sunday or Saturday

            const att = attendance.find(a => a.date.toISOString().split('T')[0] === dateStr);
            const leave = leaves.find(l => {
                const s = new Date(l.startDate); s.setHours(0,0,0,0);
                const e = new Date(l.endDate); e.setHours(0,0,0,0);
                return d >= s && d <= e;
            });

            if (att) {
                if (att.status === 'PRESENT') {
                    payableDays += 1;
                    presentCount++;
                } else if (att.status === 'HALF_DAY') {
                    payableDays += 0.5;
                    halfDayCount++;
                } else if (att.status === 'ABSENT') {
                    // explicitly docked
                    absentCount++;
                }
            } else if (leave) {
                if (leave.leaveType?.isPaid) {
                    payableDays += 1;
                    paidLeaveDays++;
                } else {
                    unpaidLeaveDays++;
                }
            } else if (isWeekend) {
                // If no record and no leave on weekend, it's paid (Standard Holiday)
                payableDays += 1;
                weekendDays++;
            } else {
                // DEFAULT ABSENT for working days
                absentCount++;
            }
        }

        basic = (Number(basicSalary) / totalDays) * payableDays;
    } else {
        payableDays = 30;
        totalDays = 30;
    }

    return {
        calculatedBasic: basic,
        totalDays,
        payableDays,
        presentCount,
        absentCount,
        halfDayCount,
        paidLeaveDays,
        unpaidLeaveDays,
        weekendDays
    };
};

exports.generatePayroll = async (req, res) => {
    const { userId, month, year, allowances, deductions, fromDate, toDate } = req.body;
    try {
        const profile = await prisma.employeeProfile.findUnique({
             where: { userId: parseInt(userId) }
        });
        
        if (!profile) return res.status(404).json({error: "Employee profile not found"});
        
        const calc = await calculatePayrollData({ 
            userId, fromDate, toDate, basicSalary: profile.basicSalary 
        });

        const basic = calc.calculatedBasic;
        const allow = Number(allowances || 0);
        const deduc = Number(deductions || 0);
        
        const approvedAdvances = await prisma.salaryAdvance.findMany({
            where: {
                userId: parseInt(userId),
                status: 'APPROVED',
                deductedInPayroll: false
            }
        });
        
        const totalAdvances = approvedAdvances.reduce((sum, adv) => sum + Number(adv.amount), 0);
        const net = basic + allow - deduc - totalAdvances;
        
        const payroll = await prisma.payroll.create({
            data: {
                userId: parseInt(userId),
                month,
                year,
                basicSalary: basic,
                allowances: allow,
                deductions: deduc,
                netSalary: net,
                status: 'GENERATED',
                fromDate: fromDate ? new Date(fromDate) : null,
                toDate: toDate ? new Date(toDate) : null
            }
        });
        
        if (approvedAdvances.length > 0) {
            await prisma.salaryAdvance.updateMany({
                where: { id: { in: approvedAdvances.map(a => a.id) } },
                data: { deductedInPayroll: true, payrollId: payroll.id }
            });
        }
        
        // Accounting Integration
        const accountingUtils = require('../utils/accountingUtils');
        await accountingUtils.handlePayrollGeneration(payroll.id, userId);

        
        res.json({
            ...payroll,
            advancesDeducted: totalAdvances,
            calculation: calc
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

exports.getPayrollPreview = async (req, res) => {
    const { userId, fromDate, toDate } = req.query;
    try {
        if (!userId || !fromDate || !toDate) {
            return res.status(400).json({ error: "userId, fromDate, and toDate are required" });
        }

        const profile = await prisma.employeeProfile.findUnique({
             where: { userId: parseInt(userId) }
        });
        
        if (!profile) return res.status(404).json({error: "Employee profile not found"});

        const calc = await calculatePayrollData({ 
            userId, fromDate, toDate, basicSalary: profile.basicSalary 
        });

        // Also fetch pending advances
        const approvedAdvances = await prisma.salaryAdvance.findMany({
            where: {
                userId: parseInt(userId),
                status: 'APPROVED',
                deductedInPayroll: false
            }
        });
        const totalAdvances = approvedAdvances.reduce((sum, adv) => sum + Number(adv.amount), 0);

        res.json({
            calculation: calc,
            pendingAdvances: totalAdvances,
            basicSalary: profile.basicSalary
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getBulkAttendance = async (req, res) => {
    const { month, year } = req.query;
    try {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        endDate.setHours(23, 59, 59, 999);

        const users = await prisma.user.findMany({
            where: { employeeProfile: { isNot: null } },
            include: {
                employeeProfile: {
                    include: { department: true }
                },
                attendance: {
                    where: { date: { gte: startDate, lte: endDate } }
                },
                leaveRequests: {
                    where: {
                        status: 'APPROVED',
                        startDate: { lte: endDate },
                        endDate: { gte: startDate }
                    },
                    include: { leaveType: true }
                }
            }
        });

        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.getPayrollHistory = async (req, res) => {
    const { userId, month, year, status } = req.query;
    try {
        const where = {};
        if (userId && !isNaN(parseInt(userId))) {
            where.userId = parseInt(userId);
        }
        if (month) where.month = month;
        if (year && !isNaN(parseInt(year))) where.year = parseInt(year);
        if (status) where.status = status;

        const payrolls = await prisma.payroll.findMany({
            where,
            include: {
                salaryAdvances: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        employeeProfile: {
                            select: {
                                employeeCode: true,
                                bankName: true,
                                accountNumber: true,
                                ifscCode: true,
                                branchName: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(payrolls);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

exports.updatePayrollStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // APPROVED or PAID

    try {
        const payroll = await prisma.payroll.update({
            where: { id: parseInt(id) },
            data: { status }
        });

        // Accounting Integration
        if (status === 'PAID') {
            const accountingUtils = require('../utils/accountingUtils');
            await accountingUtils.handlePayrollPayment(payroll.id, req.user.id);
        }

        res.json(payroll);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deletePayroll = async (req, res) => {
    const { id } = req.params;
    try {
        const payroll = await prisma.payroll.findUnique({
            where: { id: parseInt(id) }
        });

        if (!payroll) return res.status(404).json({ error: "Payroll not found" });
        if (payroll.status !== 'GENERATED') {
            return res.status(400).json({ error: "Cannot delete approved or paid payroll records" });
        }

        // Prepare transaction operations
        const operations = [
            prisma.salaryAdvance.updateMany({
                where: { payrollId: parseInt(id) },
                data: {
                    deductedInPayroll: false,
                    payrollId: null
                }
            }),
            prisma.payroll.delete({
                where: { id: parseInt(id) }
            })
        ];

        // Add voucher deletion if exists
        if (payroll.voucherId) {
            operations.unshift(
                prisma.voucher.delete({
                    where: { id: payroll.voucherId }
                })
            );
        }

        await prisma.$transaction(operations);

        res.json({ message: "Payroll deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Profile
exports.getEmployeeProfile = async (req, res) => {
    const { userId } = req.params;
    try {
        const profile = await prisma.employeeProfile.findUnique({
            where: { userId: parseInt(userId) }
        });
        res.json(profile || {});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
}

exports.updateEmployeeProfile = async (req, res) => {
    const { userId } = req.params;
    const data = req.body;
    try {
        const profile = await prisma.employeeProfile.upsert({
            where: { userId: parseInt(userId) },
            update: data,
            create: {
                userId: parseInt(userId),
                ...data
            }
        });
        res.json(profile);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
}
