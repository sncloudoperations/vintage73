import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiPlus, FiSearch, FiFilter, FiCalendar, FiUser, FiArrowRight, FiPhone, FiMail, FiEdit2 } from 'react-icons/fi';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function LeadList() {
    const [leads, setLeads] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ search: '', status: '', assignedTo: '', fromDate: '', toDate: '' });
    const router = useRouter();

    useEffect(() => {
        fetchLeads();
        fetchUsers();
    }, []);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams(filters).toString();
            const res = await api.get(`/crm/leads?${query}`);
            setLeads(res.data);
        } catch (err) {
            toast.error("Failed to fetch leads");
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const applyFilters = (e) => {
        e.preventDefault();
        fetchLeads();
    };

    const statusColors = {
        'NEW': 'bg-amber-100 text-amber-700 border-amber-200',
        'CONTACTED': 'bg-blue-100 text-blue-700 border-blue-200',
        'QUALIFIED': 'bg-orange-100 text-orange-700 border-orange-200',
        'QUOTATION_SENT': 'bg-purple-100 text-purple-700 border-purple-200',
        'NEGOTIATION': 'bg-indigo-100 text-indigo-700 border-indigo-200',
        'WON': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'LOST': 'bg-red-100 text-red-700 border-red-200'
    };

    const priorityColors = {
        'HIGH': 'text-red-600 font-medium',
        'MEDIUM': 'text-amber-600 font-medium',
        'LOW': 'text-slate-500 font-medium'
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Lead Management</h1>
                    <p className="text-slate-500 font-medium">Track and convert your sales inquiries</p>
                </div>
                <Link href="/crm/leads/create" className="btn btn-primary shadow-lg shadow-emerald-500/20">
                    <FiPlus className="text-lg" /> New Lead
                </Link>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Leads', value: leads.length, color: 'blue' },
                    { label: 'Won', value: leads.filter(l => l.status === 'WON').length, color: 'emerald' },
                    { label: 'Pending', value: leads.filter(l => !['WON', 'LOST'].includes(l.status)).length, color: 'amber' },
                    { label: 'Conversion', value: leads.length ? `${((leads.filter(l => l.status === 'WON').length / leads.length) * 100).toFixed(1)}%` : '0%', color: 'indigo' }
                ].map((kpi, i) => (
                    <div key={i} className="card p-4 flex flex-col justify-center">
                        <p className="text-[10px] font-medium uppercase text-slate-400 tracking-widest leading-none mb-1">{kpi.label}</p>
                        <h3 className={`text-2xl font-bold text-${kpi.color}-600`}>{kpi.value}</h3>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="card shadow-sm">
                <form onSubmit={applyFilters} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1 tracking-widest">Search</label>
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-3 text-slate-400" />
                            <input name="search" className="input pl-10" placeholder="Name or Phone..." value={filters.search} onChange={handleFilterChange} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1 tracking-widest">Status</label>
                        <select name="status" className="input" value={filters.status} onChange={handleFilterChange}>
                            <option value="">All Statuses</option>
                            <option value="NEW">New</option>
                            <option value="CONTACTED">Contacted</option>
                            <option value="QUALIFIED">Qualified</option>
                            <option value="QUOTATION_SENT">Quotation Sent</option>
                            <option value="NEGOTIATION">Negotiation</option>
                            <option value="WON">Won</option>
                            <option value="LOST">Lost</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1 tracking-widest">Assigned To</label>
                        <select name="assignedTo" className="input" value={filters.assignedTo} onChange={handleFilterChange}>
                            <option value="">All Employees</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
                        </select>
                    </div>
                    <button type="submit" className="btn btn-secondary w-full h-[42px] flex items-center justify-center gap-2">
                        <FiFilter /> Filter
                    </button>
                </form>
            </div>

            {/* Table */}
            <div className="table-container shadow-sm border border-slate-200">
                <table className="table-modern">
                    <thead>
                        <tr>
                            <th className="w-16">ID</th>
                            <th>Customer / Contact</th>
                            <th>Status / Source</th>
                            <th>Interest / Budget</th>
                            <th>Assigned To</th>
                            <th>Priority</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="7" className="p-12 text-center text-slate-400 animate-pulse font-medium uppercase tracking-widest">Loading Leads...</td></tr>
                        ) : leads.length === 0 ? (
                            <tr><td colSpan="7" className="p-12 text-center text-slate-400 font-medium italic">No leads found matching your criteria.</td></tr>
                        ) : leads.map(lead => (
                            <tr key={lead.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => router.push(`/crm/leads/${lead.id}`)}>
                                <td className="font-mono text-slate-400 text-xs">#{lead.id}</td>
                                <td>
                                    <div className="font-medium text-slate-700">{lead.name}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        {lead.phone && <span className="text-[10px] text-slate-500 flex items-center gap-1"><FiPhone className="text-slate-300" /> {lead.phone}</span>}
                                        {lead.email && <span className="text-[10px] text-slate-500 flex items-center gap-1"><FiMail className="text-slate-300" /> {lead.email}</span>}
                                    </div>
                                </td>
                                <td>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border uppercase tracking-tighter ${statusColors[lead.status]}`}>
                                        {lead.status.replace('_', ' ')}
                                    </span>
                                    <div className="text-[10px] text-slate-400 mt-1 font-medium uppercase">{lead.source || 'Direct'}</div>
                                </td>
                                <td>
                                    <div className="text-xs font-medium text-slate-600">{lead.product?.name || 'Inquiry'}</div>
                                    <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                                        {lead.budget ? `₹${parseFloat(lead.budget).toLocaleString()}` : <span className="text-slate-300 uppercase tracking-tighter">Budget Not Set</span>}
                                    </div>
                                </td>
                                <td>
                                    {lead.assignedUser ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px] font-medium text-slate-500">
                                                {lead.assignedUser.name?.[0] || 'U'}
                                            </div>
                                            <span className="text-xs font-medium text-slate-600">{lead.assignedUser.name}</span>
                                        </div>
                                    ) : <span className="text-[10px] text-slate-300 italic">Unassigned</span>}
                                </td>
                                <td>
                                    <span className={`text-[10px] uppercase tracking-widest ${priorityColors[lead.priority]}`}>
                                        {lead.priority}
                                    </span>
                                </td>
                                <td className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/crm/leads/create?id=${lead.id}`);
                                            }}
                                            className="p-2 text-slate-300 hover:text-primary transition-colors"
                                            title="Edit Lead"
                                        >
                                            <FiEdit2 />
                                        </button>
                                        <button className="p-2 text-slate-300 group-hover:text-emerald-500 transition-colors">
                                            <FiArrowRight />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
