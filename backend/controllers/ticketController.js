const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { createNotification } = require('../utils/notificationHelper');

// Helper to generate Ticket ID (e.g., TKT-1001)
const generateTicketId = async () => {
  const count = await prisma.ticket.count();
  return `TKT-${1000 + count + 1}`;
};

// @desc    Get branch agents (Admins + Staff for assignment)
exports.getBranchAgents = asyncHandler(async (req, res) => {
    // Robust Branch Fallback: Use explicit user branch or requested target branch (Fixes SuperAdmin/Global Admin empty dropdown issue)
    const targetBranchId = req.user.branchId || req.query.branchId;
    
    const where = {
        // Safely include capitalization anomalies on production db
        role: { in: ['admin', 'staff', 'Admin', 'Staff', 'branch-admin'] }
    };
    
    // Safety against legacy DB rows where isActive might be NULL instead of default TRUE
    where.isActive = { not: false };

    if (targetBranchId) {
        where.branchId = parseInt(targetBranchId);
    }

    const agents = await prisma.user.findMany({
        where,
        select: { id: true, name: true, username: true, role: true },
        orderBy: { name: 'asc' }
    });
    
    res.json(agents);
});

// @desc    Get branch admins (Legacy, for customer selection)
exports.getBranchAdmins = asyncHandler(async (req, res) => {
    const branchId = req.user.role === 'admin' ? req.user.branchId : req.query.branchId;
    
    if (!branchId && req.user.role !== 'superadmin') {
        res.status(400);
        throw new Error('Branch ID is required');
    }

    const where = {
        role: 'admin',
        isActive: true
    };
    if (branchId) where.branchId = parseInt(branchId);

    const admins = await prisma.user.findMany({
        where,
        select: { id: true, name: true, username: true }
    });
    res.json(admins);
});

