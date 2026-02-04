const express = require('express');
const router = express.Router();
const accountsController = require('../controllers/accountsController');

router.get('/expenses', accountsController.getExpenses);
router.post('/expenses', accountsController.createExpense);
router.get('/payments', accountsController.getPayments);
router.post('/payments', accountsController.createPayment);
router.get('/outstanding', accountsController.getOutstanding);

module.exports = router;
