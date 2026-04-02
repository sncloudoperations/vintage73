const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const accountingUtils = require('../utils/accountingUtils');

// Helper function to get current date in IST timezone (UTC+5:30)
const getISTDate = () => {
    // With process.env.TZ = 'Asia/Kolkata', new Date() returns IST
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setHours(0, 0, 0, 0); // Normalize to midnight
    return d;
};

// Attendance
exports.checkIn = asyncHandler(async (req, res) => {
    const { userId } = req.body;
    const todayIST = getISTDate();

    // Check if already checked in
    const existing = await prisma.attendance.findFirst({
        where: {
            userId,
            date: { gte: todayIST }
        }
    });

    if (existing) {
        res.status(400);
        throw new Error('Already checked in for today');
    }

    const attendance = await prisma.attendance.create({
        data: {
            userId,
            branchId: req.user.branchId, // Set branchId
            date: todayIST,
            checkIn: new Date(),
            status: 'CHECKED_IN'
        }
    });

    res.json(attendance);
});

exports.checkOut = asyncHandler(async (req, res) => {
    const { userId } = req.body;
    const todayIST = getISTDate();

    const attendance = await prisma.attendance.findFirst({
        where: {
            userId,
            date: { gte: todayIST }
        }
    });

    if (!attendance) {
        res.status(400);
        throw new Error('No check-in record found for today');
    }

    const updated = await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
            checkOut: new Date(),
            status: 'PRESENT' // Mark as PRESENT only after checkout
        }
    });

    res.json(updated);
});

exports.getAttendanceStatus = asyncHandler(async (req, res) => {
    let { userId } = req.query;
    const todayIST = getISTDate();

    // RBAC: Staff can only see their own attendance status
    if (req.user.role === 'staff') {
        userId = req.user.id;
    }

    const attendance = await prisma.attendance.findFirst({
        where: {
            userId: parseInt(userId),
            date: { gte: todayIST }
        }
    });
    res.json({ attendance });
});

exports.getAttendanceHistory = asyncHandler(async (req, res) => {
    let { userId, month, year } = req.query;
    
    // RBAC: Staff can only see their own attendance history
    if (req.user.role === 'staff') {
        userId = req.user.id;
    }

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
});


// Leave Types
exports.createLeaveType = asyncHandler(async (req, res) => {
    const { name, isPaid, monthlyLimit, color } = req.body;
    const type = await prisma.leaveType.create({
        data: {
            name,
            isPaid: isPaid ?? true,
            monthlyLimit: parseInt(monthlyLimit) || 0,
            color: color || '#3B82F6'
        }
    });
    res.json(type);
});

exports.getLeaveTypes = asyncHandler(async (req, res) => {
    const types = await prisma.leaveType.findMany({
        where: { isActive: true }
    });
    res.json(types);
});

exports.updateLeaveType = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, isPaid, monthlyLimit, color } = req.body;
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
});

exports.deleteLeaveType = asyncHandler(async (req, res) => {
    const { id } = req.params;
    // Soft delete
    const type = await prisma.leaveType.update({
        where: { id: parseInt(id) },
        data: { isActive: false }
    });
    res.json(type);
});

// Leaves
exports.applyLeave = asyncHandler(async (req, res) => {
    const { userId, startDate, endDate, reason, leaveTypeId, isHalfDay } = req.body;
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
        if (!type) {
            res.status(404);
            throw new Error("Invalid Leave Type");
        }

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
                res.status(400);
                throw new Error(`Monthly limit exceeded. Limit: ${type.monthlyLimit}, Used: ${usedDays}, Requested: ${requestedDays}`);
            }
        }
    }

    const leave = await prisma.leaveRequest.create({
        data: {
            userId,
            branchId: req.user.branchId, // Set branchId
            startDate: start,
            endDate: end,
            reason,
            leaveTypeId: leaveTypeId ? parseInt(leaveTypeId) : null,
            isHalfDay: !!isHalfDay
        }
    });
    res.json(leave);
});

exports.getLeaveRequests = asyncHandler(async (req, res) => {
    const { userId, status } = req.query;
    const where = {};
    if (userId) where.userId = parseInt(userId);
    if (status) where.status = status;

    // Strict branch and role isolation
    if (req.user.role === 'staff') {
        where.userId = req.user.id;
    } else if (req.user.branchId) {
        // Admin with a branchId = branch admin: filter via the staff user's branchId relation
        // This is the safest approach: works even if the record's own branchId is null
        where.user = { branchId: req.user.branchId };
    }

    const leaves = await prisma.leaveRequest.findMany({
        where,
        include: {
            user: { select: { name: true, username: true } },
            leaveType: true
        },
        orderBy: { createdAt: 'desc' }
    });
    res.json(leaves);
});