// @desc    Create a new ticket
exports.createTicket = asyncHandler(async (req, res) => {
  let { title, description, priority, categoryName, categoryId, branchId, customerId, assignedToId, adminId } = req.body;
  
  // File URL from multer
  let fileUrl = null;
  if (req.file) {
    fileUrl = '/uploads/' + req.file.filename;
  }

  // Handle Dynamic Category
  let finalCategoryId = categoryId ? parseInt(categoryId) : null;
  if (!finalCategoryId && categoryName) {
    const category = await prisma.ticketCategory.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName }
    });
    finalCategoryId = category.id;
  }

  // Auto-fill branch for branch admins/staff
  const targetBranchId = (req.user.role === 'admin' || req.user.role === 'staff') && req.user.branchId 
    ? req.user.branchId 
    : (branchId ? parseInt(branchId) : (req.user.branchId || 1));

  const requesterId = req.user.role === 'customer' ? req.user.id : (customerId ? parseInt(customerId) : null);

  // Determine Ticket Ownership (Partitioning)
  let targetAdminId = null;
  if (req.user.role === 'admin') {
    targetAdminId = req.user.id; // Own system
  } 

  if ((req.user.role === 'staff' || req.user.role === 'admin') && !targetBranchId) {
    res.status(403);
    throw new Error('User must belong to a branch to create tickets');
  }

  if (!title || !description || !priority) {
    res.status(400);
    throw new Error('Please provide all required fields (title, description, priority)');
  }

  const customTicketId = await generateTicketId();
  
  // Initial history entries
  const historyData = [
    {
      action: 'Created',
      message: `Ticket [${customTicketId}] created by ${req.user.name || req.user.username} (${req.user.role})`,
      doneById: req.user.id,
      role: req.user.role
    }
  ];

  let ticketStatus = 'CREATED';
  let finalAssignedToId = assignedToId ? parseInt(assignedToId) : null;
  
  if (finalAssignedToId) {
    ticketStatus = 'ASSIGNED';
    const staff = await prisma.user.findUnique({ where: { id: finalAssignedToId } });
    if (staff) {
      historyData.push({
        action: 'Assigned',
        message: `Ticket assigned to ${staff.name || staff.username} by ${req.user.name || req.user.username}`,
        doneById: req.user.id,
        role: req.user.role
      });
    }
  }

  const ticketData = {
    ticketId: customTicketId,
    title,
    description,
    categoryName: categoryName || null,
    priority,
    createdByRole: req.user.role,
    status: 'Created', // FORCE INITIAL STATUS
    slaStatus: 'OnTime',
    fileUrl: fileUrl,
    branch: { connect: { id: targetBranchId } },
    admin: targetAdminId ? { connect: { id: targetAdminId } } : undefined,
    createdBy: { connect: { id: req.user.id } }, // Set the creator
    history: { create: historyData }
  };

  if (finalCategoryId) ticketData.category = { connect: { id: finalCategoryId } };
  if (requesterId) ticketData.customer = { connect: { id: requesterId } };
  // REMOVED: Initial assignment logic

  const ticket = await prisma.ticket.create({
    data: ticketData,
    include: {
      category: true,
      history: true,
      customer: true,
      assignedTo: { select: { id: true, name: true, username: true } },
      admin: { select: { id: true, name: true, username: true } },
      createdBy: { select: { id: true, name: true, username: true, role: true } },
      branch: true
    }
  });

  // --- NOTIFICATION: TICKET CREATION ---
  if (req.user.role === 'admin' && requesterId) {
    // Admin created for customer
    await createNotification({
      userId: requesterId,
      title: 'New Service Ticket',
      message: `Your ticket #${ticket.ticketId} has been created by ${ticket.branch.name}`,
      type: 'INFO',
      ticketId: ticket.id,
      link: `/ticketing?id=${ticket.id}`
    });
  } else if (ticket.adminId) {
    // Notify the specific targeted Admin (Partitioned)
    await createNotification({
        userId: ticket.adminId,
        title: 'New Service Ticket',
        message: `${req.user.name || req.user.username} created ticket (${title})`,
        type: 'INFO',
        ticketId: ticket.id,
        link: `/ticketing?id=${ticket.id}`
    });
  } else {
    // Fallback: Notify all Branch Admins (Global Pool)
    const branchAdmins = await prisma.user.findMany({
      where: { branchId: parseInt(targetBranchId), role: 'admin' }
    });

    for (const admin of branchAdmins) {
      await createNotification({
        userId: admin.id,
        title: 'New Service Ticket',
        message: `${req.user.name || req.user.username} created ticket (${title})`,
        type: 'INFO',
        ticketId: ticket.id,
        link: `/ticketing?id=${ticket.id}`
      });
    }
  }

  // If auto-assigned, notify staff
  if (finalAssignedToId) {
      await createNotification({
          userId: finalAssignedToId,
          title: 'New Ticket Assigned',
          message: `A new ticket (${title}) has been assigned to you.`,
          type: 'INFO',
          ticketId: ticket.id,
          link: `/ticketing?id=${ticket.id}`
      });
  }

  res.status(201).json(ticket);
});

