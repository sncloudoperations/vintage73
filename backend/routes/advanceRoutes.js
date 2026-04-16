const express = require('express');
const router = express.Router();
const { getAdvances, getCustomerAdvanceBalance, addAdvance, getAdvanceHistory } = require('../controllers/advanceController');
const protect = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getAdvances)
    .post(protect, addAdvance);

router.route('/customer/:customerId')
    .get(protect, getCustomerAdvanceBalance);

router.route('/history/:customerId')
    .get(protect, getAdvanceHistory);

module.exports = router;
