import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiPlus, FiSearch, FiFilter, FiCalendar, FiUser, FiArrowRight, FiPhone, FiMail, FiEdit2, FiDollarSign, FiX, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function LeadList() {
    const [leads, setLeads] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ search: '', status: '', assignedTo: '', source: '', referredById: '', fromDate: '', toDate: '' });
    const [searchTerm, setSearchTerm] = useState(''); // For instant typing feedback
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);
    const [paymentForm, setPaymentForm] = useState({
        paymentDate: new Date().toISOString().split('T')[0],
        amountPaid: '',
        paymentMethod: 'Cash',
        bankName: '',
        transactionNumber: '',
        notes: ''
    });
    const router = useRouter();

    useEffect(() => {
        fetchLeads();
        fetchUsers();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm !== filters.search) {
                const newFilters = { ...filters, search: searchTerm };
                setFilters(newFilters);
                fetchLeads(newFilters);
            }
        }, 600);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchLeads = async (currentFilters = filters) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(currentFilters).forEach(([key, value]) => {
                if (value) params.append(key, value);
            });
            const res = await api.get(`/crm/leads?${params.toString()}`);
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

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        if (!paymentForm.amountPaid) return toast.error("Please enter amount");
        
        try {
            await api.post(`/crm/leads/${selectedLead.id}/payments`, paymentForm);
            toast.success("Payment recorded successfully");
            setShowPaymentModal(false);
            fetchLeads();
        } catch (err) {
            toast.error("Failed to record payment");
        }
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
                    <h1 className="text-3xl font-semibold text-slate-800 tracking-tight">Lead Management</h1>
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
                        <h3 className={`text-2xl font-semibold text-${kpi.color}-600`}>{kpi.value}</h3>
                    </div>
                ))}
            </div>

            {/* Search & Filters Section */}
            <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-6 mb-8">
                <form onSubmit={applyFilters} className="space-y-6">
                    {/* Primary Row: Search and Actions */}
                    <div className="flex flex-col lg:flex-row items-center gap-4">
                        <div className="w-full lg:flex-1 relative group">
                            <div className={`absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors ${searchTerm ? 'text-primary' : 'text-slate-400 group-focus-within:text-primary'}`}>
                                <FiSearch size={20} />
                            </div>
                            <input 
                                type="text"
                                className="w-full pl-14 pr-12 py-4 bg-slate-50/50 border border-slate-200 rounded-[20px] focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-medium text-slate-700 placeholder:text-slate-400 shadow-sm" 
                                placeholder="Search by name, phone, email or referrer..." 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                            />
                            {searchTerm && (
                                <button 
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute inset-y-0 right-0 pr-5 flex items-center text-slate-400 hover:text-red-500 transition-colors"
                                >
                                    <FiXCircle size={20} />
                                </button>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-3 w-full lg:w-auto">
                            <button type="submit" className="flex-1 lg:flex-none bg-slate-900 text-white px-8 py-4 rounded-[20px] font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-slate-900/10">
                                <FiFilter className="text-sm" /> Apply Filters
                            </button>
                            {Object.values(filters).some(v => v !== '') && (
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        const reset = { search: '', status: '', assignedTo: '', source: '', referredById: '', fromDate: '', toDate: '' };
                                        setFilters(reset);
                                        setSearchTerm('');
                                        setLoading(true);
                                        api.get('/crm/leads').then(res => setLeads(res.data)).finally(() => setLoading(false));
                                    }}
                                    className="w-12 h-12 flex items-center justify-center bg-red-50 text-red-500 rounded-[20px] hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                    title="Clear All Filters"
                                >
                                    <FiX size={20} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Secondary Row: Specific Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Source</label>
                            <select name="source" className="input bg-slate-50 border-slate-200 rounded-xl text-xs py-2.5" value={filters.source} onChange={handleFilterChange}>
                                <option value="">All Sources</option>
                                <option value="Walk-in">Walk-in</option>
                                <option value="Website">Website</option>
                                <option value="Call">Call</option>
                                <option value="WhatsApp">WhatsApp</option>
                                <option value="Social Media">Social Media</option>
                                <option value="Referral">Referral</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Status</label>
                            <select name="status" className="input bg-slate-50 border-slate-200 rounded-xl text-xs py-2.5" value={filters.status} onChange={handleFilterChange}>
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
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Assigned Specialist</label>
                            <select name="assignedTo" className="input bg-slate-50 border-slate-200 rounded-xl text-xs py-2.5" value={filters.assignedTo} onChange={handleFilterChange}>
                                <option value="">All Employees</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Referrer</label>
                            <select name="referredById" className="input bg-purple-50/30 border-purple-100 rounded-xl text-xs text-purple-600 font-semibold py-2.5" value={filters.referredById} onChange={handleFilterChange}>
                                <option value="">All Referrers</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
                            </select>
                        </div>
                    </div>
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
                                    {lead.source === 'Referral' && lead.referredBy && (
                                        <div className="mt-1 flex items-center gap-1">
                                            <span className="text-[9px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tight flex items-center gap-1">
                                                Ref: {lead.referredBy.name}
                                            </span>
                                        </div>
                                    )}
                                </td>
                                <td>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border uppercase tracking-tighter ${statusColors[lead.status]}`}>
                                        {lead.status.replace('_', ' ')}
                                    </span>
                                    <div className="flex flex-col mt-1">
                                        <div className="text-[10px] text-slate-400 font-medium uppercase">{lead.source || 'Direct'}</div>
                                        {lead.source === 'Referral' && lead.referredByUser && (
                                            <div className="text-[9px] text-purple-500 font-bold uppercase tracking-tight flex items-center gap-1">
                                                <FiUser size={8} /> {lead.referredByUser.name}
                                            </div>
                                        )}
                                    </div>
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
                                        {lead.source === 'Referral' && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedLead(lead);
                                                    setPaymentForm({ ...paymentForm, amountPaid: lead.balance });
                                                    setShowPaymentModal(true);
                                                }}
                                                className="p-2 text-slate-300 hover:text-emerald-500 transition-colors"
                                                title="Record Payment"
                                            >
                                                <FiDollarSign />
                                            </button>
                                        )}
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

            {/* Payment Modal */}
            {showPaymentModal && selectedLead && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
                        <header className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-semibold text-slate-800">Record Referral Payment</h3>
                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">Customer: {selectedLead.name}</p>
                            </div>
                            <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600"><FiX /></button>
                        </header>
                        <form onSubmit={handlePaymentSubmit} className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Total Payable</label>
                                    <div className="text-lg font-semibold text-slate-700">₹{parseFloat(selectedLead.commissionAmount || 0).toLocaleString()}</div>
                                </div>
                                <div className="space-y-1.5 text-right">
                                    <label className="text-[10px] font-semibold text-emerald-500 uppercase tracking-widest mr-1">Pending Balance</label>
                                    <div className="text-lg font-semibold text-emerald-600">₹{parseFloat(selectedLead.balance || 0).toLocaleString()}</div>
                                </div>
                            </div>
                            
                            <div className="divider h-px bg-slate-100 my-2" />

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Payment Date</label>
                                    <input type="date" className="input" value={paymentForm.paymentDate} onChange={e => setPaymentForm({...paymentForm, paymentDate: e.target.value})} required />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Amount to Pay (₹)</label>
                                    <input type="number" className="input font-semibold text-primary" value={paymentForm.amountPaid} onChange={e => setPaymentForm({...paymentForm, amountPaid: e.target.value})} required max={selectedLead.balance} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Method</label>
                                    <select className="input" value={paymentForm.paymentMethod} onChange={e => setPaymentForm({...paymentForm, paymentMethod: e.target.value})}>
                                        <option value="Cash">Cash</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="UPI">UPI / GPay</option>
                                        <option value="Cheque">Cheque</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Ref / Trans Number</label>
                                    <input className="input" placeholder="Optional" value={paymentForm.transactionNumber} onChange={e => setPaymentForm({...paymentForm, transactionNumber: e.target.value})} />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Notes</label>
                                <textarea className="input min-h-[80px]" placeholder="Optional payment details..." value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} />
                            </div>

                            <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-semibold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                                <FiCheckCircle /> Confirm Payment
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