// @desc    Get tickets (Strict Role-Based Filter)
// @route   GET /api/tickets
// @access  Private
exports.getTickets = asyncHandler(async (req, res) => {
  const { role, id, branchId: userBranchId } = req.user;
  const { status, priority, categoryId, search } = req.query;

  // Use AND array for absolute security
  let where = {
    AND: []
  };

  // --- STRICT VISIBILITY LOCKDOWN ---
  const { viewType } = req.query; // 'created', 'assigned', or 'self'

  if (role === 'customer') {
    where.AND.push({ customerId: parseInt(id) });
  } else if (viewType === 'self') {
    // My Tickets: Created by me OR Assigned to me OR Waiting for handoff (Previous Assignee)
    where.AND.push({
      OR: [
        { assignedToId: parseInt(id) },
        { createdById: parseInt(id) },
        { previousAssigneeId: parseInt(id) }
      ]
    });
  } else if (viewType === 'created') {
    where.AND.push({ createdById: parseInt(id) });
  } else if (viewType === 'assigned') {
    where.AND.push({ assignedToId: parseInt(id) });
  } else if (role === 'staff') {
    // Staff role visibility: Only their own (Created, Assigned, or Waiting)
    where.AND.push({
      OR: [
        { assignedToId: parseInt(id) },
        { createdById: parseInt(id) },
        { previousAssigneeId: parseInt(id) }
      ]
    });
  } else if (role === 'admin' && userBranchId) {
    // Branch Admin: All branch tickets
    where.AND.push({ branchId: parseInt(userBranchId) });
  }

  // --- FILTERS ---
  if (status) where.AND.push({ status });
  if (priority) where.AND.push({ priority });
  if (categoryId) where.AND.push({ categoryId: parseInt(categoryId) });

  if (search) {
    where.AND.push({
      OR: [
        { ticketId: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    });
  }

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      category: true,
      customer: { select: { name: true, phone: true } },
      assignedTo: { select: { id: true, name: true, username: true } },
      previousAssignee: { select: { id: true, name: true, username: true } },
      branch: { select: { name: true } },
      history: {
        orderBy: { createdAt: 'asc' },
        include: {
          doneBy: { select: { name: true, username: true } }
        }
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          sender: { select: { name: true, username: true } }
        }
      },
      closureRequests: { where: { status: 'Pending' } }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Fix Status Casing globally for production DB safety
  const normalizeStatus = (s) => {
    if (!s) return 'Created';
    const l = s.toLowerCase();
    if (l === 'created') return 'Created';
    if (l === 'assigned') return 'Assigned';
    if (l === 'inprogress') return 'InProgress';
    if (l === 'closed') return 'Closed';
    if (l === 'waiting') return 'Waiting';
    if (l === 'closurerequested') return 'ClosureRequested';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const normalizedTickets = tickets.map(t => {
     const status = normalizeStatus(t.status);
     console.log(`[DEBUG] Ticket ID: ${t.ticketId || t.id} - DB Status: ${t.status} -> Normalized: ${status}`);
     return { ...t, status };
  });

  res.json(normalizedTickets);
});

// @desc    Assign/Reassign ticket
exports.assignTicket = asyncHandler(async (req, res) => {
  const { ticketId, staffId, reason } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && req.user.role !== 'staff') {
    res.status(403);
    throw new Error('Only admins and staff can assign/reassign tickets');
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: String(ticketId) } });
  if (!ticket) {
      res.status(404);
      throw new Error('Ticket not found');
  }

  const staff = await prisma.user.findUnique({ where: { id: parseInt(staffId) } });
  if (!staff) {
    res.status(404);
    throw new Error('Support personnel not found');
  }

  const oldStaffId = ticket.assignedToId;
  const isReassignment = oldStaffId && oldStaffId !== parseInt(staffId);

  const updatedTicket = await prisma.ticket.update({
    where: { id: String(ticketId) },
    data: {
      assignedTo: { connect: { id: parseInt(staffId) } },
      previousAssignee: oldStaffId ? { connect: { id: oldStaffId } } : undefined,
      status: 'Assigned',
      reassignReason: isReassignment ? (reason || null) : null,
      history: {
        create: {
          action: isReassignment ? 'Reassigned' : 'Assigned',
          message: isReassignment 
            ? `Ticket reassigned to ${staff.name || staff.username} by ${req.user.name || req.user.username} (${req.user.role}). Reason: ${reason || 'N/A'}`
            : `Ticket assigned to ${staff.name || staff.username} by ${req.user.name || req.user.username} (${req.user.role})`,
          doneById: req.user.id,
          role: req.user.role,
          reason: reason || null
        }
      }
    }
  });

  // Notify new staff
  await createNotification({
    userId: staff.id,
    title: isReassignment ? 'Ticket Reassigned to You' : 'New Ticket Assigned',
    message: isReassignment 
      ? `Ticket #${updatedTicket.ticketId} has been reassigned to you. Reason: ${reason || 'N/A'}`
      : `You have been assigned to ticket #${updatedTicket.ticketId}`,
    type: 'INFO',
    ticketId: updatedTicket.id,
    link: `/ticketing?id=${updatedTicket.id}`
  });

  res.json(updatedTicket);
});

