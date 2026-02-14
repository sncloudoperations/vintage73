const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

// Get user notifications
exports.getNotifications = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20 // Last 20 notifications
    });
    res.json(notifications);
});

// Mark notification as read
exports.markAsRead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    await prisma.notification.update({
        where: { id: parseInt(id), userId },
        data: { isRead: true }
    });
    res.json({ message: 'Notification marked as read' });
});

// Create a new notification (Utility function for subsequent use)
// This is an internal utility, but we keep it async. 
// It doesn't need asyncHandler since it's not an Express route directly, 
// but it's used within routes that are.
exports.createNotification = async (userId, title, message, type = 'INFO', link = null) => {
    try {
        const notification = await prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type,
                link
            }
        });

        // Trigger socket alert
        const { getIO } = require('../utils/socket');
        const io = getIO();
        if (io) {
            io.to(`user_${userId}`).emit('new_notification', notification);
        }

        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
    }
};
