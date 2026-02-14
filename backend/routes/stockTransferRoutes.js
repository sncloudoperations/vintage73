const express = require('express');
const router = express.Router();
const stockTransferController = require('../controllers/stockTransferController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', stockTransferController.createTransfer);
router.get('/', stockTransferController.getTransfers);
router.put('/:id/receive', stockTransferController.receiveTransfer);
router.put('/:id/cancel', stockTransferController.cancelTransfer);

module.exports = router;