// @desc    Update status
exports.updateStatus = asyncHandler(async (req, res) => {
  const { ticketId, status, message } = req.body;
  const ticket = await prisma.ticket.findUnique({ where: { id: String(ticketId) } });
  
  if (!ticket) {
    res.status(404);
    throw new Error('Ticket not found');
  }

  const isAdmin = req.user.role === 'admin';
  const isAssignedStaff = req.user.role === 'staff' && ticket.assignedToId === req.user.id;

  if (!isAdmin && !isAssignedStaff) {
    res.status(403);
    throw new Error('Not authorized to update status');
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id: String(ticketId) },
    data: {
      status: status.toUpperCase(), // Normalize to uppercase
      history: {
        create: {
          action: 'StatusChanged',
          message: message || `Status updated to ${status.toUpperCase()} by ${req.user.name || req.user.username}`,
          doneById: req.user.id,
          role: req.user.role
        }
      }
    }
  });

  // --- NOTIFICATION E: Status Update ---
  // Notify Customer if applicable
  if (updatedTicket.customerId && ticket.createdByRole === 'customer') {
    await createNotification({
        userId: updatedTicket.customerId,
        title: 'Ticket Status Updated',
        message: `Your ticket #${updatedTicket.ticketId} is now ${status}.`,
        type: 'INFO',
        link: `/ticketing?id=${ticketId}`
    });
  }
  
  // Notify Branch Admins
  const admins = await prisma.user.findMany({
    where: { branchId: updatedTicket.branchId, role: 'admin' }
  });

  for (const admin of admins) {
    await createNotification({
        userId: admin.id,
        title: 'Support Status Change',
        message: `Ticket #${updatedTicket.ticketId} changed to ${status}.`,
        type: 'INFO',
        link: `/ticketing?id=${ticketId}`
    });
  }

  res.json(updatedTicket);
});

// @desc    Add message (Chat)
exports.addMessage = asyncHandler(async (req, res) => {
  const { ticketId, message } = req.body;

  if (!message) {
    res.status(400);
    throw new Error('Message content is required');
  }

  const ticketMessage = await prisma.ticketMessage.create({
    data: {
      ticketId,
      message,
      senderId: req.user.id,
      role: req.user.role
    }
  });

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      action: 'MessageAdded',
      message: `[Message] ${req.user.role}: ${message.substring(0, 30)}...`,
      doneById: req.user.id,
      role: req.user.role
    }
  });

  // --- NOTIFICATION F: Chat Notifications ---
  const ticket = await prisma.ticket.findUnique({
    where: { id: String(ticketId) },
    include: { customer: true, assignedTo: true }
  });

  if (ticket) {
      const senderName = req.user.name || req.user.username;
      
      if (req.user.role === 'customer') {
          // Notify Admin + Assigned Staff
          const admins = await prisma.user.findMany({ where: { branchId: ticket.branchId, role: 'admin' } });
          for (const admin of admins) {
              await createNotification({ userId: admin.id, title: 'Customer Message', message: `${senderName} replied in ticket [${ticket.ticketId}]`, type: 'MESSAGE', ticketId, link: `/ticketing?id=${ticketId}` });
          }
          if (ticket.assignedToId) {
              await createNotification({ userId: ticket.assignedToId, title: 'Customer Message', message: `${senderName} replied in ticket [${ticket.ticketId}]`, type: 'MESSAGE', ticketId, link: `/ticketing?id=${ticketId}` });
          }
      } else if (req.user.role === 'staff') {
          // Notify Customer + Admin
          if (ticket.customerId) {
              await createNotification({ userId: ticket.customerId, title: 'Support Reply', message: `Staff replied in your ticket [${ticket.ticketId}]`, type: 'MESSAGE', ticketId, link: `/ticketing?id=${ticketId}` });
          }
          const admins = await prisma.user.findMany({ where: { branchId: ticket.branchId, role: 'admin' } });
          for (const admin of admins) {
              await createNotification({ userId: admin.id, title: 'Staff Message', message: `Staff (${senderName}) replied in ticket [${ticket.ticketId}]`, type: 'MESSAGE', ticketId, link: `/ticketing?id=${ticketId}` });
          }
      } else if (req.user.role === 'admin') {
          // Notify Customer + Assigned Staff
          if (ticket.customerId) {
              await createNotification({ userId: ticket.customerId, title: 'Admin Reply', message: `Support Admin replied in your ticket [${ticket.ticketId}]`, type: 'MESSAGE', ticketId, link: `/ticketing?id=${ticketId}` });
          }
          if (ticket.assignedToId) {
              await createNotification({ userId: ticket.assignedToId, title: 'Admin Message', message: `Admin (${senderName}) replied in ticket [${ticket.ticketId}]`, type: 'MESSAGE', ticketId, link: `/ticketing?id=${ticketId}` });
          }
      }
  }

  res.status(201).json(ticketMessage);
});

