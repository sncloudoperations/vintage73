const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

router.get('/', customerController.getCustomers);
router.post('/', customerController.createCustomer);
router.put('/:id', customerController.updateCustomer);
router.get('/:id/balance', customerController.getCustomerBalance);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
