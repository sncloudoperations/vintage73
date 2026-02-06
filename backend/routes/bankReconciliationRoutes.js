const express = require('express');
const router = express.Router();
const reconController = require('../controllers/bankReconciliationController');

router.get('/transactions', reconController.getUnreconciledTransactions);
router.post('/reconcile', reconController.reconcileTransactions);
router.get('/summary', reconController.getReconciliationSummary);

module.exports = router;
