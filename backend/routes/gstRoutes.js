const express = require('express');
const router = express.Router();
const gstController = require('../controllers/gstController');

// Verify GSTIN and fetch details
router.get('/verify/:gstin', gstController.verifyGSTIN);

// Search GSTIN in database
router.get('/search', gstController.searchGSTIN);

module.exports = router;
