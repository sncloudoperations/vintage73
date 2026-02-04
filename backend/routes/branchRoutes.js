const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');

router.get('/', branchController.getBranches);
router.get('/:id', branchController.getBranchById);
router.post('/', branchController.createBranch);
router.put('/:id', branchController.updateBranch);
router.put('/:id/invoice-settings', branchController.updateInvoiceSettings);
router.delete('/:id', branchController.deleteBranch);

module.exports = router;
