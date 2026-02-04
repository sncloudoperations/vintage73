const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// Define route for fetching all dashboard stats
router.get('/stats', dashboardController.getDashboardStats);

module.exports = router;
