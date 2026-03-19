const express = require('express');
const router = express.Router();
const financialYearController = require('../controllers/financialYearController');
const protect = require('../middleware/authMiddleware'); // Fixed import

router.get('/', protect, financialYearController.getAllFinancialYears);
router.post('/', protect, financialYearController.createFinancialYear);
router.put('/:id', protect, financialYearController.updateFinancialYear);
router.get('/:id/preview', protect, financialYearController.previewClosing);
router.post('/:id/close', protect, financialYearController.closeFinancialYear);

module.exports = router;
