const express = require('express');
const router = express.Router();
const creditController = require('../controllers/creditController');

router.get('/', creditController.getDebtors);
router.post('/settle', creditController.settleCredit);
router.get('/:id', creditController.getCustomerCredits);

module.exports = router;
