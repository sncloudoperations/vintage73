const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', salesController.createSale);
router.get('/', salesController.getAllSales);

router.put('/:id/cancel', salesController.cancelSale);

module.exports = router;
