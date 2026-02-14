const express = require('express');
const router = express.Router();
const barcodeSettingController = require('../controllers/barcodeSettingController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/:branchId', barcodeSettingController.getSettings);
router.put('/:branchId', barcodeSettingController.updateSettings);

module.exports = router;
