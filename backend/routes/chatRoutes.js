const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');
const chatUpload = require('../middleware/chatUploadMiddleware');

router.get('/conversations', authMiddleware, chatController.getConversations);
router.get('/messages/:otherUserId', authMiddleware, chatController.getMessages);
router.get('/messages/:otherUserId/search', authMiddleware, chatController.searchMessages);
router.post('/messages', authMiddleware, chatUpload.single('attachment'), chatController.sendMessage);
router.put('/messages/read/:senderId', authMiddleware, chatController.markAsRead);

module.exports = router;
