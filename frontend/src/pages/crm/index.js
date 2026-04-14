import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { FiUsers, FiDollarSign, FiBriefcase, FiTrendingUp } from 'react-icons/fi';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

export default function CRMDashboard() {
    const [stats, setStats] = useState({
        totalLeads: 0,
        newLeads: 0,
        totalPipelineValue: 0,
        dealStages: {}
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await api.get('/crm/dashboard');
            setStats(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
    };

    // Chart Data
    const stageData = {
        labels: Object.keys(stats.dealStages),
        datasets: [
            {
                label: '# of Deals',
                data: Object.values(stats.dealStages),
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)', // Lost
                    'rgba(54, 162, 235, 0.5)', // Prospecting
                    'rgba(255, 206, 86, 0.5)', // Negotiation
                    'rgba(75, 192, 192, 0.5)', // Won
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                ],
                borderWidth: 1,
            },
        ],
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">CRM Dashboard</h1>
                <p className="text-slate-500 mt-2 font-medium">Overview of your sales pipeline and activities</p>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                        <FiUsers />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-400 uppercase tracking-widest">Total Leads</p>
                        <h3 className="text-2xl font-extrabold text-slate-800">{stats.totalLeads}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center text-xl">
                        <FiTrendingUp />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-400 uppercase tracking-widest">New Leads</p>
                        <h3 className="text-2xl font-bold text-slate-800">{stats.newLeads}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center text-xl">
                        <FiDollarSign />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-400 uppercase tracking-widest">Pipeline Value</p>
                        <h3 className="text-2xl font-extrabold text-slate-800">{formatCurrency(stats.totalPipelineValue)}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl">
                        <FiBriefcase />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-400 uppercase tracking-widest">Active Deals</p>
                        <h3 className="text-2xl font-bold text-slate-800">
                            {Object.entries(stats.dealStages).reduce((acc, [k, v]) => k !== 'LOST' && k !== 'WON' ? acc + v : acc, 0)}
                        </h3>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-medium text-slate-800 mb-6">Deals by Stage</h3>
                    <div className="h-64 flex justify-center">
                        {loading ? <p>Loading...</p> : (
                            Object.keys(stats.dealStages).length > 0 ?
                                <Doughnut data={stageData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }} /> :
                                <p className="text-slate-400 self-center">No deals data available</p>
                        )}
                    </div>
                </div>

                {/* Recent Activity Placeholder - To be implemented */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-medium text-slate-800 mb-6">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <a href="/crm/leads" className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-primary/20 hover:bg-primary-light transition-all group cursor-pointer block">
                            <div className="font-medium text-slate-700 group-hover:text-primary-dark">Add New Lead</div>
                            <div className="text-xs text-slate-400 mt-1"> Capture a new potential client</div>
                        </a>
                        <a href="/crm/deals" className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all group cursor-pointer block">
                            <div className="font-medium text-slate-700 group-hover:text-blue-700">Create Deal</div>
                            <div className="text-xs text-slate-400 mt-1"> Start a new sales loop</div>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
