import React, { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import {
    FiBox, FiPrinter, FiDownload, FiCalendar, FiActivity, FiSearch, FiRefreshCw
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useReactToPrint } from 'react-to-print';
import { useTheme } from '@/context/ThemeContext';

export default function StockSummary() {
    const { theme } = useTheme();
    const [summary, setSummary] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [user, setUser] = useState(null);
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
            const [catRes, branchRes] = await Promise.all([
                api.get('/categories'),
                api.get('/branches')
            ]);
            setCategories(catRes.data);
            setBranches(branchRes.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load initial data");
        }
    };

    const fetchReport = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/reports/stock-summary', {
                params: {
                    branchId: selectedBranch,
                    categoryId: selectedCategory,
                    startDate,
                    endDate
                }
            });
            setSummary(data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to fetch summary data");
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = useReactToPrint({ contentRef: componentRef });

    const filteredSummary = summary.filter(item =>
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.barcode && item.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleExport = () => {
        const csvContent = [
            ['Product Name', 'Category', 'Barcode', 'Opening', 'In (+)', 'Out (-)', 'Closing'],
            ...filteredSummary.map(s => [
                s.productName,
                s.category,
                s.barcode || 'N/A',
                s.openingStock,
                s.periodIn,
                s.periodOut,
                s.closingStock
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stock-summary-${startDate}-${endDate}.csv`;
        a.click();
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-800">Stock Summary Report</h1>
                    <p className="text-slate-500 text-sm mt-1">{filteredSummary.length} products analyzed</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handlePrint}
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
                        onClick={fetchReport}
                        disabled={loading}
                        className="bg-primary text-white px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 hover:bg-primary-dark transition-all shadow-sm disabled:opacity-50"
                        style={{ backgroundColor: theme.primaryColor }}
                    >
                        <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {loading ? "Loading..." : "Generate"}
                    </button>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col gap-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-medium text-slate-500 uppercase flex items-center gap-1"><FiCalendar /> From Date</label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-medium text-slate-500 uppercase flex items-center gap-1"><FiCalendar /> To Date</label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-medium text-slate-500 uppercase flex items-center gap-1">Branch</label>
                        <select
                            disabled={user?.role !== 'admin'}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-slate-50"
                            value={selectedBranch}
                            onChange={e => setSelectedBranch(e.target.value)}
                        >
                            <option value="all">All Branches</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-medium text-slate-500 uppercase flex items-center gap-1">Category</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            value={selectedCategory}
                            onChange={e => setSelectedCategory(e.target.value)}
                        >
                            <option value="all">All Categories</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="relative max-w-md">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search products in period summary..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-400 font-medium">Processing summary data...</div>
            ) : (
                <div className="card shadow-md border border-slate-200 overflow-hidden" ref={componentRef}>
                    <div className="p-8 hidden print:block border-b-2 border-slate-200">
                        <h2 className="text-2xl font-semibold text-slate-800">Stock Summary Report</h2>
                        <p className="text-slate-500 font-medium">Period: {startDate} to {endDate}</p>
                        <p className="text-sm mt-1 font-semibold">
                            Branch: {selectedBranch === 'all' ? 'All Branches' : branches.find(b => b.id.toString() === selectedBranch)?.name || 'N/A'}
                        </p>
                    </div>

                    <div className="table-container">
                        <table className="table-modern">
                            <thead>
                                <tr>
                                    <th style={{ width: '4%' }}>#</th>
                                    <th style={{ width: '30%' }}>Product Details</th>
                                    <th style={{ width: '13%' }} className="text-center border-l border-slate-100">Opening</th>
                                    <th style={{ width: '13%' }} className="text-center text-emerald-700">In (+)</th>
                                    <th style={{ width: '13%' }} className="text-center text-red-700">Out (-)</th>
                                    <th style={{ width: '15%' }} className="text-right border-l border-slate-100">Closing Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSummary.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-12 text-slate-400 italic">
                                            No movement data found for the selected period
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSummary.map((item, index) => (
                                        <tr key={index}>
                                            <td className="text-slate-500">{index + 1}</td>
                                            <td>
                                                <div className="font-semibold text-slate-800">{item.productName}</div>
                                                <div className="text-[10px] text-slate-400 font-medium">{item.category} {item.barcode && `| SKU: ${item.barcode}`}</div>
                                            </td>
                                            <td className="text-center font-mono text-sm text-slate-600 bg-slate-50/30 border-l border-slate-100">
                                                {item.openingStock.toLocaleString()}
                                            </td>
                                            <td className="text-center font-medium text-emerald-600 tabular-nums">
                                                {item.periodIn > 0 ? `+${item.periodIn.toLocaleString()}` : '-'}
                                            </td>
                                            <td className="text-center font-medium text-red-500 tabular-nums">
                                                {item.periodOut > 0 ? `-${item.periodOut.toLocaleString()}` : '-'}
                                            </td>
                                            <td className="text-right font-medium text-slate-800 tabular-nums border-l border-slate-100 pr-4">
                                                {item.closingStock.toLocaleString()}
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
                            Summary for <span className="font-semibold">{filteredSummary.length}</span> items
                        </div>
                        <div className="flex gap-10 text-[13px]">
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Total In</span>
                                <span className="font-medium text-emerald-600">+{filteredSummary.reduce((sum, i) => sum + i.periodIn, 0).toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Total Out</span>
                                <span className="font-medium text-red-500">-{filteredSummary.reduce((sum, i) => sum + i.periodOut, 0).toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Closing Value</span>
                                <span className="font-medium text-slate-900 text-base" style={{ color: theme.primaryColor }}>
                                    {filteredSummary.reduce((sum, i) => sum + i.closingStock, 0).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
