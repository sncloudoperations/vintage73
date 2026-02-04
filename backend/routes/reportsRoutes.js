const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');

router.get('/', reportsController.getSalesReports);
router.get('/payments', reportsController.getDailyPaymentReport);

module.exports = router;
