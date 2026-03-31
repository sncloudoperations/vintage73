const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, markAllRead } = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', getNotifications);
router.put('/read-all', markAllRead);
router.put('/:id/read', markAsRead);

module.exports = router;