// @desc    Request Closure (Staff only)
exports.requestClosure = asyncHandler(async (req, res) => {
  const { ticketId, reason } = req.body;

  if (!reason) {
    res.status(400);
    throw new Error('Reason for closure is required');
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: String(ticketId) } });
  if (!ticket || ticket.assignedToId !== req.user.id) {
    res.status(403);
    throw new Error('Only the assigned staff can request closure');
  }

  const request = await prisma.ticketClosureRequest.create({
    data: {
      ticketId,
      requestedById: req.user.id,
      reason,
      status: 'Pending'
    }
  });

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      action: 'ClosureRequested',
      message: `Closure requested by staff. Reason: ${reason}`,
      doneById: req.user.id,
      role: 'staff'
    }
  });

  // Update Ticket Status to 'ClosureRequested'
  await prisma.ticket.update({
    where: { id: String(ticketId) },
    data: { status: 'ClosureRequested' }
  });

  // --- NOTIFICATION 4: STAFF CLOSURE REQUEST ---
  // PROMPT: Staff closure request -> show ONLY to Admin
  const admins = await prisma.user.findMany({
    where: { branchId: ticket.branchId, role: 'admin' }
  });

  for (const admin of admins) {
    await createNotification({
        userId: admin.id,
        title: 'Closure Request',
        message: `Staff (${req.user.name}) requested closure for ticket (${ticket.title}). Reason: ${reason}`,
        type: 'WARNING',
        ticketId: ticketId,
        link: `/ticketing?id=${ticketId}`
    });
  }

  res.status(201).json(request);
});

