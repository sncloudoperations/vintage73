const express = require('express');
const router = express.Router();
const challanController = require('../controllers/deliveryChallanController');

router.post('/', challanController.createChallan);
router.get('/', challanController.getAllChallans);
router.get('/:id', challanController.getChallan);
router.put('/:id/status', challanController.updateStatus);
router.get('/:id/print', challanController.getChallanForPrint);

module.exports = router;
