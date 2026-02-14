const express = require('express');
const router = express.Router();
const creditController = require('../controllers/creditController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', creditController.getDebtors);
router.post('/settle', creditController.settleCredit);
router.get('/:id', creditController.getCustomerCredits);

module.exports = router;
