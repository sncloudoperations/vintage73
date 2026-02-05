const express = require('express');
const router = express.Router();
const {
    createQuotation,
    getQuotations,
    getQuotationById,
    updateQuotation,
    convertToSale,
    recordAdvance
} = require('../controllers/quotationController');
const protect = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, createQuotation)
    .get(protect, getQuotations);

router.route('/:id')
    .get(protect, getQuotationById)
    .put(protect, updateQuotation);

router.post('/:id/convert', protect, convertToSale);
router.post('/:id/advance', protect, recordAdvance);

module.exports = router;
