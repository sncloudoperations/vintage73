import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiTrendingUp, FiDollarSign, FiUser, FiArrowRight, FiCheckCircle, FiClock, FiSearch } from 'react-icons/fi';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function MyReferralLeads() {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();

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

    const filteredLeads = leads.filter(l => 
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (l.product?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = {
        total: leads.length,
        won: leads.filter(l => l.status === 'WON').length,
        pendingCommission: leads.filter(l => l.status === 'WON' && !l.commissionPaid).reduce((sum, l) => sum + parseFloat(l.commissionAmount || 0), 0),
        paidCommission: leads.filter(l => l.commissionPaid).reduce((sum, l) => sum + parseFloat(l.commissionAmount || 0), 0)
    };

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-purple-100 text-purple-600 rounded-2xl"><FiTrendingUp /></div>
                        My Referral Leads
                    </h1>
                    <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-[10px] font-black">Track your referral earnings and status</p>
                </div>
            </header>

            {/* Referral Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card p-6 border-l-4 border-blue-500">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-2">Total Referrals</p>
                    <h3 className="text-3xl font-black text-slate-800">{stats.total}</h3>
                </div>
                <div className="card p-6 border-l-4 border-emerald-500">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-2">Won Leas</p>
                    <h3 className="text-3xl font-black text-emerald-600">{stats.won}</h3>
                </div>
                <div className="card p-6 border-l-4 border-amber-500">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-2">Pending Payout</p>
                    <h3 className="text-3xl font-black text-amber-600">₹{stats.pendingCommission.toLocaleString()}</h3>
                </div>
                <div className="card p-6 border-l-4 border-purple-500 bg-purple-50/10">
                    <p className="text-[10px] font-black uppercase text-purple-400 tracking-widest leading-none mb-2">Earned Total</p>
                    <h3 className="text-3xl font-black text-purple-600">₹{stats.paidCommission.toLocaleString()}</h3>
                </div>
            </div>

            {/* Search */}
            <div className="card p-2 flex items-center gap-3 shadow-sm max-w-md">
                <FiSearch className="text-slate-400 ml-2" />
                <input 
                    className="input border-none focus:ring-0 text-sm py-1 bg-transparent" 
                    placeholder="Search by customer or product..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Referral Table */}
            <div className="table-container shadow-xl shadow-slate-200/50 border border-slate-100 rounded-3xl overflow-hidden">
                <table className="table-modern">
                    <thead className="bg-slate-50/50">
                        <tr>
                            <th className="text-[10px] font-black uppercase tracking-widest py-5">Customer</th>
                            <th className="text-[10px] font-black uppercase tracking-widest py-5">Product</th>
                            <th className="text-[10px] font-black uppercase tracking-widest py-5 text-right">Negotiation Amt</th>
                            <th className="text-[10px] font-black uppercase tracking-widest py-5 text-center">Comm. %</th>
                            <th className="text-[10px] font-black uppercase tracking-widest py-5 text-right text-purple-600">Earnings</th>
                            <th className="text-[10px] font-black uppercase tracking-widest py-5">Lead Status</th>
                            <th className="text-[10px] font-black uppercase tracking-widest py-5">Payment Status</th>
                            <th className="text-right py-5"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white">
                        {loading ? (
                            <tr><td colSpan="8" className="p-20 text-center text-slate-400 font-black animate-pulse uppercase tracking-widest letter-spacing-2">Fetching your earnings...</td></tr>
                        ) : filteredLeads.length === 0 ? (
                            <tr><td colSpan="8" className="p-20 text-center text-slate-400 font-bold italic border-dashed border-2 border-slate-50 rounded-3xl m-4 px-20">No referral leads found.</td></tr>
                        ) : filteredLeads.map(lead => (
                            <tr key={lead.id} className="hover:bg-slate-50/50 transition-all cursor-pointer group" onClick={() => router.push(`/crm/leads/${lead.id}`)}>
                                <td className="py-4">
                                    <div className="font-black text-slate-700">{lead.name}</div>
                                    <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold tracking-tighter">#{lead.id}</p>
                                </td>
                                <td>
                                    <div className="text-xs font-bold text-slate-600">{lead.product?.name || 'Inquiry'}</div>
                                </td>
                                <td className="text-right font-black text-slate-700">
                                    ₹{parseFloat(lead.negotiationAmount || 0).toLocaleString()}
                                </td>
                                <td className="text-center">
                                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                                        {lead.commissionPercentage}%
                                    </span>
                                </td>
                                <td className="text-right font-black text-purple-600">
                                    ₹{parseFloat(lead.commissionAmount || 0).toLocaleString()}
                                </td>
                                <td>
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
                                        lead.status === 'WON' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                        lead.status === 'LOST' ? 'bg-red-50 text-red-600 border-red-100' : 
                                        'bg-amber-50 text-amber-600 border-amber-100'
                                    }`}>
                                        {lead.status.replace('_', ' ')}
                                    </span>
                                </td>
                                <td>
                                    <div className="flex items-center gap-2">
                                        {lead.commissionPaid ? (
                                            <>
                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Paid</span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-2 h-2 rounded-full bg-amber-400" />
                                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Unpaid</span>
                                            </>
                                        )}
                                    </div>
                                </td>
                                <td className="text-right">
                                    <div className="p-2 text-slate-200 group-hover:text-purple-500 group-hover:bg-purple-50 rounded-full inline-flex transition-all">
                                        <FiArrowRight />
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
