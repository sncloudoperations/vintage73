const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const upload = require('../middleware/uploadMiddleware');

router.get('/', companyController.getCompanyProfile);
router.post('/', upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'dashboardImage', maxCount: 1 }]), companyController.updateCompanyProfile);

module.exports = router;