// @desc    Handle Closure (Admin only)
exports.handleClosureRequest = asyncHandler(async (req, res) => {
  const { requestId, status, adminComment } = req.body; // status: Approved / Rejected

  if (req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Authorization restricted: Admins only');
  }

  const request = await prisma.ticketClosureRequest.findUnique({
    where: { id: requestId },
    include: { ticket: true }
  });

  if (!request) {
    res.status(404);
    throw new Error('Request not found');
  }

  const updatedRequest = await prisma.ticketClosureRequest.update({
    where: { id: requestId },
    data: { status }
  });

  // --- NOTIFICATION 5: ADMIN DECISION ON CLOSURE ---
  // PROMPT: Closure accepted/rejected -> show ONLY to Staff (and Customer for finality if needed, but matrix says ❌ for Customer)
  const notificationMsg = status === 'Approved' 
    ? `Closure request accepted for ticket (${request.ticket.title})`
    : `Closure request rejected for ticket (${request.ticket.title})`;

  await createNotification({
    userId: request.requestedById,
    title: `Closure ${status}`,
    message: notificationMsg,
    type: status === 'Approved' ? 'SUCCESS' : 'ERROR',
    ticketId: request.ticketId,
    link: `/ticketing?id=${request.ticketId}`
  });

  if (status === 'Approved') {
    await prisma.ticket.update({
      where: { id: request.ticketId },
      data: {
        status: 'IN_PROGRESS', 
        assignedTo: { disconnect: true },   
        history: {
          create: {
            action: 'StaffReleased',
            message: `Staff closure approved. Ticket status set to IN_PROGRESS for final review. ${adminComment || ''}`,
            doneById: req.user.id,
            role: 'admin'
          }
        }
      }
    });
  } else {
    // Ticket remains with same staff
    await prisma.ticket.update({
        where: { id: request.ticketId },
        data: { status: 'IN_PROGRESS' }
    });

    await prisma.ticketHistory.create({
      data: {
        ticketId: request.ticketId,
        action: 'StatusChanged',
        message: `Closure request rejected by Admin. Ticket remains IN_PROGRESS. Reason: ${adminComment || 'N/A'}`,
        doneById: req.user.id,
        role: 'admin'
      }
    });
  }

  res.json(updatedRequest);
});

// @desc    Mark ticket as Ignored (Admin only)
exports.markAsIgnored = asyncHandler(async (req, res) => {
  const { ticketId, reason } = req.body;

  if (req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Only admins can flag tickets as ignored');
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: String(ticketId) } });
  if (!ticket) {
    res.status(404);
    throw new Error('Ticket not found');
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id: String(ticketId) },
    data: {
      history: {
        create: {
          action: 'Ignored',
          message: `Ticket flagged as IGNORED by Admin ${req.user.name || req.user.username}. Reason: ${reason || 'No response from staff'}`,
          doneById: req.user.id,
          role: 'admin'
        }
      }
    }
  });

  // Notify Assigned Staff
  if (ticket.assignedToId) {
    await createNotification({
      userId: ticket.assignedToId,
      title: 'Ticket Flagged as Ignored',
      message: `Admin flagged ticket #${ticket.ticketId} as ignored. Please respond immediately.`,
      type: 'WARNING',
      ticketId: ticket.id
    });
  }

  res.json(updatedTicket);
});

// @desc    Get Categories
exports.getCategories = asyncHandler(async (req, res) => {
  const categories = await prisma.ticketCategory.findMany({
    include: {
        _count: {
            select: { tickets: true }
        }
    },
    orderBy: { name: 'asc' }
  });
  res.json(categories);
});

// @desc    Get Customers for branch
exports.getBranchCustomers = asyncHandler(async (req, res) => {
    // For admins, use their own branchId. For others, use query param if provided.
    const branchId = req.user.role === 'admin' && req.user.branchId
        ? req.user.branchId
        : (req.query.branchId ? parseInt(req.query.branchId) : null);

    // If branchId is known, return customers matching that branch OR those with no branch set (legacy data)
    // If no branchId at all (superadmin), return all customers
    // GLOBAL CUSTOMERS: Return all customers across branches
    const where = {};

    const customers = await prisma.customer.findMany({
        where,
        select: { id: true, name: true, phone: true },
        orderBy: { name: 'asc' }
    });
    res.json(customers);
});

// @desc    Accept ticket (Staff/Admin)
exports.acceptTicket = asyncHandler(async (req, res) => {
    const { ticketId } = req.body;
    const ticket = await prisma.ticket.findUnique({ where: { id: String(ticketId) } });

    if (!ticket || ticket.assignedToId !== req.user.id) {
        res.status(403);
        throw new Error('You are not assigned to this ticket');
    }

    const updatedTicket = await prisma.ticket.update({
        where: { id: String(ticketId) },
        data: {
            status: 'InProgress',
            previousAssignee: { disconnect: true }, // Clear previous assignee
            history: {
                create: {
                    action: 'Accepted',
                    message: `${req.user.role.toUpperCase()} (${req.user.name || req.user.username}) accepted the ticket and moved it to IN_PROGRESS`,
                    doneById: req.user.id,
                    role: req.user.role
                }
            }
        }
    });

    res.json(updatedTicket);
});

