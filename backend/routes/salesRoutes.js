const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

router.post('/', salesController.createSale);
router.get('/', salesController.getAllSales);

router.put('/:id/cancel', salesController.cancelSale);

module.exports = router;
