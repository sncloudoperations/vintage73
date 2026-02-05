import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { 
  FiDollarSign, FiShoppingBag, FiBox, FiUsers, FiTrendingUp, FiArrowUpRight, FiPrinter
} from 'react-icons/fi';
import { HiOutlineReceiptRefund } from 'react-icons/hi';
import { TbBusinessplan } from 'react-icons/tb';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'react-toastify';
import DynamicInvoice from '@/components/DynamicInvoice';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [printSale, setPrintSale] = useState(null);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [invoiceSettings, setInvoiceSettings] = useState(null);
  const componentRef = useRef();

  useEffect(() => {
    fetchDashboardData();
    fetchCompanyData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchCompanyData = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      let branchId = null;
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed && !isNaN(parseInt(parsed.branchId))) {
             branchId = parseInt(parsed.branchId);
          }
        } catch (e) {
          console.error("Error parsing stored user", e);
        }
      }
      
      const [compRes, branchRes] = await Promise.all([
        api.get('/company'),
        branchId ? api.get(`/branches/${branchId}`) : null
      ]);

      if (compRes.data) {
        setCompanyProfile(compRes.data);
      }

      if (branchRes?.data?.invoiceSettings) {
        setInvoiceSettings(branchRes.data.invoiceSettings);
      } else if (compRes.data?.invoiceSettings) {
        setInvoiceSettings(compRes.data.invoiceSettings);
      }
    } catch (err) {
      console.error('Failed to fetch company profile', err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      let branchId = null;
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed && !isNaN(parseInt(parsed.branchId))) {
             branchId = parseInt(parsed.branchId);
          }
        } catch (e) { console.error(e); }
      }
      const res = await api.get('/dashboard/stats', { params: { branchId } });
      setData(res.data);
      if (storedUser) {
        setUserData(JSON.parse(storedUser));
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  });

  const triggerPrint = (sale) => {
    setPrintSale(sale);
    toast.loading("Preparing Invoice...", { duration: 1000 });
    setTimeout(() => {
      handlePrint();
    }, 500);
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;
  }

  if (!data) return null;

  // If "Screen Layout Only" is enabled, hide stats and just show existing background from Layout.js
  if (companyProfile?.showOnlyLogoOnDashboard) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center pointer-events-none">
            {/* Optional: Add a welcome message or clock if needed, otherwise clean slate */}
        </div>
      );
  }

  return (
    <div className="space-y-8 font-sans relative">
      <header className="flex justify-between items-end relative z-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Main Menu</h1>
          <p className="text-slate-500 mt-1">Welcome back, {userData?.name || userData?.username || 'User'}!</p>
        </div>
        <div className="text-sm text-slate-400 font-medium">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </header>
      
      {/* Top Stats Grid - Dark Theme */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DarkStatCard 
          title="Total Sales" 
          value={`${companyProfile?.currencySymbol || '₹'}${Number(data.sales.total).toFixed(2)}`} 
          subtext={`${data.sales.count} transactions`}
          icon={<FiTrendingUp />}
        />
        <DarkStatCard 
          title="Today's Sales" 
          value={`${companyProfile?.currencySymbol || '₹'}${Number(data.sales.today).toFixed(2)}`} 
          subtext={`${data.sales.todayCount} sales today`}
          icon={<FiDollarSign />}
        />
        <DarkStatCard 
          title="Total Products" 
          value={data.inventory.totalProducts} 
          subtext={`${data.inventory.inStock} in stock`}
          icon={<FiBox />}
        />
        <DarkStatCard 
          title="Customers" 
          value={data.customers.total} 
          subtext={`${data.customers.active} Active customers`}
          icon={<FiUsers />}
        />
      </div>

      {/* Middle Section: Recent Sales, Stock Balance & Fast Moving Products */}
      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sales */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col">
          <div className="flex items-center space-x-2 mb-6 text-slate-800">
             <FiShoppingBag className="text-emerald-500" />
             <h3 className="text-lg font-bold">Recent Sales</h3>
          </div>
          <div className="space-y-4 flex-1">
            {data.recentSales.length === 0 ? (
               <p className="text-slate-400 text-sm">No recent sales</p>
            ) : (
                data.recentSales.map(sale => (
                  <div key={sale.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 rounded-lg px-2 -mx-2 transition-colors group">
                    <div>
                      <p className="font-medium text-slate-700 text-sm uppercase">INV-{new Date(sale.createdAt).getFullYear()}-{sale.id}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{new Date(sale.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-600 text-sm">₹{Number(sale.totalAmount).toFixed(2)}</span>
                      <button 
                        onClick={() => triggerPrint(sale)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                        title="Print Invoice"
                      >
                        <FiPrinter size={14} />
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Stock Balance (Low Stock) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col">
          <div className="flex items-center space-x-2 mb-6 text-slate-800">
             <FiBox className="text-blue-500" />
             <h3 className="text-lg font-bold">Stock Balance</h3>
          </div>
          <div className="space-y-4 flex-1">
             {data.inventory.stockBalance.length === 0 ? (
                <p className="text-slate-400 text-sm">No stock data</p>
             ) : (
                data.inventory.stockBalance.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 rounded-lg px-2 -mx-2 transition-colors">
                    <div className="max-w-[150px]">
                      <p className="font-medium text-slate-700 text-sm truncate" title={item.name}>{item.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.category || 'Uncategorized'}</p>
                    </div>
                    <div className="text-right">
                       <p className={`font-bold text-sm ${item.stock < 10 ? 'text-red-500' : 'text-slate-800'}`}>{item.stock} units</p>
                       <p className="text-xs text-slate-400 mt-0.5">₹{Number(item.price).toFixed(2)}</p>
                    </div>
                  </div>
                ))
             )}
          </div>
        </div>

        {/* Fast Moving Products */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col">
          <div className="flex items-center space-x-2 mb-6 text-slate-800">
             <FiTrendingUp className="text-purple-500" />
             <h3 className="text-lg font-bold">Fast Moving</h3>
          </div>
          <div className="space-y-4 flex-1">
             {!data.fastMovingProducts || data.fastMovingProducts.length === 0 ? (
                <p className="text-slate-400 text-sm">No sales data yet</p>
             ) : (
                data.fastMovingProducts.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 rounded-lg px-2 -mx-2 transition-colors">
                    <div className="flex items-center space-x-3">
                       <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-xs font-bold text-purple-600 border border-purple-100">
                          {idx + 1}
                       </div>
                       <div className="max-w-[120px]">
                        <p className="font-medium text-slate-700 text-sm truncate" title={item.name}>{item.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{item.category}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="font-bold text-slate-800 text-sm">{item.sold} Sold</p>
                       <div className="flex items-center justify-end text-[10px] text-emerald-600 font-bold mt-0.5">
                          <FiArrowUpRight className="mr-0.5" />
                          TOP SELLER
                       </div>
                    </div>
                  </div>
                ))
             )}
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-4">Financial Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FinanceCard 
            label="Total Receipts" 
            value={data.finance.receipts} 
            color="text-emerald-600" 
            bgColor="bg-emerald-50" 
          />
          <FinanceCard 
            label="Total Expenses" 
            value={data.finance.expenses} 
            color="text-red-500" 
            bgColor="bg-red-50" 
          />
          <FinanceCard 
            label="Total Purchases" 
            value={data.finance.purchases} 
            color="text-blue-600" 
            bgColor="bg-blue-50" 
          />
           <FinanceCard 
            label="Net Profit" 
            value={data.finance.netProfit} 
            color="text-purple-600" 
            bgColor="bg-purple-50" 
          />
        </div>
      </div>

      {/* Hidden Print Component */}
      <div style={{ display: 'none' }}>
        <DynamicInvoice 
          ref={componentRef}
          printData={printSale}
          companyProfile={companyProfile}
          invoiceSettings={invoiceSettings}
        />
      </div>
    </div>
  );
}

function DarkStatCard({ title, value, subtext, icon }) {
  return (
    <div className="bg-gradient-to-br from-emerald-400 to-emerald-900 rounded-xl p-6 relative overflow-hidden group hover:shadow-xl transition-shadow shadow-lg">
      <div className="relative z-10 flex justify-between items-start">
        <div>
          <p className="text-white/90 text-sm font-medium mb-2">{title}</p>
          <h2 className="text-3xl font-bold tracking-tight mb-1 text-white">{value}</h2>
          <p className="text-xs text-white/80 font-medium">{subtext}</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm group-hover:bg-white/30 transition-colors">
          <span className="text-xl text-white">{icon}</span>
        </div>
      </div>
      {/* Decorative */}
      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/15 transition-colors"></div>
    </div>
  );
}

function FinanceCard({ label, value, color, bgColor }) {
  return (
    <div className={`rounded-xl p-6 flex flex-col items-center justify-center text-center ${bgColor} border-2 border-white shadow-sm`}>
      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>
        {Number(value) < 0 ? '-' : ''}₹{Math.abs(Number(value)).toFixed(2)}
      </p>
    </div>
  );
}
