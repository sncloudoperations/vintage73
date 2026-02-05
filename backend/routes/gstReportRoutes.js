const express = require('express');
const router = express.Router();
const { getGSTR1, getGSTR3B, getHSNSummary } = require('../controllers/gstReportController');
const protect = require('../middleware/authMiddleware');

router.get('/gstr-1', protect, getGSTR1);
router.get('/gstr-3b', protect, getGSTR3B);
router.get('/hsn-summary', protect, getHSNSummary);

module.exports = router;
