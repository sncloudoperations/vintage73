const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Define route for fetching all dashboard stats
router.get('/stats', dashboardController.getDashboardStats);

module.exports = router;
