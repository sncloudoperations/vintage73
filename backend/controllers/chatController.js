const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');

// Get message history between two users with pagination
exports.getMessages = asyncHandler(async (req, res) => {
    const { otherUserId } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await prisma.chatMessage.findMany({
        where: {
            OR: [
                { senderId: userId, receiverId: parseInt(otherUserId) },
                { senderId: parseInt(otherUserId), receiverId: userId }
            ]
        },
        orderBy: { createdAt: 'desc' }, // Latest first for pagination
        skip: skip,
        take: parseInt(limit)
    });

    // Return in chronological order
    res.json(messages.reverse());
});

// Send a new message (persisting to DB) with attachment support
exports.sendMessage = asyncHandler(async (req, res) => {
    const { receiverId, message, attachmentType, attachmentName } = req.body;
    const senderId = req.user.id;

    let attachmentUrl = null;
    if (req.file) {
        attachmentUrl = `/uploads/chat/${req.file.filename}`;
    }

    const chatMessage = await prisma.chatMessage.create({
        data: {
            senderId,
            receiverId: parseInt(receiverId),
            message: message || null,
            attachmentUrl,
            attachmentType: attachmentType || (req.file ? req.file.mimetype.startsWith('image/') ? 'IMAGE' : 'FILE' : null),
            attachmentName: attachmentName || (req.file ? req.file.originalname : null)
        }
    });
    res.status(201).json(chatMessage);
});

// Search messages in a conversation
exports.searchMessages = asyncHandler(async (req, res) => {
    const { otherUserId } = req.params;
    const { query } = req.query;
    const userId = req.user.id;

    if (!query) return res.json([]);

    const messages = await prisma.chatMessage.findMany({
        where: {
            AND: [
                {
                    OR: [
                        { senderId: userId, receiverId: parseInt(otherUserId) },
                        { senderId: parseInt(otherUserId), receiverId: userId }
                    ]
                },
                {
                    OR: [
                        { message: { contains: query, mode: 'insensitive' } },
                        { attachmentName: { contains: query, mode: 'insensitive' } }
                    ]
                }
            ]
        },
        orderBy: { createdAt: 'desc' },
        take: 20
    });
    res.json(messages);
});

// Get list of active conversations for a user
exports.getConversations = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Get all users except current user
    const users = await prisma.user.findMany({
        where: { id: { not: userId } },
        select: {
            id: true,
            username: true,
            name: true,
            role: true,
            branch: { select: { name: true } }
        }
    });

    // Get unread counts for each conversation
    const unreadCounts = await prisma.chatMessage.groupBy({
        by: ['senderId'],
        where: {
            receiverId: userId,
            isRead: false
        },
        _count: {
            id: true
        }
    });

    const countsMap = unreadCounts.reduce((acc, curr) => {
        acc[curr.senderId] = curr._count.id;
        return acc;
    }, {});

    const result = users.map(user => ({
        ...user,
        unreadCount: countsMap[user.id] || 0
    }));

    res.json(result);
});

// Mark messages as read
exports.markAsRead = asyncHandler(async (req, res) => {
    const { senderId } = req.params;
    const userId = req.user.id;

    await prisma.chatMessage.updateMany({
        where: {
            senderId: parseInt(senderId),
            receiverId: userId,
            isRead: false
        },
        data: { isRead: true }
    });
    res.json({ message: 'Messages marked as read' });
});
