const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', purchaseController.createPurchase);
router.get('/', purchaseController.getPurchases);
router.delete('/:id', purchaseController.deletePurchase);

module.exports = router;