// @desc    Reassign ticket (Staff/Admin)
exports.reassignTicket = asyncHandler(async (req, res) => {
    // Supporting both /reassign (POST) and /:id/reassign (PUT)
    const ticketId = req.params.id || req.body.ticketId;
    const { reason, nextStaffId, assignedTo } = req.body;
    const staffId = assignedTo || nextStaffId;

    if (!reason) {
        res.status(400);
        throw new Error('Please provide a reason for reassignment');
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: String(ticketId) } });

    if (!ticket) {
        res.status(404);
        throw new Error('Ticket not found');
    }

    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    const isAssigned = ticket.assignedToId === req.user.id;

    if (!isAdmin && !isAssigned) {
        res.status(403);
        throw new Error('Not authorized to reassign this ticket');
    }

    let updateData = {
        status: staffId ? 'Assigned' : 'Created', 
        previousAssignee: ticket.assignedToId ? { connect: { id: ticket.assignedToId } } : undefined,
        reassignReason: reason,
        history: {
            create: {
                action: 'Reassigned',
                message: staffId 
                    ? `${req.user.role.toUpperCase()} reassign to another agent. Old Assignee is now Waiting. Reason: ${reason}`
                    : `${req.user.role.toUpperCase()} reassign requested. Reason: ${reason}`,
                doneById: req.user.id,
                role: req.user.role,
                reason: reason
            }
        }
    };

    if (staffId) {
        updateData.assignedTo = { connect: { id: parseInt(staffId) } };
    } else {
        updateData.assignedTo = { disconnect: true };
    }

    const updatedTicket = await prisma.ticket.update({
        where: { id: String(ticketId) },
        data: updateData,
        include: { assignedTo: { select: { id: true, name: true, username: true } } }
    });

    // Notify Admins
    const admins = await prisma.user.findMany({
        where: { branchId: updatedTicket.branchId, role: 'admin' }
    });

    for (const admin of admins) {
        await createNotification({
            userId: admin.id,
            title: 'Staff Reassign Update',
            message: staffId 
                ? `Staff (${req.user.name}) reassigned ticket #${updatedTicket.ticketId} to colleague. Reason: ${reason}`
                : `Staff (${req.user.name}) requested reassignment for ticket #${updatedTicket.ticketId}. Reason: ${reason}`,
            type: 'WARNING',
            ticketId: updatedTicket.id,
            link: `/ticketing?id=${updatedTicket.id}`
        });
    }

    // Notify New Staff if applicable
    if (staffId && updatedTicket.assignedTo) {
        await createNotification({
            userId: parseInt(staffId),
            title: 'Ticket Reassigned to You',
            message: `Colleague (${req.user.name}) reassigned ticket #${updatedTicket.ticketId} to you. Reason: ${reason}`,
            type: 'INFO',
            ticketId: updatedTicket.id,
            link: `/ticketing?id=${updatedTicket.id}`
        });
    }

    res.json(updatedTicket);
});

