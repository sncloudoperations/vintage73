const prisma = require('../utils/prismaClient');

// Get user notifications
exports.getNotifications = async (req, res) => {
    const userId = req.user.id;

    try {
        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20 // Last 20 notifications
        });
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        await prisma.notification.update({
            where: { id: parseInt(id), userId },
            data: { isRead: true }
        });
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create a new notification (Utility function for subsequent use)
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
        io.to(`user_${userId}`).emit('new_notification', notification);

        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
    }
};
