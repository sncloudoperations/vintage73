const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { createNotification } = require('../utils/notificationHelper');

// Helper to generate Ticket ID (e.g., TKT-1001)
const generateTicketId = async () => {
  const count = await prisma.ticket.count();
  return `TKT-${1000 + count + 1}`;
};

// @desc    Create a new ticket
// @route   POST /api/tickets
// @access  Private
exports.createTicket = asyncHandler(async (req, res) => {
  let { title, description, priority, categoryName, categoryId, branchId, customerId, assignedToId } = req.body;
  
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

  const requesterId = req.user.role === 'customer' ? req.user.id : (customerId ? parseInt(customerId) : null);
  const targetBranchId = branchId ? parseInt(branchId) : (req.user.branchId || 1);

  if (req.user.role === 'staff') {
    res.status(403);
    throw new Error('Staff are not authorized to create tickets');
  }

  if (!title || !description || !priority || !targetBranchId) {
    res.status(400);
    throw new Error('Please provide all required fields (title, description, priority, branch)');
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

  // Auto-Assign Deployment
  let ticketStatus = 'Pending';
  let finalAssignedToId = assignedToId ? parseInt(assignedToId) : null;
  
  if (finalAssignedToId && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
    ticketStatus = 'InProgress';
    const staff = await prisma.user.findUnique({ where: { id: finalAssignedToId } });
    if (staff) {
      historyData.push({
        action: 'Assigned',
        message: `Support personnel ${staff.name || staff.username} assigned during initialization by ${req.user.name || req.user.username}`,
        doneById: req.user.id,
        role: req.user.role
      });
    }
  }

  const ticket = await prisma.ticket.create({
    data: {
      ticketId: customTicketId,
      title,
      description,
      categoryName: categoryName || null,
      categoryId: finalCategoryId,
      priority,
      branchId: targetBranchId,
      customerId: requesterId,
      assignedToId: finalAssignedToId,
      createdByRole: req.user.role,
      status: ticketStatus,
      slaStatus: 'OnTime',
      fileUrl: fileUrl,
      history: {
        create: historyData
      }
    },
    include: {
      category: true,
      history: true,
      customer: true,
      assignedTo: {
        select: { id: true, name: true, username: true }
      },
      branch: true
    }
  });

  // --- NOTIFICATION 1: CUSTOMER CREATES TICKET ---
  // PROMPT: Customer (name) created ticket -> show only to Admin + Staff
  if (targetBranchId) {
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

    // If auto-assigned, notify staff
    if (finalAssignedToId) {
        await createNotification({
            userId: finalAssignedToId,
            title: 'New Ticket Assigned',
            message: `A new ticket (${title}) has been automatically assigned to you.`,
            type: 'INFO',
            ticketId: ticket.id,
            link: `/ticketing?id=${ticket.id}`
        });
    }
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
  if (role === 'customer') {
    where.AND.push({ customerId: parseInt(id) });
  } else if (role === 'staff') {
    where.AND.push({ assignedToId: parseInt(id) });
  } else if (role === 'admin' && userBranchId) {
    where.AND.push({ branchId: parseInt(userBranchId) });
  } else if (role === 'superadmin' || (role === 'admin' && !userBranchId)) {
    // Global access
  } else {
    where.AND.push({ id: 'ACCESS_DENIED_LOCKOUT' });
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

  res.json(tickets);
});

// @desc    Assign/Reassign ticket
exports.assignTicket = asyncHandler(async (req, res) => {
  const { ticketId, staffId } = req.body;

  if (req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Only admins can assign/reassign tickets');
  }

  const staff = await prisma.user.findUnique({ where: { id: parseInt(staffId) } });
  if (!staff) {
    res.status(404);
    throw new Error('Support personnel not found');
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      assignedToId: parseInt(staffId),
      status: 'InProgress',
      history: {
        create: {
          action: 'Assigned',
          message: `Ticket assigned to ${staff.name || staff.username} by Admin ${req.user.name || req.user.username}`,
          doneById: req.user.id,
          role: 'admin'
        }
      }
    }
  });

  // --- NOTIFICATION 2/3: ADMIN ASSIGNS STAFF ---
  // Notify Customer 
  if (updatedTicket.customerId) {
    await createNotification({
        userId: updatedTicket.customerId,
        title: 'Ticket Assigned',
        message: `Your ticket (${updatedTicket.title}) has been assigned to a support agent.`,
        type: 'SUCCESS',
        ticketId: updatedTicket.id,
        link: `/ticketing?id=${updatedTicket.id}`
    });
  }

  // Notify Staff
  await createNotification({
    userId: parseInt(staffId),
    title: 'New Assignment',
    message: `You have been assigned to ticket (${updatedTicket.title}) by Admin.`,
    type: 'SUCCESS',
    ticketId: updatedTicket.id,
    link: `/ticketing?id=${updatedTicket.id}`
  });

  res.json(updatedTicket);
});

// @desc    Update status
exports.updateStatus = asyncHandler(async (req, res) => {
  const { ticketId, status, message } = req.body;
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  
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
    where: { id: ticketId },
    data: {
      status,
      history: {
        create: {
          action: 'StatusChanged',
          message: message || `Status updated to ${status} by ${req.user.name || req.user.username}`,
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
    where: { id: ticketId },
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

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
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
    where: { id: ticketId },
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
        status: 'InProgress', // Per prompt: Status -> InProgress after releasing staff
        assignedToId: null,   // Staff should NOT see that ticket again
        history: {
          create: {
            action: 'StaffReleased',
            message: `Staff closure approved. Ticket remains InProgress for final review. ${adminComment || ''}`,
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
        data: { status: 'InProgress' }
    });

    await prisma.ticketHistory.create({
      data: {
        ticketId: request.ticketId,
        action: 'StatusChanged',
        message: `Closure request rejected by Admin. Reason: ${adminComment || 'N/A'}`,
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

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    res.status(404);
    throw new Error('Ticket not found');
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id: ticketId },
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

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { customer: true } });
  if (!ticket) {
      res.status(404);
      throw new Error('Ticket not found');
  }

  let updateData = {};
  let historyMessage = "";

  if (action === 'ACCEPT') {
      updateData = {
          status: 'InProgress',
          assignedToId: staffId ? parseInt(staffId) : null
      };
      historyMessage = `Ticket accepted by Admin. Status: InProgress.`;
      
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
          status: 'Rejected'
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
      where: { id: ticketId },
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
