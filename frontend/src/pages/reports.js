import React, { useState, useEffect, useRef, forwardRef } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import { FiDownload, FiFilter, FiCalendar, FiTrendingUp, FiTrendingDown, FiEye, FiPrinter, FiX } from 'react-icons/fi';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'react-toastify';
import DynamicInvoice from '@/components/DynamicInvoice';

export default function Reports() {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [paymentSummary, setPaymentSummary] = useState([]);

  // Branch Filtering
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(''); // '' means All for logic, but we default to user branch

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        // Default to user's branch
        setSelectedBranch(u.branchId?.toString() || '');

        if (u.role === 'admin') {
          api.get('/branches').then(res => setBranches(res.data)).catch(console.error);
        }
      }
    }
  }, []);

  // Printing & Details
  const [selectedSale, setSelectedSale] = useState(null);
  const [printSale, setPrintSale] = useState(null);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [invoiceSettings, setInvoiceSettings] = useState(null);
  const [user, setUser] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const componentRef = useRef();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  // Fetch Sales Data when branch or mount
  useEffect(() => {
    if (selectedBranch) {
      fetchData();
    }
  }, [selectedBranch]);

  const fetchData = async () => {
    try {
      // Use selectedBranch if available, otherwise fallback (though state should be set)
      const queryBranchId = selectedBranch === 'all' ? undefined : selectedBranch;

      const [salesRes, compRes, branchRes] = await Promise.all([
        api.get('/sales', { params: { branchId: queryBranchId } }),
        api.get('/company'),
        queryBranchId && queryBranchId !== 'all' ? api.get(`/branches/${queryBranchId}`) : null
      ]);
      setSales(salesRes.data);
      setFilteredSales(salesRes.data);
      if (compRes.data) {
        setCompanyProfile(compRes.data);
      }
      const currencySymbol = compRes.data?.currencySymbol || '₹';

      if (branchRes?.data?.invoiceSettings) {
        setInvoiceSettings(branchRes.data.invoiceSettings);
      } else if (compRes.data?.invoiceSettings) {
        setInvoiceSettings(compRes.data.invoiceSettings);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentSummary = async () => {
    try {
      const queryBranchId = selectedBranch === 'all' ? undefined : selectedBranch;
      const targetDate = startDate || new Date().toISOString().split('T')[0];
      const { data } = await api.get(`/reports/payments`, {
        params: { date: targetDate, branchId: queryBranchId }
      });
      setPaymentSummary(data);
    } catch (err) {
      console.error("Failed to load payment summary", err);
    }
  };

  // Filter Logic
  useEffect(() => {
    let result = sales;
    if (startDate) {
      result = result.filter(s => new Date(s.saleDate) >= new Date(startDate));
    }
    if (endDate) {
      const nextDay = new Date(endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      result = result.filter(s => new Date(s.saleDate) < nextDay);
    }
    setFilteredSales(result);
    fetchPaymentSummary();
  }, [startDate, endDate, sales, selectedBranch]);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  });

  const triggerPrint = (sale) => {
    setPrintSale(sale);
    toast.loading("Preparing Print...", { duration: 1000 });
    setTimeout(() => {
      handlePrint();
    }, 500);
  };

  const handleCancelClick = (sale) => {
    setSaleToCancel(sale);
    setShowCancelModal(true);
  };

  const confirmCancel = async () => {
    if (!saleToCancel) return;
    if (!cancelReasonInput.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    try {
      setLoading(true);
      await api.put(`/sales/${saleToCancel.id}/cancel`, {
        cancelledBy: user?.username || 'Admin',
        cancelReason: cancelReasonInput || 'No reason provided'
      });
      toast.success('Invoice cancelled successfully');
      setShowCancelModal(false);
      setSaleToCancel(null);
      setCancelReasonInput('');
      fetchData(); // Refresh list
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel invoice');
    } finally {
      setLoading(false);
    }
  };

  // Aggregates
  const totalSales = filteredSales.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + parseFloat(s.totalAmount), 0);
  const totalTax = filteredSales.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + parseFloat(s.taxAmount), 0);
  const totalReturns = filteredSales.filter(s => s.isReturn && s.status !== 'cancelled').reduce((sum, s) => sum + parseFloat(s.totalAmount), 0);
  const netSales = totalSales - totalReturns;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales Reports</h1>
          <p className="text-slate-500 text-sm mt-1">Snapshot of performance and revenue</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.location.href = '/reports/salesman'} className="btn bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">
            <FiTrendingUp /> Salesman Performance
          </button>
          <button className="btn btn-secondary flex items-center gap-2" onClick={() => window.print()}>
            <FiDownload className="text-lg" /> Export Page
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6 border-0 shadow-sm bg-white p-6 rounded-xl">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex items-center gap-2 text-slate-500 font-medium pb-2 border-r pr-6 border-slate-100">
            <FiFilter /> Filters
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 tracking-wider">Start Date</label>
            <input type="date" className="input py-2 border rounded-lg px-3" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 tracking-wider">End Date</label>
            <input type="date" className="input py-2 border rounded-lg px-3" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button className="text-sm font-bold text-primary hover:text-primary-dark pb-2" onClick={() => { setStartDate(''); setEndDate(''); }}>Reset Filters</button>

          {/* Branch Selector for Admin */}
          {user?.role === 'admin' && (
            <div className="pl-6 border-l border-slate-100">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 tracking-wider">Branch</label>
              <select
                className="input py-2 border rounded-lg px-3 min-w-[150px] font-medium text-slate-700"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                <option value="all">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card border-0 shadow-lg bg-gradient-to-br from-primary to-primary-dark text-white p-5 rounded-2xl relative overflow-hidden flex flex-col justify-center min-h-[120px]">
          <div className="relative z-10">
            <p className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">Total Revenue</p>
            <p className="text-3xl font-extrabold">₹ {totalSales.toFixed(0)}</p>
          </div>
          <FiTrendingUp className="absolute right-[-10px] bottom-[-10px] text-white/10 text-8xl rotate-12" />
        </div>
        <div className="card border-0 shadow-sm bg-white p-5 rounded-2xl border-l-4 border-red-400">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Returns</p>
          <p className="text-2xl font-black text-red-500">₹ {totalReturns.toFixed(2)}</p>
        </div>
        <div className="card border-0 shadow-sm bg-white p-5 rounded-2xl border-l-4 border-slate-700">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Net Sales</p>
          <p className="text-2xl font-black text-slate-800">₹ {netSales.toFixed(2)}</p>
        </div>
        <div className="card border-0 shadow-sm bg-white p-5 rounded-2xl border-l-4 border-indigo-400">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Tax Collected</p>
          <p className="text-2xl font-black text-indigo-600">₹ {totalTax.toFixed(2)}</p>
        </div>
      </div>

      {/* Payment Method Wise Report */}
      <div className="mb-8">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <FiTrendingUp className="text-primary" /> Daily Payment Method Summary ({startDate || 'Today'})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {paymentSummary.map(ps => (
            <div key={ps.method} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center group hover:border-primary/30 transition-colors">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">{ps.method}</p>
                <p className="text-lg font-black text-slate-800">₹{ps.net.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-primary font-bold leading-none mb-1">+{ps.receipts.toFixed(2)}</div>
                <div className="text-[10px] text-red-400 font-bold">-{ps.payments.toFixed(2)}</div>
              </div>
            </div>
          ))}
          {paymentSummary.length === 0 && (
            <div className="col-span-full py-4 text-center text-slate-400 italic text-sm">No transactions found for this date</div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 uppercase text-[10px] font-bold tracking-widest">
            <tr>
              <th className="p-4 pl-6">Date</th>
              <th className="p-4">Invoice #</th>
              <th className="p-4">Customer</th>
              <th className="p-4 text-right">Total Amount</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center pr-6">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredSales.map(sale => (
              <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4 pl-6 text-slate-600 font-medium">{new Date(sale.saleDate).toLocaleDateString()}</td>
                <td className="p-4 font-mono text-xs text-slate-400">#{sale.invoiceNumber}</td>
                <td className="p-4 text-slate-700 font-semibold">{sale.customer?.name || 'Walk-in'}</td>
                <td className="p-4 text-right font-bold text-slate-800">{companyProfile?.currencySymbol || '₹'} {parseFloat(sale.totalAmount).toFixed(2)}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${sale.status === 'cancelled' ? 'bg-slate-100 text-slate-500' : (sale.isReturn ? 'bg-red-100 text-red-700' : 'bg-primary-light/10 text-primary')}`}>
                    {sale.status === 'cancelled' ? 'Cancelled' : (sale.isReturn ? 'Returned' : 'Completed')}
                  </span>
                </td>
                <td className="p-4 text-center pr-6">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => setSelectedSale(sale)}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-primary-light/10 rounded-lg transition-all"
                      title="View Details"
                    >
                      <FiEye size={16} />
                    </button>
                    <button
                      onClick={() => triggerPrint(sale)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      title="Print Invoice"
                    >
                      <FiPrinter size={16} />
                    </button>
                    {user?.role === 'admin' && sale.status !== 'cancelled' && (
                      <button
                        onClick={() => handleCancelClick(sale)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Cancel Invoice"
                      >
                        <FiX size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredSales.length === 0 && (
              <tr><td colSpan="6" className="p-12 text-center text-slate-400 italic">No records found for the selected period</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedSale(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-8 py-6 border-b flex justify-between items-center bg-slate-50/50">
              <div>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Invoice Details</p>
                <h3 className="text-2xl font-black text-slate-800">#{selectedSale.invoiceNumber}</h3>
              </div>
              <button onClick={() => setSelectedSale(null)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all shadow-sm">
                <FiX size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-0 overflow-y-auto max-h-[60vh]">
              <div className="px-8 py-6 grid grid-cols-2 gap-8 bg-white">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer</p>
                  <p className="text-lg font-bold text-slate-700">{selectedSale.customer?.name || 'Walk-in Customer'}</p>
                  {selectedSale.customer?.phone && <p className="text-sm text-slate-500">{selectedSale.customer.phone}</p>}
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date & Time</p>
                  <p className="text-lg font-bold text-slate-700">{new Date(selectedSale.saleDate).toLocaleDateString()}</p>
                  <p className="text-sm text-slate-500">{new Date(selectedSale.saleDate).toLocaleTimeString()}</p>
                </div>
              </div>

              {selectedSale.status === 'cancelled' && (
                <div className="mx-8 mb-6 p-4 bg-red-50 rounded-2xl border border-red-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
                    <FiX size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest leading-none mb-1">Cancelled Information</p>
                    <p className="text-sm font-bold text-red-700">By {selectedSale.cancelledBy} on {new Date(selectedSale.cancelledAt).toLocaleString()}</p>
                    <p className="text-xs text-red-500 mt-1 italic">Reason: {selectedSale.cancelReason || 'Not specified'}</p>
                  </div>
                </div>
              )}

              <div className="px-8 pb-8">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100 bg-slate-50/50">
                      <th className="py-3 px-2 text-left font-bold uppercase text-[9px] tracking-widest">Item</th>
                      <th className="py-3 px-2 text-center font-bold uppercase text-[9px] tracking-widest">Qty</th>
                      <th className="py-3 px-2 text-right font-bold uppercase text-[9px] tracking-widest">Price</th>
                      <th className="py-3 px-2 text-right font-bold uppercase text-[9px] tracking-widest pr-4">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {selectedSale.items?.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="py-4 px-2 font-bold text-slate-700">{item.product?.name || "Deleted Product"}</td>
                        <td className="py-4 px-2 text-center text-slate-600 tabular-nums">{item.quantity}</td>
                        <td className="py-4 px-2 text-right text-slate-600 tabular-nums">₹{parseFloat(item.unitPrice).toFixed(2)}</td>
                        <td className="py-4 px-2 text-right font-black text-slate-800 tabular-nums pr-4">₹{parseFloat(item.total).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-6 bg-slate-900 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary-light/20 flex items-center justify-center text-primary-light">
                  <FiTrendingUp size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Grand Total</p>
                  <p className="text-2xl font-black text-white tabular-nums">₹{parseFloat(selectedSale.totalAmount).toFixed(2)}</p>
                </div>
              </div>
              <button
                onClick={() => triggerPrint(selectedSale)}
                className="px-6 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-primary-light hover:text-primary-dark transition-all flex items-center gap-2 shadow-lg shadow-white/5 active:scale-95"
              >
                <FiPrinter size={18} /> Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print Component */}
      <div style={{ display: 'none' }}>
        <DynamicInvoice
          ref={componentRef}
          printData={printSale}
          companyProfile={companyProfile}
          invoiceSettings={invoiceSettings}
        />
      </div>
      {/* Modern Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 scale-110">
                <FiX size={40} strokeWidth={3} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Are you sure?</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-8">
                You are about to cancel invoice <span className="font-mono font-bold text-slate-700">#{saleToCancel?.invoiceNumber}</span>.
                This will automatically restore <span className="text-red-600 font-bold">stock levels</span> and cannot be undone.
              </p>

              <div className="mb-6 text-left">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Reason for Cancellation</label>
                <textarea
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-red-500 focus:border-red-500 bg-slate-50 min-h-[80px]"
                  placeholder="e.g. Returned by customer, Error in billing..."
                  value={cancelReasonInput}
                  onChange={e => setCancelReasonInput(e.target.value)}
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95"
                >
                  No, Keep it
                </button>
                <button
                  onClick={confirmCancel}
                  disabled={loading}
                  className="py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Cancelling...' : 'Yes, Cancel'}
                </button>
              </div>
            </div>
            <div className="bg-slate-50 p-4 text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest border-t border-slate-100">
              Admin Protected Action
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
