const express = require('express');
const router = express.Router();
const { getGSTR1, getGSTR3B, getHSNSummary } = require('../controllers/gstReportController');
const protect = require('../middleware/authMiddleware');

router.use(protect);

router.get('/gstr-1', getGSTR1);
router.get('/gstr-3b', getGSTR3B);
router.get('/hsn-summary', getHSNSummary);

module.exports = router;
