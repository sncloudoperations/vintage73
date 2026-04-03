const express = require("express");
const router = express.Router();
const invoiceSettingsController = require("../controllers/invoiceSettingsController");
const authMiddleware = require("../middleware/authMiddleware");

// Protected routes (Only authorized users can manage settings)
router.use(authMiddleware);

router.get("/", invoiceSettingsController.getInvoiceSettings);
router.post("/", invoiceSettingsController.updateInvoiceSettings);

module.exports = router;
