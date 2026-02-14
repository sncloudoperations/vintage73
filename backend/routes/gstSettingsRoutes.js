const express = require('express');
const router = express.Router();
const gstSettingsController = require('../controllers/gstSettingsController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', gstSettingsController.getSettings);
router.post('/', gstSettingsController.updateSettings);

module.exports = router;
