const express = require('express');
const router = express.Router();
const accountingController = require('../controllers/accountingController');
const accountingReportsController = require('../controllers/accountingReportsController');
const authMiddleware = require('../middleware/authMiddleware');

// ==================== ACCOUNT GROUPS ====================
router.get('/groups', accountingController.getAccountGroups);
router.post('/groups', accountingController.createAccountGroup);

// ==================== LEDGERS ====================
router.get('/ledgers', accountingController.getLedgers);
router.post('/ledgers', accountingController.createLedger);
router.put('/ledgers/:id', accountingController.updateLedger);
router.delete('/ledgers/:id', accountingController.deleteLedger);

// ==================== VOUCHERS ====================
router.post('/vouchers/payment', authMiddleware, accountingController.createPaymentVoucher);
router.post('/vouchers/receipt', authMiddleware, accountingController.createReceiptVoucher);
router.post('/vouchers/journal', authMiddleware, accountingController.createJournalEntry);
router.post('/vouchers/contra', authMiddleware, accountingController.createContraEntry);
router.get('/vouchers', accountingController.getVouchers);
router.get('/vouchers/:id', accountingController.getVoucher);
router.put('/vouchers/:id', authMiddleware, accountingController.updateVoucher);
router.delete('/vouchers/:id', authMiddleware, accountingController.deleteVoucher);
router.post('/vouchers/:id/cancel', authMiddleware, accountingController.cancelVoucher);

// ==================== REPORTS ====================
router.get('/reports/trial-balance', accountingReportsController.getTrialBalance);
router.get('/reports/profit-loss', accountingReportsController.getProfitLoss);
router.get('/reports/balance-sheet', accountingReportsController.getBalanceSheet);
router.get('/reports/ledger-statement', accountingReportsController.getLedgerStatement);
router.get('/reports/day-book', accountingReportsController.getDayBook);

module.exports = router;
