const express = require('express');
const router = express.Router();
const bankController = require('../controllers/bankController');

router.get('/', bankController.getBanks);
router.post('/', bankController.createBank);
router.put('/:id', bankController.updateBank);
router.delete('/:id', bankController.deleteBank);

module.exports = router;
