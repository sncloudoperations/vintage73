import React, { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import {
    FiBox, FiPrinter, FiDownload, FiSearch, FiAlertTriangle, FiCheckCircle, FiRefreshCw
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useReactToPrint } from 'react-to-print';
import { useTheme } from '@/context/ThemeContext';

export default function CurrentStockBalance() {
    const { theme } = useTheme();
    const [stocks, setStocks] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
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
            const { data } = await api.get('/reports/current-stock', {
                params: {
                    branchId: selectedBranch,
                    categoryId: selectedCategory
                }
            });
            setStocks(data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to fetch stock data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedBranch) fetchReport();
    }, [selectedBranch, selectedCategory]);

    const handlePrint = useReactToPrint({ contentRef: componentRef });

    const filteredStocks = stocks.filter(item =>
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.barcode && item.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleExport = () => {
        const csvContent = [
            ['Product Name', 'Category', 'Barcode', 'Min Level', 'Stock Quantity'],
            ...filteredStocks.map(s => [
                s.productName,
                s.category,
                s.barcode || 'N/A',
                s.minStock,
                s.quantity
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `current-stock-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-800">Current Stock Balance</h1>
                    <p className="text-slate-500 text-sm mt-1">{filteredStocks.length} products listed</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold text-sm flex items-center gap-2 hover:bg-slate-50 transition-all"
                    >
                        <FiPrinter size={16} /> Print
                    </button>
                    <button
                        onClick={handleExport}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold text-sm flex items-center gap-2 hover:bg-slate-50 transition-all"
                    >
                        <FiDownload size={16} /> Export CSV
                    </button>
                    <button
                        onClick={fetchReport}
                        className="bg-primary text-white px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 hover:bg-primary-dark transition-all shadow-sm"
                        style={{ backgroundColor: theme.primaryColor }}
                    >
                        <FiRefreshCw size={16} /> Refresh
                    </button>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative max-w-md flex-1">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search products or barcodes..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-3">
                    {user?.role === 'admin' && (
                        <select
                            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
                            value={selectedBranch}
                            onChange={e => setSelectedBranch(e.target.value)}
                        >
                            <option value="all">All Branches</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    )}
                    <select
                        className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                    >
                        <option value="all">All Categories</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-400">Loading stock data...</div>
            ) : (
                <div className="card shadow-md border border-slate-200 overflow-hidden" ref={componentRef}>
                    <div className="p-8 hidden print:block border-b-2 border-slate-200">
                        <h2 className="text-2xl font-semibold text-slate-800">Current Stock Balance</h2>
                        <p className="text-slate-500">As of {new Date().toLocaleDateString()}</p>
                        <p className="text-sm mt-2 font-semibold">
                            Branch: {selectedBranch === 'all' ? 'All Branches' : branches.find(b => b.id.toString() === selectedBranch)?.name || 'N/A'}
                        </p>
                    </div>

                    <div className="table-container">
                        <table className="table-modern">
                            <thead>
                                <tr>
                                    <th style={{ width: '4%' }}>#</th>
                                    <th style={{ width: '30%' }}>Product Details</th>
                                    <th style={{ width: '15%' }}>Category</th>
                                    <th style={{ width: '15%' }} className="text-center">Barcode</th>
                                    <th style={{ width: '12%' }} className="text-center">Min Level</th>
                                    <th style={{ width: '12%' }} className="text-center">Status</th>
                                    <th style={{ width: '12%' }} className="text-right">Stock Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStocks.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="text-center py-8 text-slate-400 italic">
                                            No stock records found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStocks.map((item, index) => {
                                        const isLow = item.quantity <= item.minStock;
                                        return (
                                            <tr key={index}>
                                                <td className="text-slate-500">{index + 1}</td>
                                                <td>
                                                    <div className="font-semibold text-slate-800">{item.productName}</div>
                                                    <div className="text-[10px] text-slate-400">ID: {item.productId}</div>
                                                </td>
                                                <td>
                                                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium uppercase">
                                                        {item.category}
                                                    </span>
                                                </td>
                                                <td className="text-center font-mono text-xs text-slate-500">
                                                    {item.barcode || '-'}
                                                </td>
                                                <td className="text-center font-semibold text-slate-700">
                                                    {item.minStock}
                                                </td>
                                                <td className="text-center">
                                                    {isLow ? (
                                                        <span className="inline-flex items-center gap-1 text-red-600 font-medium text-[10px] uppercase bg-red-50 px-2 py-0.5 rounded border border-red-100">
                                                            <FiAlertTriangle size={10} /> Low
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium text-[10px] uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                                            <FiCheckCircle size={10} /> Healthy
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="text-right font-medium text-slate-900 pr-4">
                                                    <span className={isLow ? 'text-red-600 focus:ring-red-100' : ''}>
                                                        {item.quantity.toLocaleString()}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary Footer */}
                    <div className="bg-slate-50 border-t border-slate-300 px-6 py-4 flex justify-between items-center">
                        <div className="text-sm text-slate-600">
                            Showing <span className="font-semibold">{filteredStocks.length}</span> products
                        </div>
                        <div className="flex gap-8 text-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500">Low Stock Items:</span>
                                <span className="font-medium text-red-600">
                                    {filteredStocks.filter(s => s.quantity <= s.minStock).length}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500 font-medium">Total Inventory Count:</span>
                                <span className="font-medium text-slate-800 text-lg" style={{ color: theme.primaryColor }}>
                                    {filteredStocks.reduce((sum, s) => sum + s.quantity, 0).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
