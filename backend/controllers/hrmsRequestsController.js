const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const accountingUtils = require('../utils/accountingUtils');

// ==================== MISS PUNCH REQUESTS ====================

// Get miss punch requests
exports.getMissPunchRequests = asyncHandler(async (req, res) => {
  const user = req.user; // Assuming auth middleware sets this
  const { userId } = req.query;

  let where = {};

  // Branch Isolation: If user is assigned to a branch, only show that branch's data
  if (user.branchId) {
    where.branchId = user.branchId;
  } else if (user.role !== 'admin') {
    where.userId = user.id;
  }

  // Allow filtering by userId if admin
  if (user.role === 'admin' && userId) {
    where.userId = parseInt(userId);
  }

  const requests = await prisma.missPunchRequest.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true
        }
      },
      reviewer: {
        select: {
          id: true,
          name: true,
          username: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(requests);
});

// Create miss punch request
exports.createMissPunchRequest = asyncHandler(async (req, res) => {
  const user = req.user;
  const { date, checkInTime, checkOutTime, reason } = req.body;

  if (!date || !reason) {
    res.status(400);
    throw new Error('Date and reason are required');
  }

  // 3-Day Rule Validation
  const requestDate = new Date(date);
  requestDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffInMs = today.getTime() - requestDate.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays > 3) {
    res.status(400);
    throw new Error('Miss Punch request cannot be applied after 3 days from the missed date');
  }

  if (requestDate > today) {
    res.status(400);
    throw new Error('Miss Punch cannot be applied for future dates');
  }

  const request = await prisma.missPunchRequest.create({
    data: {
      userId: user.id,
      branchId: user.branchId, // Set branchId from user
      date: new Date(date),
      checkInTime,
      checkOutTime,
      reason,
      status: 'PENDING'
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true
        }
      }
    }
  });

  res.status(201).json(request);
});

// Update miss punch request status (approve/reject)
exports.updateMissPunchStatus = asyncHandler(async (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const { status } = req.body; // APPROVED or REJECTED

  if (user.role !== 'admin') {
    res.status(403);
    throw new Error('Only admins can approve/reject requests');
  }

  // Branch isolation: Admin must be from the same branch
  const existingRequest = await prisma.missPunchRequest.findUnique({
    where: { id: parseInt(id) }
  });

  if (!existingRequest) {
    res.status(404);
    throw new Error('Request not found');
  }

  if (user.branchId && existingRequest.branchId !== user.branchId) {
    res.status(403);
    throw new Error('Unauthorized: This request belongs to another branch');
  }

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    res.status(400);
    throw new Error('Invalid status');
  }

  const request = await prisma.missPunchRequest.update({
    where: { id: parseInt(id) },
    data: {
      status,
      reviewedBy: user.id,
      reviewedAt: new Date()
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true
        }
      },
      reviewer: {
        select: {
          id: true,
          name: true,
          username: true
        }
      }
    }
  });

  // If approved, optionally create/update attendance record
  if (status === 'APPROVED') {
    // Use request.date directly for date logic, normalized to IST midnight
    const reqDate = new Date(request.date);
    const dateStr = reqDate.toISOString().split('T')[0]; // This is fine for splitting if normalized below

    const attendanceDate = new Date(reqDate);
    attendanceDate.setHours(0, 0, 0, 0);

    // Helper to create datetime at the correct date
    const createAtReqDate = (timeStr) => {
      if (!timeStr) return null;
      const [hours, minutes] = timeStr.split(':');
      const d = new Date(reqDate);
      d.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      return d;
    };

    // Check if attendance already exists
    const existing = await prisma.attendance.findFirst({
      where: {
        userId: request.userId,
        date: attendanceDate
      }
    });

    if (existing) {
      // Update existing attendance
      await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          checkIn: request.checkInTime ? createAtReqDate(request.checkInTime) : existing.checkIn,
          checkOut: request.checkOutTime ? createAtReqDate(request.checkOutTime) : existing.checkOut,
          status: 'PRESENT'
        }
      });
    } else {
      // Create new attendance
      await prisma.attendance.create({
        data: {
          userId: request.userId,
          branchId: request.branchId, // Use branchId from request
          date: attendanceDate,
          checkIn: createAtReqDate(request.checkInTime),
          checkOut: createAtReqDate(request.checkOutTime),
          status: 'PRESENT'
        }
      });
    }
  }

  res.json(request);
});

// ==================== SALARY ADVANCE REQUESTS ====================

// Get salary advances
exports.getSalaryAdvances = asyncHandler(async (req, res) => {
  const user = req.user;
  const { userId } = req.query;

  let where = {};

  // Branch Isolation
  if (user.branchId) {
    where.branchId = user.branchId;
  } else if (user.role !== 'admin') {
    where.userId = user.id;
  }

  if (user.role === 'admin' && userId) {
    where.userId = parseInt(userId);
  }

  const advances = await prisma.salaryAdvance.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          employeeProfile: {
            select: {
              basicSalary: true
            }
          }
        }
      },
      approver: {
        select: {
          id: true,
          name: true,
          username: true
        }
      },
      payroll: {
        select: {
          id: true,
          month: true,
          year: true,
          netSalary: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json(advances);
});

// Create salary advance request
exports.createSalaryAdvance = asyncHandler(async (req, res) => {
  const user = req.user;
  const { amount, reason } = req.body;

  if (!amount || !reason) {
    res.status(400);
    throw new Error('Amount and reason are required');
  }

  if (parseFloat(amount) <= 0) {
    res.status(400);
    throw new Error('Amount must be greater than 0');
  }

  const advance = await prisma.salaryAdvance.create({
    data: {
      userId: user.id,
      branchId: user.branchId, // Set branchId
      amount: parseFloat(amount),
      reason,
      status: 'PENDING'
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true
        }
      }
    }
  });

  res.status(201).json(advance);
});

// Update salary advance status (approve/reject)
exports.updateSalaryAdvanceStatus = asyncHandler(async (req, res) => {
  const user = req.user;
  const { id } = req.params;
  const { status } = req.body; // APPROVED or REJECTED

  if (user.role !== 'admin') {
    res.status(403);
    throw new Error('Only admins can approve/reject advances');
  }

  const existingAdvance = await prisma.salaryAdvance.findUnique({
    where: { id: parseInt(id) }
  });

  if (!existingAdvance) {
    res.status(404);
    throw new Error('Salary advance not found');
  }

  if (user.branchId && existingAdvance.branchId !== user.branchId) {
    res.status(403);
    throw new Error('Unauthorized: This request belongs to another branch');
  }

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    res.status(400);
    throw new Error('Invalid status');
  }

  const advance = await prisma.salaryAdvance.update({
    where: { id: parseInt(id) },
    data: {
      status,
      approvedBy: user.id,
      approvedAt: new Date()
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true
        }
      },
      approver: {
        select: {
          id: true,
          name: true,
          username: true
        }
      }
    }
  });

  // Accounting Integration
  if (status === 'APPROVED') {
    await accountingUtils.handleSalaryAdvanceApproval(advance.id, user.id);
  }

  res.json(advance);
});
