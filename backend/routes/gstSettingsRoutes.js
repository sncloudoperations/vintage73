const express = require('express');
const router = express.Router();
const gstSettingsController = require('../controllers/gstSettingsController');

router.get('/', gstSettingsController.getSettings);
router.post('/', gstSettingsController.updateSettings);

module.exports = router;
