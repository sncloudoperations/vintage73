const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const upload = require('../middleware/uploadMiddleware');

router.get('/', companyController.getCompanyProfile);
router.post('/', upload.single('logo'), companyController.updateCompanyProfile);

module.exports = router;
