import React, { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import {
    FiFilter, FiBox, FiCalendar, FiArrowDownLeft, FiArrowUpRight, FiPrinter, FiDownload, FiSearch, FiRefreshCw
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useReactToPrint } from 'react-to-print';
import SearchableSelect from '@/components/SearchableSelect';
import { useTheme } from '@/context/ThemeContext';

export default function StockMovementRegister() {
    const { theme } = useTheme();
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [user, setUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const componentRef = useRef();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const u = JSON.parse(storedUser);
            setUser(u);
            setSelectedBranch(u.branchId?.toString() || '');
        }
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [prodRes, branchRes] = await Promise.all([
                api.get('/products'),
                api.get('/branches')
            ]);
            setProducts(prodRes.data.map(p => ({ label: `${p.name} (${p.barcode || 'No SKU'})`, value: p.id })));
            setBranches(branchRes.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load products/branches");
        }
    };

    const fetchReport = async () => {
        if (!selectedProduct) {
            toast.warning("Please select a product");
            return;
        }
        try {
            setLoading(true);
            const { data } = await api.get('/reports/stock-movement', {
                params: {
                    productId: selectedProduct,
                    branchId: selectedBranch,
                    startDate,
                    endDate
                }
            });
            setReportData(data);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || "Failed to fetch report");
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = useReactToPrint({ contentRef: componentRef });

    const filteredMovements = reportData?.movements.filter(move =>
        move.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        move.party.toLowerCase().includes(searchTerm.toLowerCase()) ||
        move.type.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const handleExport = () => {
        if (!reportData) return;
        const csvContent = [
            ['Date', 'Reference', 'Type', 'Party', 'In', 'Out', 'Balance'],
            ['Opening Balance', '', '', '', '', '', reportData.openingStock],
            ...filteredMovements.map(m => [
                new Date(m.date).toLocaleDateString(),
                m.reference,
                m.type,
                m.party,
                m.inQty,
                m.outQty,
                m.balance
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stock-movement-${selectedProduct}-${startDate}.csv`;
        a.click();
    };

    const totalIn = filteredMovements.reduce((sum, m) => sum + m.inQty, 0);
    const totalOut = filteredMovements.reduce((sum, m) => sum + m.outQty, 0);

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Stock Movement Register</h1>
                    <p className="text-slate-500 text-sm mt-1">Detailed transaction log for personal stock tracking</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handlePrint}
                        disabled={!reportData}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold text-sm flex items-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                        <FiPrinter size={16} /> Print Report
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={!reportData}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold text-sm flex items-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                        <FiDownload size={16} /> Export CSV
                    </button>
                    <button
                        onClick={fetchReport}
                        disabled={loading}
                        className="bg-primary text-white px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 hover:bg-primary-dark transition-all shadow-sm disabled:opacity-50"
                        style={{ backgroundColor: theme.primaryColor }}
                    >
                        <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {loading ? "Loading..." : "Generate"}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="lg:col-span-2 flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Select Product</label>
                        <SearchableSelect
                            options={products}
                            value={selectedProduct}
                            onChange={setSelectedProduct}
                            placeholder="Search product by name or barcode..."
                        />
                    </div>
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
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-end">
                    {user?.role === 'admin' && (
                        <div className="flex flex-col gap-1 w-full md:w-64">
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
                    <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Filter by reference, party or type..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Summary Cards (Only when report is loaded) */}
            {reportData && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Opening Stock</p>
                        <h3 className="text-xl font-bold text-slate-800">{reportData.openingStock.toLocaleString()}</h3>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Total In (+)</p>
                        <h3 className="text-xl font-bold text-emerald-700">+{totalIn.toLocaleString()}</h3>
                    </div>
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm">
                        <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">Total Out (-)</p>
                        <h3 className="text-xl font-bold text-red-700">-{totalOut.toLocaleString()}</h3>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-xl shadow-md text-white">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Closing Stock</p>
                        <h3 className="text-xl font-bold text-white">{reportData.closingStock.toLocaleString()}</h3>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center py-12 text-slate-400 font-medium">Fetching movement register...</div>
            ) : reportData ? (
                <div className="card shadow-md border border-slate-200 overflow-hidden" ref={componentRef}>
                    <div className="p-8 hidden print:block border-b-2 border-slate-200">
                        <h2 className="text-2xl font-bold text-slate-800">Stock Movement Register</h2>
                        <p className="text-slate-600 font-medium">{products.find(p => p.value === selectedProduct)?.label}</p>
                        <p className="text-sm mt-1">Period: {startDate} to {endDate}</p>
                    </div>

                    <div className="table-container">
                        <table className="table-modern">
                            <thead>
                                <tr>
                                    <th style={{ width: '4%' }}>#</th>
                                    <th style={{ width: '12%' }}>Date</th>
                                    <th style={{ width: '15%' }}>Reference</th>
                                    <th style={{ width: '15%' }}>Type</th>
                                    <th style={{ width: '25%' }}>Party/Details</th>
                                    <th style={{ width: '10%' }} className="text-center">In</th>
                                    <th style={{ width: '10%' }} className="text-center">Out</th>
                                    <th style={{ width: '10%' }} className="text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="bg-slate-50/50 font-bold text-slate-600">
                                    <td colSpan={7} className="text-sm py-2 px-6 italic">Opening Balance as on {startDate}</td>
                                    <td className="text-right font-black text-slate-800 pr-4">{reportData.openingStock.toLocaleString()}</td>
                                </tr>
                                {filteredMovements.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="text-center py-8 text-slate-400 italic">
                                            No movement transactions found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredMovements.map((move, index) => (
                                        <tr key={index}>
                                            <td className="text-slate-500">{index + 1}</td>
                                            <td className="text-xs font-medium text-slate-600">
                                                {new Date(move.date).toLocaleDateString()}
                                            </td>
                                            <td>
                                                <span className="font-bold text-slate-700 text-xs text-primary" style={{ color: theme.primaryColor }}>
                                                    #{move.reference}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${move.inQty > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                                    }`}>
                                                    {move.type}
                                                </span>
                                            </td>
                                            <td className="text-xs font-semibold text-slate-700">
                                                {move.party || '-'}
                                            </td>
                                            <td className="text-center font-bold text-emerald-600 text-xs tabular-nums">
                                                {move.inQty > 0 ? `+${move.inQty.toLocaleString()}` : '-'}
                                            </td>
                                            <td className="text-center font-bold text-red-500 text-xs tabular-nums">
                                                {move.outQty > 0 ? `-${move.outQty.toLocaleString()}` : '-'}
                                            </td>
                                            <td className="text-right font-black text-slate-900 tabular-nums pr-4">
                                                {move.balance.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary Footer */}
                    <div className="bg-slate-50 border-t border-slate-300 px-6 py-4 flex justify-between items-center">
                        <div className="text-sm text-slate-600">
                            Showing <span className="font-semibold">{filteredMovements.length}</span> transactions
                        </div>
                        <div className="flex gap-8 text-[13px]">
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Movement In</span>
                                <span className="font-bold text-emerald-600">+{totalIn.toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Movement Out</span>
                                <span className="font-bold text-red-500">-{totalOut.toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Net Closing</span>
                                <span className="font-black text-slate-900 text-base" style={{ color: theme.primaryColor }}>
                                    {reportData.closingStock.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 py-32 flex flex-col items-center justify-center text-slate-400">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                        <FiBox size={32} />
                    </div>
                    <p className="font-bold text-slate-500">No Product Selected</p>
                    <p className="text-sm">Select a product above and click 'Generate' to view its history</p>
                </div>
            )}
        </div>
    );
}