exports.updateLeaveStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, approvedById } = req.body;

    // Fetch the leave request first to check authorization
    const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: parseInt(id) },
        include: { user: true }
    });

    if (!leaveRequest) {
        res.status(404);
        throw new Error('Leave request not found');
    }

    // RBAC: Only the assigned admin (for branch admins) or any admin (for global admins) can approve
    if (req.user.role === 'admin' && req.user.branchId) {
        if (leaveRequest.user.adminId !== req.user.id) {
            res.status(403);
            throw new Error('You are not authorized to approve/reject this staff member\'s leave requests');
        }
    }

    const leave = await prisma.leaveRequest.update({
        where: { id: parseInt(id) },
        data: {
            status,
            approvedById: approvedById ? parseInt(approvedById) : req.user.id
        }
    });
    res.json(leave);
});

// Payroll
// Helper for payroll calculation
const calculatePayrollData = async ({ userId, fromDate, toDate, basicSalary, weeklyOff }) => {
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
        end.setHours(0, 0, 0, 0);

        const diffTime = end.getTime() - start.getTime();
        totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        // Restore end to end of day for database queries
        end.setHours(23, 59, 59, 999);

        payableDays = totalDays; // Start with full days

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

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];

            // Check if it's the weekly off day
            const daysMap = {
                'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
                'Thursday': 4, 'Friday': 5, 'Saturday': 6
            };
            const offDay = daysMap[weeklyOff] ?? 0; // Default to Sunday
            const isWeeklyOff = d.getDay() === offDay;

            const att = attendance.find(a => a.date.toISOString().split('T')[0] === dateStr);
            const leave = leaves.find(l => {
                const s = new Date(l.startDate); s.setHours(0, 0, 0, 0);
                const e = new Date(l.endDate); e.setHours(0, 0, 0, 0);
                return d >= s && d <= e;
            });

            if (att) {
                if (att.status === 'PRESENT') {
                    presentCount++;
                } else if (att.status === 'HALF_DAY') {
                    payableDays -= 0.5;
                    halfDayCount++;
                } else if (att.status === 'CHECKED_IN') {
                    // Considered present initially
                    presentCount++;
                } else if (att.status === 'ABSENT') {
                    // explicitly docked
                    payableDays -= 1;
                    absentCount++;
                }
            } else if (leave) {
                if (leave.leaveType?.isPaid) {
                    paidLeaveDays++;
                } else {
                    // Explicit unpaid leave
                    payableDays -= 1;
                    unpaidLeaveDays++;
                }
            } else if (isWeeklyOff) {
                weekendDays++;
            } else {
                // If there's no attendance record, DO NOTHING to payableDays.
                // Do not deduct automatically. Payable stays equal to totalDays for this day.
            }
        }

        // Safety bound check
        if (payableDays < 0) payableDays = 0;
        if (payableDays > totalDays) payableDays = totalDays;

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

