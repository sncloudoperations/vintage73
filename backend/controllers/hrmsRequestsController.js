const prisma = require('../utils/prismaClient');

// ==================== MISS PUNCH REQUESTS ====================

// Get miss punch requests
exports.getMissPunchRequests = async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create miss punch request
exports.createMissPunchRequest = async (req, res) => {
  try {
    const user = req.user;
    const { date, checkInTime, checkOutTime, reason } = req.body;

    if (!date || !reason) {
      return res.status(400).json({ error: 'Date and reason are required' });
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

    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update miss punch request status (approve/reject)
exports.updateMissPunchStatus = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { status } = req.body; // APPROVED or REJECTED

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can approve/reject requests' });
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== SALARY ADVANCE REQUESTS ====================

// Get salary advances
exports.getSalaryAdvances = async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create salary advance request
exports.createSalaryAdvance = async (req, res) => {
  try {
    const user = req.user;
    const { amount, reason } = req.body;

    if (!amount || !reason) {
      return res.status(400).json({ error: 'Amount and reason are required' });
    }

    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
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

    res.json(advance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update salary advance status (approve/reject)
exports.updateSalaryAdvanceStatus = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { status } = req.body; // APPROVED or REJECTED

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can approve/reject advances' });
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
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
        const accountingUtils = require('../utils/accountingUtils');
        await accountingUtils.handleSalaryAdvanceApproval(advance.id, user.id);
    }

    res.json(advance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
