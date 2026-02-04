const express = require('express');
const router = express.Router();
const barcodeSettingController = require('../controllers/barcodeSettingController');

router.get('/:branchId', barcodeSettingController.getSettings);
router.put('/:branchId', barcodeSettingController.updateSettings);

module.exports = router;