exports.generatePayroll = asyncHandler(async (req, res) => {
    const { userId, month, year, allowances, deductions, fromDate, toDate } = req.body;
    const profile = await prisma.employeeProfile.findUnique({
        where: { userId: parseInt(userId) },
        include: { user: { select: { weeklyOff: true } } }
    });

    if (!profile) {
        res.status(404);
        throw new Error("Employee profile not found");
    }

    const calc = await calculatePayrollData({
        userId, fromDate, toDate, basicSalary: profile.basicSalary,
        weeklyOff: profile.user?.weeklyOff
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
            branchId: req.user.branchId, // Set branchId
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
    await accountingUtils.handlePayrollGeneration(payroll.id, userId);

    res.json({
        ...payroll,
        advancesDeducted: totalAdvances,
        calculation: calc
    });
});

exports.getPayrollPreview = asyncHandler(async (req, res) => {
    const { userId, fromDate, toDate } = req.query;
    if (!userId || !fromDate || !toDate) {
        res.status(400);
        throw new Error("userId, fromDate, and toDate are required");
    }

    const profile = await prisma.employeeProfile.findUnique({
        where: { userId: parseInt(userId) },
        include: { user: { select: { weeklyOff: true } } }
    });

    if (!profile) {
        res.status(404);
        throw new Error("Employee profile not found");
    }

    const calc = await calculatePayrollData({
        userId, fromDate, toDate, basicSalary: profile.basicSalary,
        weeklyOff: profile.user?.weeklyOff
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
});

exports.getBulkAttendance = asyncHandler(async (req, res) => {
    const { month, year } = req.query;
    const where = { employeeProfile: { isNot: null } };

    // RBAC: Staff can only see their own records, Admins see all (within branch)
    if (req.user.role === 'staff') {
        where.id = req.user.id;
    } else if (req.user.branchId) {
        where.branchId = req.user.branchId;
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);

    const users = await prisma.user.findMany({
        where,
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
});


exports.getPayrollHistory = asyncHandler(async (req, res) => {
    const { userId, month, year, status } = req.query;
    const where = {};
    if (userId && !isNaN(parseInt(userId))) {
        where.userId = parseInt(userId);
    }
    if (month) where.month = month;
    if (year && !isNaN(parseInt(year))) where.year = parseInt(year);
    if (status) where.status = status;

    // Branch Isolation
    if (req.user.branchId) {
        where.branchId = req.user.branchId;
    }

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
    });

    const mappedPayrolls = payrolls.map(p => {
        const advanceDeduction = p.salaryAdvances ? p.salaryAdvances.reduce((sum, adv) => sum + Number(adv.amount), 0) : 0;
        const grossSalary = Number(p.basicSalary) + Number(p.allowances);
        const incentives = Number(p.allowances);
        return {
            ...p,
            advanceDeduction,
            grossSalary,
            incentives,
            deductions: Number(p.deductions)
        };
    });

    res.json(mappedPayrolls);
});

exports.updatePayrollStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // APPROVED or PAID

    const payroll = await prisma.payroll.update({
        where: { id: parseInt(id) },
        data: { status }
    });

    // Accounting Integration
    if (status === 'PAID') {
        await accountingUtils.handlePayrollPayment(payroll.id, req.user.id);
    }

    res.json(payroll);
});

exports.deletePayroll = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const payroll = await prisma.payroll.findUnique({
        where: { id: parseInt(id) }
    });

    if (!payroll) {
        res.status(404);
        throw new Error("Payroll not found");
    }
    if (payroll.status !== 'GENERATED') {
        res.status(400);
        throw new Error("Cannot delete approved or paid payroll records");
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
});

// Profile
exports.getEmployeeProfile = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const profile = await prisma.employeeProfile.findUnique({
        where: { userId: parseInt(userId) }
    });
    res.json(profile || {});
});

exports.updateEmployeeProfile = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const data = req.body;
    const profile = await prisma.employeeProfile.upsert({
        where: { userId: parseInt(userId) },
        update: data,
        create: {
            userId: parseInt(userId),
            ...data
        }
    });
    res.json(profile);
});

// ==================== WORK LOG ====================

exports.createWorkLog = asyncHandler(async (req, res) => {
    const { userId, date, description } = req.body;

    if (!userId || !date || !description) {
        res.status(400);
        throw new Error('userId, date, and description are required');
    }

    // RBAC: Only the staff member themselves or an admin can create a log
    if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
        res.status(403);
        throw new Error('You can only record work logs for yourself');
    }

    // Fetch the user to get their assigned adminId
    const staffUser = await prisma.user.findUnique({
        where: { id: parseInt(userId) },
        select: { adminId: true, branchId: true }
    });

    const workLog = await prisma.workLog.create({
        data: {
            userId: parseInt(userId),
            adminId: staffUser?.adminId || null,
            branchId: staffUser?.branchId || req.user.branchId || null,
            date: new Date(date),
            description
        },
        include: {
            user: { select: { name: true, username: true } }
        }
    });

    res.json(workLog);
});

exports.getWorkLogs = asyncHandler(async (req, res) => {
    const { userId, date } = req.query;
    const where = {};

    if (userId) where.userId = parseInt(userId);

    // Strict branch and role isolation
    console.log('[HRMS DEBUG getWorkLogs] user.role:', req.user.role, '| user.branchId:', req.user.branchId, '| user.id:', req.user.id);
    if (req.user.role === 'staff') {
        where.userId = req.user.id;
    } else if (req.user.branchId) {
        // Admin with a branchId = branch admin: filter via the staff user's branchId relation
        where.user = { branchId: req.user.branchId };
    }
    console.log('[HRMS DEBUG getWorkLogs] where filter:', JSON.stringify(where));

    // Date filter
    if (date) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        where.date = { gte: start, lte: end };
    }

    const logs = await prisma.workLog.findMany({
        where,
        include: {
            user: { select: { name: true, username: true } }
        },
        orderBy: { date: 'desc' }
    });

    res.json(logs);
});
