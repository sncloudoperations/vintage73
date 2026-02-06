const express = require('express');
const router = express.Router();
const accountingController = require('../controllers/accountingController');
const postingSetupController = require('../controllers/postingSetupController');
const accountingReportsController = require('../controllers/accountingReportsController');
const authMiddleware = require('../middleware/authMiddleware');
const checkFinancialYear = require('../middleware/checkFinancialYear');

// ==================== POSTING SETUP ====================
console.log('Registering Posting Setup Routes...');
router.get('/posting-setup/metadata', postingSetupController.getSchemaMetadata);
router.get('/posting-setup', postingSetupController.getAllPostings);
router.post('/posting-setup/bulk', postingSetupController.bulkUpsertPostings);
router.post('/posting-setup', postingSetupController.upsertPosting);
router.delete('/posting-setup/:id', postingSetupController.deletePosting);

// ==================== ACCOUNT GROUPS ====================
router.get('/groups', accountingController.getAccountGroups);
router.post('/groups', accountingController.createAccountGroup);

// ==================== LEDGERS ====================
router.get('/ledgers', accountingController.getLedgers);
router.post('/ledgers', accountingController.createLedger);
router.put('/ledgers/:id', accountingController.updateLedger);
router.delete('/ledgers/:id', accountingController.deleteLedger);

// ==================== VOUCHERS ====================
router.post('/vouchers/payment', authMiddleware, checkFinancialYear, accountingController.createPaymentVoucher);
router.post('/vouchers/receipt', authMiddleware, checkFinancialYear, accountingController.createReceiptVoucher);
router.post('/vouchers/journal', authMiddleware, checkFinancialYear, accountingController.createJournalEntry);
router.post('/vouchers/contra', authMiddleware, checkFinancialYear, accountingController.createContraEntry);
router.get('/vouchers', accountingController.getVouchers);
router.get('/vouchers/:id', accountingController.getVoucher);
router.put('/vouchers/:id', authMiddleware, checkFinancialYear, accountingController.updateVoucher);
router.delete('/vouchers/:id', authMiddleware, checkFinancialYear, accountingController.deleteVoucher);
router.post('/vouchers/:id/cancel', authMiddleware, checkFinancialYear, accountingController.cancelVoucher);

// ==================== REPORTS ====================
router.get('/reports/trial-balance', accountingReportsController.getTrialBalance);
router.post('/bulk-post', authMiddleware, accountingController.bulkPostTransactions);
router.get('/reports/profit-loss', accountingReportsController.getProfitLoss);
router.get('/reports/balance-sheet', accountingReportsController.getBalanceSheet);
router.get('/reports/ledger-statement', accountingReportsController.getLedgerStatement);
router.get('/reports/day-book', accountingReportsController.getDayBook);

module.exports = router;
