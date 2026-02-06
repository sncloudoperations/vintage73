const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const path = require('path');
const { initSocket } = require("./utils/socket");
const authRoutes = require('./routes/authRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../frontend/public/uploads')));

const server = http.createServer(app);
initSocket(server);

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
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/banks', require('./routes/bankRoutes'));
app.use('/api/financial-years', require('./routes/financialYearRoutes'));
app.use('/api/quotations', require('./routes/quotationRoutes'));
app.use('/api/reports/gst', require('./routes/gstReportRoutes'));
app.use('/api/whatsapp', require('./routes/whatsappRoutes'));
app.use('/api/terminals', require('./routes/terminalRoutes'));
app.use('/api/accounting/reconciliation', require('./routes/bankReconciliationRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
