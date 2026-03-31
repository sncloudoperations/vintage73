const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Public route to fetch theme properties for the login screen
router.get('/', companyController.getCompanyProfile);

// Protected routes
router.use(authMiddleware);
router.post('/', upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'dashboardImage', maxCount: 1 }]), companyController.updateCompanyProfile);

module.exports = router;
