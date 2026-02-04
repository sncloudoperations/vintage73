
import { 
  FiHome, FiUsers, FiBox, FiShoppingBag, FiTruck, FiBarChart2, FiSettings, FiGrid,
  FiDollarSign, FiBook, FiPackage, FiBriefcase, FiCheckCircle, FiLayers, FiCreditCard, FiClock,
  FiDatabase, FiTarget, FiShoppingCart, FiUsers as FiUserGroup, FiArchive, FiFileText,
  FiPieChart, FiClipboard, FiRefreshCw, FiList, FiActivity, FiCalendar, FiArrowDownLeft, FiArrowUpRight, FiKey
} from 'react-icons/fi';
import { TbBarcode, TbReportAnalytics, TbReceipt } from 'react-icons/tb';

export const MENU_STRUCTURE = [
  {
    title: 'ACCOUNTING',
    icon: FiFileText,
    items: [
      { name: 'Balance Sheet', icon: FiClipboard, path: '/accounting/reports/balance-sheet' },
      { name: 'Cash Book', icon: FiBook, path: '/accounting/reports/cash-book' },
      { name: 'Chart of Accounts', icon: FiLayers, path: '/accounting/chart-of-accounts' },
      { name: 'Contra Entry', icon: FiRefreshCw, path: '/accounting/vouchers/contra' },
      { name: 'Journal Entry', icon: FiFileText, path: '/accounting/vouchers/journal' },
      { name: 'Ledger Report', icon: FiList, path: '/accounting/reports/ledger' },
      { name: 'Payment Voucher', icon: FiArrowUpRight, path: '/accounting/vouchers/payment' },
      { name: 'Profit & Loss', icon: FiPieChart, path: '/accounting/reports/profit-loss' },
      { name: 'Receipt Voucher', icon: FiArrowDownLeft, path: '/accounting/vouchers/receipt' },
      { name: 'Trial Balance', icon: FiActivity, path: '/accounting/reports/trial-balance' },
    ]
  },
  {
    title: 'CRM',
    icon: FiTarget,
    items: [
      { name: 'Dashboard', icon: FiBarChart2, path: '/crm' },
      { name: 'Deals Pipeline', icon: FiBriefcase, path: '/crm/deals' },
      { name: 'Leads', icon: FiUsers, path: '/crm/leads' },
      { name: 'Tasks', icon: FiCheckCircle, path: '/crm/tasks' },
    ]
  },
  {
    title: 'HRMS',
    icon: FiUserGroup,
    items: [
      { name: 'Attendance', icon: FiCheckCircle, path: '/hrms/attendance' },
      { name: 'Attendance Sheet', icon: FiList, path: '/hrms/attendance-sheet' },
      { name: 'Bank Statement', icon: FiCreditCard, path: '/hrms/bank-statement' },
      { name: 'Dashboard', icon: FiGrid, path: '/hrms' },
      { name: 'Departments', icon: FiLayers, path: '/hrms/departments' },
      { name: 'Designations', icon: FiBriefcase, path: '/hrms/designations' },
      { name: 'Leave Types', icon: FiSettings, path: '/hrms/leave-types' },
      { name: 'Leaves', icon: FiCalendar, path: '/hrms/leaves' },
      { name: 'Miss Punch', icon: FiClock, path: '/hrms/miss-punch' },
      { name: 'Payroll', icon: FiDollarSign, path: '/hrms/payroll' },
      { name: 'Salary Advance', icon: FiDollarSign, path: '/hrms/salary-advance' },
      { name: 'Salary Processing', icon: FiCreditCard, path: '/hrms/salary-processing' },
    ]
  },
  {
    title: 'INVENTORY',
    icon: FiArchive,
    items: [
      { name: 'Barcode Generator', icon: TbBarcode, path: '/barcode' },
      { name: 'Purchase Entry', icon: FiShoppingBag, path: '/purchase' },
      { name: 'Stock Receipt', icon: FiPackage, path: '/stock-receipt' },
      { name: 'Stock Transfer', icon: FiTruck, path: '/stock-transfer' },
      { name: 'Suppliers', icon: FiTruck, path: '/suppliers' },
    ]
  },
  {
    title: 'MASTER',
    icon: FiDatabase,
    items: [
      { name: 'Branches', icon: FiHome, path: '/branches' },
      { name: 'Bank Master', icon: FiCreditCard, path: '/master/banks' },
      { name: 'Company Profile', icon: FiSettings, path: '/company' },
      { name: 'Products', icon: FiBox, path: '/products' },
      { name: 'Report Design', icon: FiBarChart2, path: '/master/report-design' },
      { name: 'State Master', icon: FiArrowUpRight, path: '/master/states' },
      { name: 'Users', icon: FiUsers, path: '/users' },
    ]
  },
  {
    title: 'SALES',
    icon: FiShoppingCart,
    items: [
      { name: 'B2B Invoice', icon: FiFileText, path: '/sales/b2b-invoice' },
      { name: 'Credit Management', icon: FiDollarSign, path: '/credit' },
      { name: 'Customers', icon: FiUsers, path: '/customers' },
      { name: 'Delivery Challan', icon: FiTruck, path: '/sales/delivery-challan' },
      { name: 'New Sale (POS)', icon: FiGrid, path: '/pos' },
      { name: 'Sales Reports', icon: TbReportAnalytics, path: '/reports' },
      { name: 'Sales Return', icon: FiBox, path: '/sales-return' },
    ]
  },
  {
    title: 'SETTINGS',
    icon: FiSettings,
    items: [
      { name: 'GST Settings', icon: FiFileText, path: '/settings/gst-settings' },
      { name: 'Change Password', icon: FiKey, path: '/settings/change-password' },
    ]
  }
];
