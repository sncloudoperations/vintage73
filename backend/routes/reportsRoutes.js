const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/sales-analytics', reportsController.getSalesAnalyticsReport);
router.get('/', reportsController.getSalesReports);
router.get('/payments', reportsController.getDailyPaymentReport);
router.get('/stock-movement', reportsController.getStockMovementRegister);
router.get('/stock-summary', reportsController.getStockSummary);
router.get('/current-stock', reportsController.getCurrentStockBalance);

module.exports = router;
