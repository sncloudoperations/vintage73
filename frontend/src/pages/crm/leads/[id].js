import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { 
    FiArrowLeft, FiEdit3, FiTrash2, FiClock, FiMessageSquare, 
    FiCheckCircle, FiXCircle, FiCalendar, FiDollarSign, 
    FiShoppingCart, FiUser, FiPhone, FiMail, FiMapPin, FiSend,
    FiMoreVertical, FiTrendingUp, FiActivity, FiInfo
} from 'react-icons/fi';

import Link from 'next/link';
import { useRouter } from 'next/router';
import moment from 'moment';


export default function LeadDetail() {
    const router = useRouter();
    const { id } = router.query;
    const [lead, setLead] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('timeline');
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showFollowUpModal, setShowFollowUpModal] = useState(false);
    const [showConvertModal, setShowConvertModal] = useState(null); // 'QUOTATION' or 'ORDER'
    const [convertForm, setConvertForm] = useState({ number: '', branchId: '', paymentMethod: 'CASH' });
    const [branches, setBranches] = useState([]);
    const [note, setNote] = useState('');
    const [followUpDate, setFollowUpDate] = useState('');
    const [followUpNotes, setFollowUpNotes] = useState('');


    useEffect(() => {
        if (id) {
            fetchLeadDetails();
            fetchBranches();
        }
    }, [id]);

    const fetchLeadDetails = async () => {
        try {
            const res = await api.get(`/crm/leads/${id}`);
            setLead(res.data);
            if (res.data.branchId) setConvertForm(prev => ({ ...prev, branchId: res.data.branchId }));
        } catch (err) {
            toast.error("Failed to fetch lead details");
        } finally {
            setLoading(false);
        }
    };

    const fetchBranches = async () => {
        try {
            const res = await api.get('/branches');
            setBranches(res.data);
        } catch (err) {
            console.error(err);
        }
    };


    const handleStatusUpdate = async (newStatus) => {
        try {
            await api.put(`/crm/leads/${id}/status`, { status: newStatus, notes: note });
            toast.success(`Status updated to ${newStatus}`);
            setShowStatusModal(false);
            setNote('');
            fetchLeadDetails();
        } catch (err) {
            toast.error("Failed to update status");
        }
    };

    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!note.trim()) return;
        try {
            await api.post(`/crm/leads/${id}/activities`, { type: 'NOTE', description: note });
            toast.success("Note added");
            setNote('');
            fetchLeadDetails();
        } catch (err) {
            toast.error("Failed to add note");
        }
    };

    const handleScheduleFollowUp = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/crm/leads/${id}/followups`, { date: followUpDate, notes: followUpNotes });
            toast.success("Follow-up scheduled");
            setShowFollowUpModal(false);
            setFollowUpDate('');
            setFollowUpNotes('');
            fetchLeadDetails();
        } catch (err) {
            toast.error("Failed to schedule follow-up");
        }
    };

    const handleConvert = async (e) => {
        e.preventDefault();
        const endpoint = showConvertModal === 'QUOTATION' ? 'convert-quotation' : 'convert-order';
        const payload = showConvertModal === 'QUOTATION' 
            ? { branchId: convertForm.branchId, quotationNumber: convertForm.number }
            : { branchId: convertForm.branchId, invoiceNumber: convertForm.number, paymentMethod: convertForm.paymentMethod };

        try {
            await api.post(`/crm/leads/${id}/${endpoint}`, payload);
            toast.success(`Successfully converted to ${showConvertModal}`);
            setShowConvertModal(null);
            fetchLeadDetails();
        } catch (err) {
            toast.error(err.response?.data?.error || "Conversion failed");
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'WON': return 'bg-emerald-500';
            case 'LOST': return 'bg-red-500';
            case 'NEW': return 'bg-amber-500';
            default: return 'bg-blue-500';
        }
    };

    const stages = ['NEW', 'CONTACTED', 'QUALIFIED', 'QUOTATION_SENT', 'NEGOTIATION', 'WON'];
    const currentStageIndex = stages.indexOf(lead ? (lead.status === 'LOST' ? 'WON' : lead.status) : 'NEW');

    if (loading) return <div className="p-12 text-center text-slate-400 font-black animate-pulse uppercase tracking-widest">Loading Lead Details...</div>;
    if (!lead) return <div className="p-12 text-center text-red-500 font-bold uppercase">Lead Not Found</div>;

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
                        <FiArrowLeft />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            {lead.name}
                            <span className={`px-2 py-0.5 rounded text-[10px] text-white uppercase font-bold ${getStatusColor(lead.status)}`}>
                                {lead.status.replace('_', ' ')}
                            </span>
                        </h1>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1 flex items-center gap-2">
                            <FiPhone className="text-slate-300" /> {lead.phone} • <FiMapPin className="text-slate-300" /> {lead.address || 'Location Unknown'}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {lead.status !== 'WON' && lead.status !== 'LOST' && (
                        <>
                            <button onClick={() => setShowConvertModal('QUOTATION')} className="btn btn-secondary py-2 text-xs font-black uppercase border-purple-200 text-purple-600 hover:bg-purple-50">Convert to Quotation</button>
                            <button onClick={() => setShowConvertModal('ORDER')} className="btn btn-secondary py-2 text-xs font-black uppercase border-emerald-200 text-emerald-600 hover:bg-emerald-50">Convert to Order</button>
                            <button onClick={() => setShowStatusModal(true)} className="btn btn-secondary py-2 text-xs font-black uppercase">Update Status</button>
                        </>
                    )}
                    <button onClick={() => setShowFollowUpModal(true)} className="btn btn-primary py-2 text-xs font-black uppercase">Schedule Follow-up</button>
                </div>
            </header>


            {/* Pipeline Visualizer */}
            <div className="card bg-white p-6 md:p-8 shadow-sm">
                <div className="flex items-center justify-between relative">
                    <div className="absolute left-0 right-0 h-0.5 bg-slate-100 top-1/2 -translate-y-1/2 z-0"></div>
                    <div 
                        className="absolute left-0 h-0.5 bg-emerald-500 top-1/2 -translate-y-1/2 z-0 transition-all duration-1000"
                        style={{ width: `${(Math.max(0, currentStageIndex) / (stages.length - 1)) * 100}%` }}
                    ></div>
                    {stages.map((stage, i) => {
                        const isActive = stages.indexOf(lead.status) >= i;
                        const isCurrent = lead.status === stage;
                        const isLost = lead.status === 'LOST' && i === currentStageIndex;
                        
                        return (
                            <div key={stage} className="relative z-10 flex flex-col items-center group">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${
                                    isActive ? 'bg-emerald-500 border-emerald-100 scale-110' : 'bg-white border-slate-100'
                                }`}>
                                    {isActive ? <FiCheckCircle className="text-white text-xs" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />}
                                </div>
                                <span className={`absolute top-10 text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${
                                    isActive ? 'text-emerald-600' : 'text-slate-400'
                                }`}>
                                    {stage.replace('_', ' ')}
                                </span>
                            </div>
                        );
                    })}
                </div>
                {lead.status === 'LOST' && (
                    <div className="mt-12 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
                        <FiXCircle className="text-red-500" />
                        <p className="text-xs font-bold text-red-700 uppercase tracking-widest">Lead Marked as LOST</p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Info Column */}
                <div className="space-y-6">
                    <div className="card shadow-sm">
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-4 pb-2 border-b border-slate-50 flex items-center gap-2">
                            <FiInfo className="text-blue-500" /> Basic Information
                        </h3>
                        <dl className="space-y-4">
                            {[
                                { label: 'Email', value: lead.email || 'N/A', icon: FiMail },
                                { label: 'Source', value: lead.source || 'Direct', icon: FiTrendingUp },
                                { label: 'Priority', value: lead.priority, icon: FiActivity, color: lead.priority === 'HIGH' ? 'text-red-500' : 'text-slate-600' },
                                { label: 'Assigned To', value: lead.assignedUser?.name || 'Unassigned', icon: FiUser },
                                { label: 'Created On', value: moment(lead.createdAt).format('DD MMM YYYY'), icon: FiCalendar }
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><item.icon /></div>
                                    <div>
                                        <dt className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{item.label}</dt>
                                        <dd className={`text-xs font-bold mt-0.5 ${item.color || 'text-slate-700'}`}>{item.value}</dd>
                                    </div>
                                </div>
                            ))}
                        </dl>
                    </div>

                    <div className="card shadow-sm border-emerald-100">
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-4 pb-2 border-b border-slate-50 flex items-center gap-2">
                            <FiShoppingCart className="text-emerald-500" /> Interest Details
                        </h3>
                        <div className="space-y-4">
                            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Interested Product</p>
                                <p className="text-sm font-black text-slate-800">{lead.product?.name || 'Generic Inquiry'}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 rounded-xl">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quantity</p>
                                    <p className="text-sm font-black text-slate-800">{lead.quantity || 1}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Budget</p>
                                    <p className="text-sm font-black text-emerald-600">₹{lead.budget ? parseFloat(lead.budget).toLocaleString() : 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Activity & Notes Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-200">
                        {['timeline', 'follow-ups', 'details'].map(tab => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                                    activeTab === tab ? 'border-b-2 border-emerald-500 text-emerald-600 bg-emerald-50/10' : 'text-slate-400'
                                }`}
                            >
                                {tab.replace('-', ' ')}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'timeline' && (
                        <div className="space-y-6">
                            {/* Fast Note Input */}
                            <form onSubmit={handleAddNote} className="card p-3 shadow-sm border-slate-200 flex gap-2">
                                <input 
                                    className="input flex-1 border-none focus:ring-0 text-sm" 
                                    placeholder="Type a quick note here..."
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                />
                                <button type="submit" className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20">
                                    <FiSend />
                                </button>
                            </form>

                            {/* Timeline Items */}
                            <div className="relative space-y-6 before:absolute before:left-4 before:top-2 before:bottom-0 before:w-0.5 before:bg-slate-100">
                                {lead.activities.map((activity, i) => (
                                    <div key={i} className="flex gap-6 relative">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm relative z-10 ${
                                            activity.type === 'STATUS_CHANGE' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {activity.type === 'STATUS_CHANGE' ? <FiTrendingUp className="text-[10px]" /> : <FiClock className="text-[10px]" />}
                                        </div>
                                        <div className="card p-4 shadow-sm flex-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{activity.type.replace('_', ' ')}</p>
                                                <p className="text-[9px] text-slate-300 font-mono">
                                                    {moment(activity.createdAt).format('DD MMM, HH:mm')}
                                                </p>
                                            </div>
                                            <p className="text-xs text-slate-700 font-medium leading-relaxed">{activity.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'follow-ups' && (
                        <div className="space-y-4">
                            {lead.followUps.length === 0 ? (
                                <div className="card p-12 text-center text-slate-400 font-bold italic border-dashed border-2 border-slate-100">
                                    No follow-ups scheduled for this lead.
                                </div>
                            ) : (
                                lead.followUps.map(fu => (
                                    <div key={fu.id} className="card p-4 shadow-sm flex justify-between items-center bg-white hover:border-emerald-200 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-xl text-xs font-black uppercase tracking-tighter ${
                                                moment(fu.date).isBefore(moment()) ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                                            }`}>
                                                {moment(fu.date).format('DD MMM')}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-800">{fu.notes || 'No description provided'}</p>
                                                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mt-0.5">{fu.status}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button className="p-1.5 text-slate-300 hover:text-emerald-500 transition-colors"><FiCheckCircle /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {showStatusModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-6">
                        <header>
                            <h3 className="text-lg font-black text-slate-800">Update Lead Status</h3>
                            <p className="text-xs text-slate-400 font-medium mt-1">Select the current stage of this lead</p>
                        </header>
                        
                        <div className="grid grid-cols-2 gap-2">
                            {['NEW', 'CONTACTED', 'QUALIFIED', 'QUOTATION_SENT', 'NEGOTIATION', 'WON', 'LOST'].map(s => (
                                <button 
                                    key={s}
                                    onClick={() => handleStatusUpdate(s)}
                                    className={`p-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-center border-2 transition-all ${
                                        lead.status === s ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-50 border-transparent hover:border-slate-200'
                                    }`}
                                >
                                    {s.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                        
                        <button onClick={() => setShowStatusModal(false)} className="w-full py-3 text-xs font-black text-slate-400 border border-slate-100 rounded-xl">Cancel</button>
                    </div>
                </div>
            )}

            {showFollowUpModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <form onSubmit={handleScheduleFollowUp} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-8 space-y-6 animate-in zoom-in duration-300">
                        <header>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Schedule Follow-up</h3>
                            <p className="text-xs text-slate-400 font-medium mt-1">Set a reminder to reach out back to {lead.name}</p>
                        </header>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Date & Time</label>
                                <input required type="datetime-local" className="input" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Notes / Objective</label>
                                <textarea className="input min-h-[100px]" placeholder="e.g., Discuss bulk discount, Send catalogue..." value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)}></textarea>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button type="button" onClick={() => setShowFollowUpModal(false)} className="btn btn-secondary flex-1 font-black text-xs uppercase tracking-widest">Cancel</button>
                            <button type="submit" className="btn btn-primary flex-1 font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20">Schedule</button>
                        </div>
                    </form>
                </div>
            )}

            {showConvertModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <form onSubmit={handleConvert} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-8 space-y-6 animate-in zoom-in duration-300">
                        <header>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Convert to {showConvertModal}</h3>
                            <p className="text-xs text-slate-400 font-medium mt-1">Transform this lead inquiry into a formal {showConvertModal.toLowerCase()}</p>
                        </header>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Select Branch</label>
                                <select required className="input" value={convertForm.branchId} onChange={e => setConvertForm({ ...convertForm, branchId: e.target.value })}>
                                    <option value="">Select Branch</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">
                                    {showConvertModal} Number
                                </label>
                                <input 
                                    required 
                                    className="input" 
                                    placeholder={showConvertModal === 'QUOTATION' ? 'QTN-001' : 'INV-001'}
                                    value={convertForm.number}
                                    onChange={e => setConvertForm({ ...convertForm, number: e.target.value })}
                                />
                            </div>
                            {showConvertModal === 'ORDER' && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Payment Method</label>
                                    <select className="input" value={convertForm.paymentMethod} onChange={e => setConvertForm({ ...convertForm, paymentMethod: e.target.value })}>
                                        <option value="CASH">Cash</option>
                                        <option value="BANK_TRANSFER">Bank Transfer</option>
                                        <option value="UPI">UPI</option>
                                        <option value="CARD">Card</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button type="button" onClick={() => setShowConvertModal(null)} className="btn btn-secondary flex-1 font-black text-xs uppercase tracking-widest">Cancel</button>
                            <button type="submit" className="btn btn-primary flex-1 font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20">Confirm Conversion</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

