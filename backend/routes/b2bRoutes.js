const express = require('express');
const router = express.Router();
const b2bController = require('../controllers/b2bSalesController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/invoices', b2bController.createB2BInvoice);
router.get('/invoices', b2bController.getB2BInvoices);
router.get('/invoices/:id/print', b2bController.getInvoiceForPrint);
router.put('/invoices/:id/eway-bill', b2bController.updateEwayBill);

module.exports = router;
