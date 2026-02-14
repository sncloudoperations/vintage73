const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const accountingUtils = require('../utils/accountingUtils');

// ==================== MISS PUNCH REQUESTS ====================

// Get miss punch requests
exports.getMissPunchRequests = asyncHandler(async (req, res) => {
  const user = req.user; // Assuming auth middleware sets this
  const { userId } = req.query;

  let where = {};
  
  // If not admin, only show own requests
  if (user.role !== 'admin') {
    where.userId = user.id;
  } else if (userId) {
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

  const request = await prisma.missPunchRequest.create({
    data: {
      userId: user.id,
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
    const attendanceDate = new Date(request.date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Check if attendance already exists
    const existing = await prisma.attendance.findFirst({
      where: {
        userId: request.userId,
        date: {
          gte: attendanceDate,
          lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    });

    if (existing) {
      // Update existing attendance
      await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          checkIn: request.checkInTime ? new Date(`${request.date.toISOString().split('T')[0]}T${request.checkInTime}`) : existing.checkIn,
          checkOut: request.checkOutTime ? new Date(`${request.date.toISOString().split('T')[0]}T${request.checkOutTime}`) : existing.checkOut,
          status: 'PRESENT'
        }
      });
    } else {
      // Create new attendance
      await prisma.attendance.create({
        data: {
          userId: request.userId,
          date: attendanceDate,
          checkIn: request.checkInTime ? new Date(`${request.date.toISOString().split('T')[0]}T${request.checkInTime}`) : null,
          checkOut: request.checkOutTime ? new Date(`${request.date.toISOString().split('T')[0]}T${request.checkOutTime}`) : null,
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
  
  // If not admin, only show own advances
  if (user.role !== 'admin') {
    where.userId = user.id;
  } else if (userId) {
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
