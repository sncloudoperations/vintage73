import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiTrendingUp, FiDollarSign, FiUser, FiArrowRight, FiCheckCircle, FiClock, FiSearch, FiFilter, FiX, FiInfo } from 'react-icons/fi';
import Link from 'next/link';
import { useRouter } from 'next/router';
import moment from 'moment';

export default function MyReferralLeads() {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [user, setUser] = useState(null);
    const router = useRouter();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) setUser(JSON.parse(storedUser));
    }, []);

    useEffect(() => {
        fetchMyLeads();
    }, []);

    const fetchMyLeads = async () => {
        setLoading(true);
        try {
            const res = await api.get('/crm/my-leads');
            setLeads(res.data);
        } catch (err) {
            toast.error("Failed to fetch your referral leads");
        } finally {
            setLoading(false);
        }
    };

    const fetchPaymentHistory = async (leadId) => {
        setHistoryLoading(true);
        try {
            const res = await api.get(`/crm/leads/${leadId}/payments`);
            setPaymentHistory(res.data);
        } catch (err) {
            toast.error("Failed to fetch payment history");
        } finally {
            setHistoryLoading(false);
        }
    };

    const filteredLeads = leads.filter(l => {
        const matchesSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (l.product?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === '' || l.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const stats = {
        total: leads.length,
        won: leads.filter(l => l.status === 'WON').length,
        negotiation: leads.filter(l => l.status === 'NEGOTIATION').length,
        quotation: leads.filter(l => l.status === 'QUOTATION_SENT').length,
        lost: leads.filter(l => l.status === 'LOST').length,
        totalEarning: leads.reduce((sum, l) => sum + Number(l.commissionAmount || 0), 0),
        totalPaid: leads.reduce((sum, l) => sum + Number(l.totalPaid || 0), 0),
        totalBalance: leads.reduce((sum, l) => sum + Number(l.balance || 0), 0)
    };

    const statusColors = {
        'NEW': 'bg-amber-50 text-amber-600 border-amber-100',
        'CONTACTED': 'bg-blue-50 text-blue-600 border-blue-100',
        'QUALIFIED': 'bg-orange-50 text-orange-600 border-orange-100',
        'QUOTATION_SENT': 'bg-purple-50 text-purple-600 border-purple-100',
        'NEGOTIATION': 'bg-indigo-50 text-indigo-600 border-indigo-100',
        'WON': 'bg-emerald-50 text-emerald-600 border-emerald-100',
        'LOST': 'bg-red-50 text-red-600 border-red-100'
    };

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-semibold text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-purple-100 text-purple-600 rounded-2xl"><FiTrendingUp /></div>
                        My Referral Leads
                    </h1>
                    <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-[10px] font-medium">Track your referral earnings and status</p>
                </div>
            </header>

            {/* Amount Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-xl hover:shadow-slate-200/50 transition-all">
                    <div className="absolute top-0 right-0 p-8 text-slate-50 group-hover:text-purple-50 transition-colors">
                        <FiTrendingUp className="text-6xl" />
                    </div>
                    <p className="text-[10px] font-semibold uppercase text-slate-400 tracking-widest leading-none mb-3">Total Earnings</p>
                    <h3 className="text-4xl font-bold text-slate-800">₹{stats.totalEarning.toLocaleString()}</h3>
                    <div className="mt-6 flex items-center gap-2 text-purple-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest">Potential Commission</span>
                    </div>
                </div>
                <div className="bg-emerald-600 rounded-[32px] p-8 border border-emerald-500 shadow-lg shadow-emerald-200 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 text-emerald-500/50">
                        <FiCheckCircle className="text-6xl" />
                    </div>
                    <p className="text-[10px] font-semibold uppercase text-emerald-100 tracking-widest leading-none mb-3">Total Paid</p>
                    <h3 className="text-4xl font-bold text-white">₹{stats.totalPaid.toLocaleString()}</h3>
                    <div className="mt-6 flex items-center gap-2 text-emerald-100">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest">Amount Disbursed</span>
                    </div>
                </div>
                <div className="bg-amber-500 rounded-[32px] p-8 border border-amber-400 shadow-lg shadow-amber-200 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 text-amber-400/50">
                        <FiClock className="text-6xl" />
                    </div>
                    <p className="text-[10px] font-semibold uppercase text-amber-50 tracking-widest leading-none mb-3">Pending Balance</p>
                    <h3 className="text-4xl font-bold text-white">₹{stats.totalBalance.toLocaleString()}</h3>
                    <div className="mt-6 flex items-center gap-2 text-amber-50">
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest">Awaiting Payout</span>
                    </div>
                </div>
            </div>

            {/* Status Summary */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {[
                    { label: 'Won', value: stats.won, color: 'emerald', status: 'WON' },
                    { label: 'Negotiation', value: stats.negotiation, color: 'indigo', status: 'NEGOTIATION' },
                    { label: 'Quotation', value: stats.quotation, color: 'purple', status: 'QUOTATION_SENT' },
                    { label: 'Lost', value: stats.lost, color: 'red', status: 'LOST' },
                    { label: 'Total Leads', value: stats.total, color: 'slate', status: '' },
                    { label: 'Deal Value', value: '₹' + leads.reduce((sum, l) => sum + Number(l.negotiationAmount || 0), 0).toLocaleString(), color: 'slate', isValue: true }
                ].map((s, i) => (
                    <button 
                        key={i} 
                        onClick={() => !s.isValue && setStatusFilter(s.status)}
                        className={`p-4 rounded-2xl border transition-all text-left ${s.isValue ? 'bg-slate-50 border-slate-100' : (statusFilter === s.status ? 'bg-white border-primary shadow-md scale-[1.02]' : 'bg-white border-slate-100 hover:border-slate-200')}`}
                    >
                        <p className="text-[9px] font-semibold uppercase text-slate-400 tracking-tighter mb-1">{s.label}</p>
                        <h4 className={`text-xl font-bold ${s.color === 'emerald' ? 'text-emerald-600' : s.color === 'red' ? 'text-red-600' : 'text-slate-800'}`}>{s.value}</h4>
                    </button>
                ))}
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="card p-2 flex items-center gap-3 shadow-sm w-full md:max-w-md">
                    <FiSearch className="text-slate-400 ml-2" />
                    <input 
                        className="input border-none focus:ring-0 text-sm py-1 bg-transparent" 
                        placeholder="Search by customer or product..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <select 
                        className="input text-xs font-semibold uppercase tracking-widest" 
                        value={statusFilter} 
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="">All Statuses</option>
                        <option value="NEW">New</option>
                        <option value="NEGOTIATION">Negotiation</option>
                        <option value="QUOTATION_SENT">Quotation Sent</option>
                        <option value="WON">Won</option>
                        <option value="LOST">Lost</option>
                    </select>
                    {statusFilter && (
                        <button onClick={() => setStatusFilter('')} className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all">
                            <FiX />
                        </button>
                    )}
                </div>
            </div>

            {/* Referral Table */}
            <div className="table-container shadow-2xl shadow-slate-200/50 border border-slate-100 rounded-[32px] overflow-hidden bg-white">
                <table className="table-modern">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                            <th className="text-[10px] font-semibold uppercase tracking-widest py-6 px-8">Customer</th>
                            <th className="text-[10px] font-semibold uppercase tracking-widest py-6">Deal Status</th>
                            <th className="text-[10px] font-semibold uppercase tracking-widest py-6 text-right">Deal Value</th>
                            <th className="text-[10px] font-semibold uppercase tracking-widest py-6 text-right text-purple-600">Earnings</th>
                            <th className="text-[10px] font-semibold uppercase tracking-widest py-6 text-right text-emerald-600">Paid</th>
                            <th className="text-[10px] font-semibold uppercase tracking-widest py-6 text-right text-amber-500">Balance</th>
                            {user?.role === 'ADMIN' && <th className="text-right py-6 px-8">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan="7" className="p-24 text-center text-slate-400 font-semibold animate-pulse uppercase tracking-[0.2em]">Synchronizing Earnings...</td></tr>
                        ) : filteredLeads.length === 0 ? (
                            <tr><td colSpan="7" className="p-24 text-center text-slate-400 font-medium italic">No leads match your selection.</td></tr>
                        ) : filteredLeads.map(lead => (
                            <tr key={lead.id} className="hover:bg-slate-50/50 transition-all group">
                                <td className="py-5 px-8">
                                    <div className="font-semibold text-slate-700">{lead.name}</div>
                                    <div className="text-[10px] text-slate-400 mt-1 uppercase font-medium tracking-tight">{lead.product?.name || 'Custom Deal'}</div>
                                </td>
                                <td>
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-semibold uppercase tracking-widest border transition-all ${statusColors[lead.status] || 'bg-slate-50 text-slate-400'}`}>
                                        {lead.status.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="text-right font-semibold text-slate-500">
                                    ₹{parseFloat(lead.negotiationAmount || 0).toLocaleString()}
                                </td>
                                <td className="text-right font-bold text-purple-600">
                                    ₹{parseFloat(lead.commissionAmount || 0).toLocaleString()}
                                </td>
                                <td className="text-right font-semibold text-emerald-600">
                                    ₹{parseFloat(lead.totalPaid || 0).toLocaleString()}
                                </td>
                                <td className="text-right font-semibold text-amber-500">
                                    ₹{parseFloat(lead.balance || 0).toLocaleString()}
                                </td>
                                {user?.role === 'ADMIN' && (
                                    <td className="text-right px-8">
                                        <button 
                                            onClick={() => {
                                                setSelectedLead(lead);
                                                fetchPaymentHistory(lead.id);
                                                setShowHistoryModal(true);
                                            }}
                                            className="px-4 py-1.5 bg-slate-50 text-slate-400 rounded-full text-[10px] font-semibold uppercase tracking-widest hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100"
                                        >
                                            History
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* History Modal */}
            {showHistoryModal && selectedLead && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300">
                        <header className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl"><FiClock className="text-xl" /></div>
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Payment History</h3>
                                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mt-1">Lead: {selectedLead.name}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowHistoryModal(false)} className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 hover:rotate-90 transition-all"><FiX className="text-xl" /></button>
                        </header>
                        
                        <div className="p-8 max-h-[60vh] overflow-y-auto scrollbar-hide">
                            {historyLoading ? (
                                <div className="p-20 text-center text-slate-400 font-semibold animate-pulse uppercase tracking-widest">Loading transactions...</div>
                            ) : paymentHistory.length === 0 ? (
                                <div className="p-20 text-center text-slate-300 italic flex flex-col items-center gap-4">
                                    <FiInfo className="text-4xl opacity-20" />
                                    <p className="text-sm font-medium">No payments recorded for this referral yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {paymentHistory.map((pay, i) => (
                                        <div key={pay.id} className="p-6 bg-slate-50 rounded-[24px] border border-slate-100 flex justify-between items-center group hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-xs">
                                                    {paymentHistory.length - i}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black text-slate-800">₹{parseFloat(pay.amountPaid).toLocaleString()}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{moment(pay.paymentDate).format('DD MMM YYYY')} • {pay.paymentMethod}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ref Number</div>
                                                <div className="text-[11px] font-mono text-slate-600 mt-0.5">{pay.transactionNumber || 'N/A'}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <footer className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                            <div className="flex gap-8">
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Earned</p>
                                    <p className="text-lg font-black text-purple-600">₹{parseFloat(selectedLead.commissionAmount || 0).toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Paid</p>
                                    <p className="text-lg font-black text-emerald-600">₹{parseFloat(selectedLead.totalPaid || 0).toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Remaining Balance</p>
                                <p className="text-2xl font-black text-amber-500">₹{parseFloat(selectedLead.balance || 0).toLocaleString()}</p>
                            </div>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
}

