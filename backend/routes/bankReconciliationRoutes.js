const express = require('express');
const router = express.Router();
const reconController = require('../controllers/bankReconciliationController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/transactions', reconController.getUnreconciledTransactions);
router.post('/reconcile', reconController.reconcileTransactions);
router.get('/summary', reconController.getReconciliationSummary);

module.exports = router;
