import React, { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import {
    FiDownload, FiEye, FiPrinter, FiX, FiCalendar, FiSearch, FiRefreshCw
} from 'react-icons/fi';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'react-toastify';
import ProfessionalInvoice from '@/components/ProfessionalInvoice';
import { useTheme } from '@/context/ThemeContext';

export default function SalesReport() {
    const { theme } = useTheme();
    const [sales, setSales] = useState([]);
    const [filteredSales, setFilteredSales] = useState([]);
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
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
        if (storedUser) {
            const u = JSON.parse(storedUser);
            setUser(u);
            setSelectedBranch(u.branchId?.toString() || '');
            if (u.role === 'admin') {
                api.get('/branches').then(res => setBranches(res.data)).catch(console.error);
            }
        }
    }, []);

    useEffect(() => {
        if (selectedBranch !== '') fetchData();
    }, [selectedBranch]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const queryBranchId = selectedBranch === 'all' ? undefined : selectedBranch;
            const [salesRes, compRes] = await Promise.all([
                api.get('/sales', { params: { branchId: queryBranchId } }),
                api.get('/company')
            ]);
            setSales(salesRes.data);
            if (compRes.data) setCompanyProfile(compRes.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let result = sales;
        if (startDate) result = result.filter(s => new Date(s.saleDate) >= new Date(startDate));
        if (endDate) {
            const nextDay = new Date(endDate);
            nextDay.setDate(nextDay.getDate() + 1);
            result = result.filter(s => new Date(s.saleDate) < nextDay);
        }
        if (searchTerm) {
            result = result.filter(s =>
                s.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (s.customer?.name && s.customer.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (s.customer?.phone && s.customer.phone.includes(searchTerm))
            );
        }
        setFilteredSales(result);
    }, [startDate, endDate, sales, searchTerm]);

    const handlePrint = useReactToPrint({ contentRef: componentRef });

    const triggerPrint = (sale) => {
        setPrintSale(sale);
        toast.info("Preparing Print...", { autoClose: 1000, position: 'bottom-right' });
        setTimeout(() => handlePrint(), 500);
    };

    const handleCancelClick = (sale) => {
        setSaleToCancel(sale);
        setShowCancelModal(true);
    };

    const confirmCancel = async () => {
        if (!saleToCancel || !cancelReasonInput.trim()) {
            toast.error('Please provide a reason');
            return;
        }
        try {
            setLoading(true);
            await api.put(`/sales/${saleToCancel.id}/cancel`, {
                cancelledBy: user?.username || 'Admin',
                cancelReason: cancelReasonInput
            });
            toast.success('Invoice cancelled successfully');
            setShowCancelModal(false);
            setSaleToCancel(null);
            setCancelReasonInput('');
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to cancel');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        const csvContent = [
            ['Date', 'Invoice #', 'Customer', 'Phone', 'Amount', 'Status', 'Method'],
            ...filteredSales.map(s => [
                new Date(s.saleDate).toLocaleDateString(),
                s.invoiceNumber,
                s.customer?.name || 'Walk-in',
                s.customer?.phone || 'N/A',
                s.totalAmount,
                s.status,
                s.paymentMethod
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales-report-${startDate}.csv`;
        a.click();
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Sales Report</h1>
                    <p className="text-slate-500 text-sm mt-1">{filteredSales.length} invoices found</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => window.print()}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold text-sm flex items-center gap-2 hover:bg-slate-50 transition-all"
                    >
                        <FiPrinter size={16} /> Print Report
                    </button>
                    <button
                        onClick={handleExport}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold text-sm flex items-center gap-2 hover:bg-slate-50 transition-all"
                    >
                        <FiDownload size={16} /> Export CSV
                    </button>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="bg-primary text-white px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 hover:bg-primary-dark transition-all shadow-sm"
                        style={{ backgroundColor: theme.primaryColor }}
                    >
                        <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {loading ? "Loading..." : "Refresh"}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><FiCalendar /> From Date</label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><FiCalendar /> To Date</label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>
                    {user?.role === 'admin' && (
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Branch</label>
                            <select
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary h-[38px]"
                                value={selectedBranch}
                                onChange={e => setSelectedBranch(e.target.value)}
                            >
                                <option value="all">All Branches</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="flex flex-col gap-1 flex-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Search</label>
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search invoice or customer..."
                                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="card shadow-md border border-slate-200 overflow-hidden">
                <div className="table-container">
                    <table className="table-modern">
                        <thead>
                            <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-widest">
                                <th style={{ width: '15%' }}>Invoice Meta</th>
                                <th style={{ width: '25%' }}>Customer Details</th>
                                <th style={{ width: '15%' }}>Billing Info</th>
                                <th style={{ width: '15%' }} className="text-right">Total Amount</th>
                                <th style={{ width: '10%' }} className="text-center">Status</th>
                                <th style={{ width: '20%' }} className="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredSales.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-12 text-slate-400 italic">
                                        {loading ? "Fetching data..." : "No sales records found"}
                                    </td>
                                </tr>
                            ) : (
                                filteredSales.map(sale => (
                                    <tr key={sale.id} className="hover:bg-slate-50/50 transition-all text-sm">
                                        <td className="p-4">
                                            <p className="text-slate-800 font-bold text-xs mb-0.5" style={{ color: theme.primaryColor }}>#{sale.invoiceNumber}</p>
                                            <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase">
                                                <FiCalendar size={10} /> {new Date(sale.saleDate).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <p className="text-slate-700 font-bold text-xs mb-0.5">{sale.customer?.name || 'Walk-in Profile'}</p>
                                            <p className="text-[9px] text-slate-400 font-bold">{sale.customer?.phone || 'No Phone'}</p>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[9px] font-bold w-fit uppercase">
                                                    {sale.paymentMethod || 'Cash'}
                                                </span>
                                                <span className="text-[9px] text-slate-400 font-bold uppercase ml-0.5 italic">By: {sale.salesman?.name || 'System'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-black text-slate-900 tabular-nums text-sm">
                                            ₹{parseFloat(sale.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${sale.status === 'cancelled'
                                                ? 'bg-rose-50 text-rose-500 border border-rose-100'
                                                : (sale.isReturn ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100')
                                                }`}>
                                                {sale.status === 'cancelled' ? 'Void' : (sale.isReturn ? 'Return' : 'Active')}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => setSelectedSale(sale)} className="p-2 bg-white text-slate-400 border border-slate-200 rounded-lg hover:bg-primary/10 hover:text-primary transition-all">
                                                    <FiEye size={14} />
                                                </button>
                                                <button onClick={() => triggerPrint(sale)} className="p-2 bg-white text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-900 hover:text-white transition-all">
                                                    <FiPrinter size={14} />
                                                </button>
                                                {user?.role === 'admin' && sale.status !== 'cancelled' && (
                                                    <button onClick={() => handleCancelClick(sale)} className="p-2 bg-white text-slate-400 border border-slate-200 rounded-lg hover:bg-rose-500 hover:text-white transition-all">
                                                        <FiX size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Summary Footer */}
                <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center">
                    <div className="text-xs text-slate-500 font-bold uppercase">
                        Net Total: <span className="text-slate-900 font-black ml-1">
                            ₹{filteredSales.reduce((sum, s) => sum + (s.status !== 'cancelled' ? parseFloat(s.totalAmount) : 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">
                        Showing {filteredSales.length} records
                    </div>
                </div>
            </div>

            {/* Sale Detail Modal */}
            {selectedSale && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm" onClick={() => setSelectedSale(null)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50/50">
                            <div>
                                <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-0.5">Invoice #</p>
                                <h3 className="text-base font-black text-slate-900">#{selectedSale.invoiceNumber}</h3>
                            </div>
                            <button onClick={() => setSelectedSale(null)} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-500 transition-all">
                                <FiX size={18} />
                            </button>
                        </div>

                        <div className="p-0 overflow-y-auto max-h-[50vh]">
                            <div className="px-6 py-4 grid grid-cols-2 gap-8 bg-white">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Customer</p>
                                    <p className="text-sm font-black text-slate-800">{selectedSale.customer?.name || 'Walk-in'}</p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</p>
                                    <p className="text-sm font-black text-slate-800">{new Date(selectedSale.saleDate).toLocaleDateString()}</p>
                                </div>
                            </div>

                            {selectedSale.status === 'cancelled' && (
                                <div className="mx-6 mb-4 p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-rose-600 shadow-sm border border-rose-100"><FiX size={16} /></div>
                                    <div className="text-[10px] text-rose-700 font-bold">Voided by {selectedSale.cancelledBy} on {new Date(selectedSale.cancelledAt).toLocaleDateString()}</div>
                                </div>
                            )}

                            <div className="px-6 pb-6">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-slate-400 border-b-2 border-slate-50">
                                            <th className="py-2 text-left font-black uppercase text-[8px] tracking-widest">Product</th>
                                            <th className="py-2 text-center font-black uppercase text-[8px] tracking-widest">Qty</th>
                                            <th className="py-2 text-right font-black uppercase text-[8px] tracking-widest">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {selectedSale.items?.map(item => (
                                            <tr key={item.id}>
                                                <td className="py-3">
                                                    <p className="font-bold text-slate-800">{item.product?.name || "Inventory Item"}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold">₹{parseFloat(item.unitPrice).toFixed(2)}</p>
                                                </td>
                                                <td className="py-3 text-center text-slate-900 font-bold">{item.quantity}</td>
                                                <td className="py-3 text-right font-black text-indigo-600">₹{parseFloat(item.total).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-900 flex justify-between items-center">
                            <div>
                                <p className="text-[8px] font-black text-indigo-300 uppercase tracking-widest">Total Amount</p>
                                <p className="text-xl font-black text-white tabular-nums">₹{parseFloat(selectedSale.totalAmount).toLocaleString()}</p>
                            </div>
                            <button onClick={() => triggerPrint(selectedSale)} className="px-5 py-2.5 bg-white text-slate-900 rounded-xl font-black text-xs hover:bg-primary hover:text-white transition-all transform active:scale-95 flex items-center gap-2">
                                <FiPrinter size={14} /> Print Invoice
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Print Component */}
            <div style={{ display: 'none' }}>
                <ProfessionalInvoice
                    ref={componentRef}
                    printData={printSale}
                    companyProfile={companyProfile}
                />
            </div>

            {/* Cancel Modal */}
            {showCancelModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs overflow-hidden">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500"><FiX size={32} /></div>
                            <h3 className="text-lg font-black text-slate-900 mb-1">Cancel Invoice?</h3>
                            <p className="text-slate-500 text-[11px] mb-6">This will reverse stock and accounting entries.</p>
                            <textarea
                                className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none transition-all font-bold text-slate-700 min-h-[80px] mb-4"
                                placeholder="Reason for cancellation..."
                                value={cancelReasonInput}
                                onChange={e => setCancelReasonInput(e.target.value)}
                            ></textarea>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setShowCancelModal(false)} className="py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs hover:bg-slate-200">Go Back</button>
                                <button onClick={confirmCancel} disabled={loading} className="py-3 bg-rose-600 text-white rounded-xl font-black text-xs hover:bg-rose-700 disabled:opacity-50">Cancel Invoice</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
