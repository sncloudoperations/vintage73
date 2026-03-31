const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get current user notifications
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 50
    });
    res.json(notifications);
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const notification = await prisma.notification.updateMany({
        where: { 
            id: id,
            userId: req.user.id 
        },
        data: { isRead: true }
    });
    res.json({ message: 'Marked as read' });
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
exports.markAllRead = asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
        where: { userId: req.user.id },
        data: { isRead: true }
    });
    res.json({ message: 'All marked as read' });
});