// @desc    Complete ticket (Staff/Admin)
exports.completeTicket = asyncHandler(async (req, res) => {
    const { ticketId } = req.body;
    const ticket = await prisma.ticket.findUnique({ where: { id: String(ticketId) } });

    if (!ticket) {
        res.status(404);
        throw new Error('Ticket not found');
    }

    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    const isAssignedStaff = ticket.assignedToId === req.user.id;

    if (!isAdmin && !isAssignedStaff) {
        res.status(403);
        throw new Error('Not authorized to complete this ticket');
    }

    const updatedTicket = await prisma.ticket.update({
        where: { id: String(ticketId) },
        data: {
            status: 'Closed',
            history: {
                create: {
                    action: 'Completed',
                    message: `Ticket completed by ${req.user.name || req.user.username}`,
                    doneById: req.user.id,
                    role: req.user.role
                }
            }
        }
    });

    // Notify Customer
    if (updatedTicket.customerId) {
        await createNotification({
            userId: updatedTicket.customerId,
            title: 'Ticket Completed',
            message: `Your ticket #${updatedTicket.ticketId} has been resolved and closed.`,
            type: 'SUCCESS',
            ticketId: updatedTicket.id,
            link: `/ticketing?id=${updatedTicket.id}`
        });
    }

    // Notify Admin if staff completed
    if (!isAdmin) {
        const admins = await prisma.user.findMany({
            where: { branchId: updatedTicket.branchId, role: 'admin' }
        });

        for (const admin of admins) {
            await createNotification({
                userId: admin.id,
                title: 'Ticket Completed',
                message: `Staff (${req.user.name}) completed ticket #${updatedTicket.ticketId}`,
                type: 'SUCCESS',
                ticketId: updatedTicket.id,
                link: `/ticketing?id=${updatedTicket.id}`
            });
        }
    }

    res.json(updatedTicket);
});

// @desc    Create Category
exports.createCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400);
    throw new Error('Category name is required');
  }
  const category = await prisma.ticketCategory.create({ data: { name } });
  res.status(201).json(category);
});

// @desc    Update Category
exports.updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const category = await prisma.ticketCategory.update({
    where: { id: parseInt(id) },
    data: { name }
  });
  res.json(category);
});

// @desc    Delete Category
exports.deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.ticketCategory.delete({ where: { id: parseInt(id) } });
  res.json({ message: 'Category removed' });
});

// @desc    Accept/Reject Ticket (Admin Only)
exports.handleTicketDecision = asyncHandler(async (req, res) => {
  const { ticketId, action, reason, staffId } = req.body; // action: ACCEPT / REJECT
  
  if (req.user.role !== 'admin') {
      res.status(403);
      throw new Error('Admins only');
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: String(ticketId) }, include: { customer: true } });
  if (!ticket) {
      res.status(404);
      throw new Error('Ticket not found');
  }

  let updateData = {};
  let historyMessage = "";

  if (action === 'ACCEPT') {
      updateData = {
          status: staffId ? 'ASSIGNED' : 'IN_PROGRESS',
      };
      if (staffId) {
          updateData.assignedTo = { connect: { id: parseInt(staffId) } };
      } else {
          updateData.assignedTo = { disconnect: true };
      }
      historyMessage = `Ticket accepted by Admin. Status: ${staffId ? 'ASSIGNED' : 'IN_PROGRESS'}.`;
      
      // Notify Customer
      if (ticket.customerId) {
          const staffName = staffId ? 'Assigned Support' : 'Support Center';
          await createNotification({
              userId: ticket.customerId,
              title: 'Ticket Accepted',
              message: `Your ticket (${ticket.title}) has been accepted and assigned to (${staffName})`,
              type: 'SUCCESS',
              ticketId: ticket.id,
              link: `/ticketing?id=${ticket.id}`
          });
      }
  } else {
      updateData = {
          status: 'REJECTED'
      };
      historyMessage = `Ticket REJECTED by Admin. Reason: ${reason || 'N/A'}`;

      // Notify Customer with reason
      if (ticket.customerId) {
          await createNotification({
              userId: ticket.customerId,
              title: 'Ticket Rejected',
              message: `Your ticket (${ticket.title}) was rejected. Reason: (${reason || 'N/A'})`,
              type: 'ERROR',
              ticketId: ticket.id,
              link: `/ticketing?id=${ticket.id}`
          });
      }
  }

  const updatedTicket = await prisma.ticket.update({
      where: { id: String(ticketId) },
      data: {
          ...updateData,
          history: {
              create: {
                  action: action === 'ACCEPT' ? 'StatusChanged' : 'Rejected',
                  message: historyMessage,
                  doneById: req.user.id,
                  role: 'admin'
              }
          }
      }
  });

  res.json(updatedTicket);
});
