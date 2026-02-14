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

router.use(protect);

router.route('/')
    .post(createQuotation)
    .get(getQuotations);

router.route('/:id')
    .get(getQuotationById)
    .put(updateQuotation);

router.post('/:id/convert', convertToSale);
router.post('/:id/advance', recordAdvance);

module.exports = router;
