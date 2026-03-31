const prisma = require('../config/prisma');
const { getIO } = require('./socket');

/**
 * Global Notification Helper
 * Saves to DB + Emits via Socket.io
 * Now supports ticketId for deep linking
 */
const createNotification = async ({ userId, title, message, type = 'INFO', ticketId = null, link = null }) => {
    try {
        if (!userId) return null;

        // 1. Save to Database
        const notification = await prisma.notification.create({
            data: {
                userId: parseInt(userId),
                title,
                message,
                type,
                ticketId: ticketId ? ticketId.toString() : null,
                link
            }
        });

        // 2. Emit via Socket.io for Real-time
        try {
            const io = getIO();
            io.to(`user_${userId}`).emit('new_notification', notification);
        } catch (socketErr) {
            console.warn('[NOTIFICATION_HELPER] Socket emit failed:', socketErr.message);
        }

        return notification;
    } catch (err) {
        console.error('[NOTIFICATION_HELPER] Error creating notification:', err);
        return null;
    }
};

module.exports = { createNotification };
