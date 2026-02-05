// Server Entry Point
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const authRoutes = require('./routes/authRoutes');
// const productRoutes = require('./routes/productRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../frontend/public/uploads')));

// Routes
app.get("/", (req, res) => {
  res.send("Billing Software API is running...");
});

app.use('/api/auth', authRoutes);
app.use('/api/company', require('./routes/companyRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/purchases', require('./routes/purchaseRoutes'));
app.use('/api/sales', require('./routes/salesRoutes'));
app.use('/api/reports', require('./routes/reportsRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/accounts', require('./routes/accountsRoutes'));
app.use('/api/branches', require('./routes/branchRoutes'));
app.use('/api/transfers', require('./routes/stockTransferRoutes'));
app.use('/api/barcode-settings', require('./routes/barcodeSettingRoutes'));
app.use('/api/hrms', require('./routes/hrmsRoutes'));
app.use('/api/crm', require('./routes/crmRoutes'));
app.use('/api/credits', require('./routes/creditRoutes'));
app.use('/api/accounting', require('./routes/accountingRoutes'));
app.use('/api/states', require('./routes/stateRoutes'));
app.use('/api/gst-settings', require('./routes/gstSettingsRoutes'));
app.use('/api/gst', require('./routes/gstRoutes'));
app.use('/api/b2b', require('./routes/b2bRoutes'));
app.use('/api/delivery-challans', require('./routes/deliveryChallanRoutes'));
app.use('/api/banks', require('./routes/bankRoutes'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
