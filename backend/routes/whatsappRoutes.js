const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/settings', whatsappController.getSettings);
router.post('/settings', whatsappController.updateSettings);
router.post('/send', whatsappController.sendMessage);
router.get('/logs', whatsappController.getLogs);

module.exports = router;
