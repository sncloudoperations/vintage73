
import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { FiCalendar, FiUser, FiDownload, FiDollarSign } from 'react-icons/fi';
import { toast } from 'react-toastify';

export default function SalesmanReport() {
    const [reportData, setReportData] = useState([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [user, setUser] = useState(null);

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
        fetchReport();
    }, []);

    useEffect(() => {
        fetchReport();
    }, [selectedBranch, startDate, endDate]);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const queryBranchId = selectedBranch === 'all' ? undefined : selectedBranch;
            
            // We can reuse the sales endpoint and aggregate on client side for now, 
            // or better, create a specific agg endpoint.
            // For speed, let's fetch sales and aggregate here client-side as dataset size permits.
            // Ideally, a dedicated endpoint `/reports/salesman` should be created.
            
            // Re-using getAllSales params
            const params = { branchId: queryBranchId };
            if (startDate) params.startDate = startDate;
            if (endDate) {
                const nextDay = new Date(endDate);
                nextDay.setDate(nextDay.getDate() + 1);
                params.endDate = nextDay.toISOString().split('T')[0];
            }

            const { data } = await api.get('/sales', { params });
            
            // Client-Side Aggregation
            const agg = {};
            data.forEach(sale => {
                if (sale.salesman) {
                    const name = sale.salesman.name || 'Unknown';
                    if (!agg[name]) agg[name] = { name, salesCount: 0, totalRevenue: 0, totalIncentive: 0 };
                    agg[name].salesCount++;
                    agg[name].totalRevenue += parseFloat(sale.totalAmount);
                    agg[name].totalIncentive += parseFloat(sale.incentiveAmount || 0);
                }
            });

            setReportData(Object.values(agg));
        } catch (err) {
            console.error(err);
            toast.error('Failed to load report');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Salesman Performance</h1>
                    <p className="text-slate-500 text-sm mt-1">Incentive and Revenue Report</p>
                </div>
                <button className="btn btn-secondary" onClick={() => window.print()}>
                    <FiDownload className="text-lg" /> Export
                </button>
            </div>

            {/* Filters */}
            <div className="card mb-6 border-0 shadow-sm bg-white p-6 rounded-xl">
                <div className="flex flex-wrap gap-6 items-end">
                    
                    {user?.role === 'admin' && (
                        <div>
                             <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 tracking-wider">Branch</label>
                             <select 
                                 className="input py-2 border rounded-lg px-3 min-w-[150px]"
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

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 tracking-wider">From</label>
                        <input type="date" className="input py-2 border rounded-lg px-3" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 tracking-wider">To</label>
                        <input type="date" className="input py-2 border rounded-lg px-3" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    
                    <button className="text-sm font-bold text-emerald-600 hover:text-emerald-700 pb-2" onClick={() => { setStartDate(''); setEndDate(''); }}>Reset</button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reportData.map((d, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                <FiUser size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">{d.name}</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{d.salesCount} Sales Completed</p>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                                <span className="text-sm font-medium text-slate-600">Total Revenue</span>
                                <span className="font-black text-slate-800 text-lg">₹{d.totalRevenue.toFixed(2)}</span>
                            </div>
                            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex justify-between items-center">
                                <span className="text-sm font-bold text-emerald-700 uppercase tracking-tight flex items-center gap-2">
                                   <FiDollarSign /> Incentive Earned
                                </span>
                                <span className="font-black text-emerald-600 text-xl">₹{d.totalIncentive.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                ))}
                
                {reportData.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400 italic bg-white rounded-xl border border-dashed border-slate-200">
                        No sales data found with assigned salesmen for the selected period.
                    </div>
                )}
            </div>
        </div>
    );
}
