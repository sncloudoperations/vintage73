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

    const [showOutcomeModal, setShowOutcomeModal] = useState(false);
    const [selectedFollowUp, setSelectedFollowUp] = useState(null);
    const [outcomeForm, setOutcomeForm] = useState({ outcome: 'No Response', notes: '', nextFollowUpDate: '' });

    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [products, setProducts] = useState([]);
    const [users, setUsers] = useState([]);


    useEffect(() => {
        if (id) {
            fetchLeadDetails();
            fetchBranches();
            fetchProducts();
            fetchUsers();
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

    const fetchProducts = async () => {
        try {
            const res = await api.get('/products');
            setProducts(res.data);
        } catch (err) {
            console.error(err);
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

    const handleOpenOutcome = (fu) => {
        setSelectedFollowUp(fu);
        setOutcomeForm({ 
            outcome: 'No Response', 
            notes: fu.notes || '', 
            nextFollowUpDate: moment().add(1, 'days').format('YYYY-MM-DDTHH:mm') 
        });
        setShowOutcomeModal(true);
    };

    const handleSubmitOutcome = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/crm/followups/${selectedFollowUp.id}`, outcomeForm);
            toast.success("Follow-up updated successfully");
            setShowOutcomeModal(false);
            fetchLeadDetails();
        } catch (err) {
            toast.error("Failed to update follow-up");
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

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            // Clean up the object to send only editable fields
            const { 
                id: bodyId, 
                createdAt, 
                updatedAt, 
                product, 
                assignedUser, 
                activities, 
                followUps, 
                quotation, 
                sale, 
                referredBy,
                ...payload 
            } = editForm;

            await api.put(`/crm/leads/${id}`, payload);
            toast.success("Lead updated successfully");
            setShowEditModal(false);
            fetchLeadDetails();
        } catch (err) {
            toast.error("Failed to update lead");
        }
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditForm(prev => {
            const newForm = { ...prev, [name]: value };
            
            // Auto-calculate Budget
            if (name === 'productId' || name === 'quantity') {
                const product = products.find(p => p.id.toString() === newForm.productId);
                if (product) {
                    const price = parseFloat(product.price);
                    const qty = parseInt(newForm.quantity || 1);
                    newForm.budget = (price * qty).toFixed(2);
                    // Also set negotiation amount same as budget initially if not manually changed
                    if (!prev.negotiationAmount || prev.negotiationAmount === prev.budget) {
                        newForm.negotiationAmount = newForm.budget;
                    }
                }
            }
            return newForm;
        });
    };

    const toggleCommissionStatus = async () => {
        try {
            await api.put(`/crm/leads/${id}/commission`, { commissionPaid: !lead.commissionPaid });
            toast.success("Commission status updated");
            fetchLeadDetails();
        } catch (err) {
            toast.error("Failed to update commission status");
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

    if (loading) return <div className="p-12 text-center text-slate-400 font-medium animate-pulse uppercase tracking-widest">Loading Lead Details...</div>;
    if (!lead) return <div className="p-12 text-center text-red-500 font-medium uppercase">Lead Not Found</div>;

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
                        <FiArrowLeft />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                            {lead.name}
                            <span className={`px-2 py-0.5 rounded text-[10px] text-white uppercase font-medium ${getStatusColor(lead.status)}`}>
                                {lead.status.replace('_', ' ')}
                            </span>
                        </h1>
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mt-1 flex items-center gap-2">
                            <FiPhone className="text-slate-300" /> {lead.phone} • <FiMapPin className="text-slate-300" /> {lead.address || 'Location Unknown'}
                        </p>
                    </div>
                </div>
                <div className="flex flex-nowrap items-center justify-start lg:justify-end gap-3 w-full lg:w-auto mt-6 lg:mt-0 overflow-x-auto no-scrollbar py-1 px-1">
                    <button onClick={() => {
                        setEditForm(lead);
                        setShowEditModal(true);
                    }} className="flex items-center gap-2 bg-white text-slate-600 px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest border border-slate-200 hover:bg-slate-50 transition-all active:scale-95 whitespace-nowrap">
                        <FiEdit3 /> Edit Lead
                    </button>
                    {lead.status !== 'WON' && lead.status !== 'LOST' && (
                        <button onClick={() => setShowStatusModal(true)} className="flex items-center gap-2 bg-white text-slate-600 px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest border border-slate-200 hover:bg-slate-50 transition-all active:scale-95 whitespace-nowrap">
                            Update Status
                        </button>
                    )}
                    <button onClick={() => setShowFollowUpModal(true)} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap">
                        <FiCalendar /> Schedule Follow-up
                    </button>
                </div>
            </header>


            {/* Pipeline Visualizer */}
            <div className="card bg-white p-6 md:p-10 shadow-sm overflow-hidden relative">
                <div className="flex items-center justify-between relative min-w-[600px] md:min-w-0">
                    <div className="absolute left-0 right-0 h-1 bg-slate-100 top-1/2 -translate-y-1/2 z-0 rounded-full"></div>
                    <div 
                        className="absolute left-0 h-1 bg-primary top-1/2 -translate-y-1/2 z-0 transition-all duration-1000 rounded-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.4)]"
                        style={{ width: `${(Math.max(0, currentStageIndex) / (stages.length - 1)) * 100}%` }}
                    ></div>
                    {stages.map((stage, i) => {
                        const isActive = stages.indexOf(lead.status) >= i;
                        const isCurrent = lead.status === stage;
                        
                        return (
                            <div key={stage} className="relative z-10 flex flex-col items-center group">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-500 bg-white ${
                                    isActive ? 'border-primary scale-110 shadow-lg shadow-primary/20' : 'border-slate-100'
                                }`}>
                                    {isActive ? <FiCheckCircle className="text-primary text-sm" /> : <div className="w-2 h-2 rounded-full bg-slate-200" />}
                                </div>
                                <span className={`absolute top-12 text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap ${
                                    isActive ? 'text-primary' : 'text-slate-400'
                                }`}>
                                    {stage.replace('_', ' ')}
                                </span>
                            </div>
                        );
                    })}
                </div>
                {lead.status === 'LOST' && (
                    <div className="mt-16 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 animate-pulse">
                        <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center text-xl">
                            <FiXCircle />
                        </div>
                        <div>
                            <p className="text-xs font-black text-red-800 uppercase tracking-widest leading-none">Deal Lost</p>
                            <p className="text-[10px] text-red-600 font-medium mt-1 uppercase tracking-widest">Opportunity Closed</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Info Column */}
                <div className="space-y-6">
                    <div className="card shadow-sm">
                        <h3 className="font-medium text-slate-800 uppercase tracking-widest text-xs mb-4 pb-2 border-b border-slate-50 flex items-center gap-2">
                            <FiInfo className="text-blue-500" /> Basic Information
                        </h3>
                        <dl className="space-y-4">
                            {[
                                { label: 'Email', value: lead.email || 'N/A', icon: FiMail },
                                { label: 'Source', value: lead.source || 'Direct', icon: FiTrendingUp },
                                { label: 'Priority', value: lead.priority, icon: FiActivity, color: lead.priority === 'HIGH' ? 'text-red-500' : 'text-slate-600' },
                                { label: 'Assigned To', value: lead.assignedUser?.name || 'Unassigned', icon: FiUser },
                                { label: 'Last Follow-up', value: lead.lastFollowUpDate ? moment(lead.lastFollowUpDate).format('DD MMM YYYY') : 'Never', icon: FiClock },
                                { label: 'Last Outcome', value: lead.outcome || 'None', icon: FiTrendingUp },
                                { label: 'Created On', value: moment(lead.createdAt).format('DD MMM YYYY'), icon: FiCalendar }
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><item.icon /></div>
                                    <div>
                                        <dt className="text-[9px] font-medium text-slate-400 uppercase tracking-widest leading-none">{item.label}</dt>
                                        <dd className={`text-xs font-medium mt-0.5 ${item.color || 'text-slate-700'}`}>{item.value}</dd>
                                    </div>
                                </div>
                            ))}
                        </dl>
                    </div>

                    <div className="card shadow-sm border-emerald-100">
                        <h3 className="font-medium text-slate-800 uppercase tracking-widest text-xs mb-4 pb-2 border-b border-slate-50 flex items-center gap-2">
                            <FiShoppingCart className="text-emerald-500" /> Interest Details
                        </h3>
                        <div className="space-y-4">
                            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                <p className="text-[9px] font-medium text-emerald-600 uppercase tracking-widest">Interested Product</p>
                                <p className="text-sm font-medium text-slate-800">{lead.product?.name || 'Generic Inquiry'}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 rounded-xl">
                                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest leading-none">Budget</p>
                                    <p className="text-sm font-medium text-slate-600 mt-1">₹{lead.budget ? parseFloat(lead.budget).toLocaleString() : 'N/A'}</p>
                                </div>
                                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                    <p className="text-[9px] font-medium text-blue-600 uppercase tracking-widest leading-none">Negotiation</p>
                                    <p className="text-sm font-medium text-blue-800 mt-1">₹{lead.negotiationAmount ? parseFloat(lead.negotiationAmount).toLocaleString() : 'N/A'}</p>
                                </div>
                            </div>

                            {lead.source === 'Referral' && (
                                <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-[9px] font-medium text-purple-400 uppercase tracking-widest leading-none">Referred By</p>
                                            <p className="text-xs font-medium text-purple-800 mt-1">{lead.referredBy?.name || 'Unknown'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-medium text-purple-400 uppercase tracking-widest leading-none">Commission ({lead.commissionPercentage}%)</p>
                                            <p className="text-sm font-medium text-purple-600 mt-1">₹{parseFloat(lead.commissionAmount || 0).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-purple-100 flex justify-between items-center">
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-medium uppercase tracking-widest ${lead.commissionPaid ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-white'}`}>
                                            {lead.commissionPaid ? 'Commission Paid' : 'Payment Pending'}
                                        </span>
                                        {lead.status === 'WON' && (
                                            <button 
                                                onClick={toggleCommissionStatus}
                                                className="text-[9px] font-medium text-purple-600 hover:underline uppercase tracking-widest"
                                            >
                                                Mark as {lead.commissionPaid ? 'Unpaid' : 'Paid'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
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
                                className={`px-6 py-3 text-[10px] font-medium uppercase tracking-widest transition-all ${
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
                                                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{activity.type.replace('_', ' ')}</p>
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
                                <div className="card p-12 text-center text-slate-400 font-medium italic border-dashed border-2 border-slate-100">
                                    No follow-ups scheduled for this lead.
                                </div>
                            ) : (
                                lead.followUps.map(fu => (
                                    <div key={fu.id} className="card p-4 shadow-sm flex justify-between items-center bg-white hover:border-emerald-200 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-xl text-xs font-medium uppercase tracking-tighter ${
                                                moment(fu.date).isBefore(moment()) ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                                            }`}>
                                                {moment(fu.date).format('DD MMM')}
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-slate-800">{fu.notes || 'No description provided'}</p>
                                                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium mt-0.5">{fu.status}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {fu.status === 'PENDING' && (
                                                <button 
                                                    onClick={() => handleOpenOutcome(fu)}
                                                    className="p-1.5 text-slate-300 hover:text-emerald-500 transition-colors"
                                                    title="Take Action"
                                                >
                                                    <FiCheckCircle />
                                                </button>
                                            )}
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
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
                        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 leading-tight">Update Status</h3>
                                <p className="text-slate-400 text-xs mt-0.5">Select the current lead stage</p>
                            </div>
                            <button onClick={() => setShowStatusModal(false)} className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-all">
                                <FiXCircle size={20} />
                            </button>
                        </header>
                        
                        <div className="p-8 grid grid-cols-1 gap-3 overflow-y-auto">
                            {['NEW', 'CONTACTED', 'QUALIFIED', 'QUOTATION_SENT', 'NEGOTIATION', 'WON', 'LOST'].map(s => (
                                <button 
                                    key={s}
                                    onClick={() => handleStatusUpdate(s)}
                                    className={`p-4 rounded-xl text-xs font-bold uppercase tracking-widest text-center border-2 transition-all active:scale-95 ${
                                        lead.status === s 
                                        ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/10' 
                                        : 'bg-slate-50 border-transparent text-slate-500 hover:border-slate-200'
                                    }`}
                                >
                                    {s.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                        
                        <footer className="p-6 bg-slate-50 border-t border-slate-100">
                            <button onClick={() => setShowStatusModal(false)} className="w-full py-4 text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Cancel</button>
                        </footer>
                    </div>
                </div>
            )}

            {showFollowUpModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[95vh] flex flex-col">
                        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 leading-tight">Schedule Follow-up</h3>
                                <p className="text-slate-400 text-xs mt-0.5">Remind back to {lead.name}</p>
                            </div>
                            <button onClick={() => setShowFollowUpModal(false)} className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-all">
                                <FiXCircle size={20} />
                            </button>
                        </header>

                        <form onSubmit={handleScheduleFollowUp} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Date & Time</label>
                                <input required type="datetime-local" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold text-slate-800" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Notes / Objective</label>
                                <textarea className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-slate-800 min-h-[120px]" placeholder="e.g. Discuss bulk discount, Send catalogue..." value={followUpNotes} onChange={e => setFollowUpNotes(e.target.value)}></textarea>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowFollowUpModal(false)}
                                    className="flex-1 px-6 py-4 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all text-xs uppercase tracking-widest"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg text-xs uppercase tracking-widest"
                                >
                                    Schedule
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showConvertModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[95vh] flex flex-col">
                        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 leading-tight uppercase tracking-widest">Convert to {showConvertModal}</h3>
                                <p className="text-slate-400 text-xs mt-0.5">Transform lead into a formal record</p>
                            </div>
                            <button onClick={() => setShowConvertModal(null)} className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-all">
                                <FiXCircle size={20} />
                            </button>
                        </header>

                        <form onSubmit={handleConvert} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Select Branch</label>
                                <select required className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold text-slate-800 appearance-none" value={convertForm.branchId} onChange={e => setConvertForm({ ...convertForm, branchId: e.target.value })}>
                                    <option value="">Select Branch</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{showConvertModal} Number</label>
                                <input 
                                    required 
                                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold text-slate-800" 
                                    placeholder={showConvertModal === 'QUOTATION' ? 'QTN-001' : 'INV-001'}
                                    value={convertForm.number}
                                    onChange={e => setConvertForm({ ...convertForm, number: e.target.value })}
                                />
                            </div>
                            {showConvertModal === 'ORDER' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Payment Method</label>
                                    <select className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold text-slate-800 appearance-none" value={convertForm.paymentMethod} onChange={e => setConvertForm({ ...convertForm, paymentMethod: e.target.value })}>
                                        <option value="CASH">Cash</option>
                                        <option value="BANK_TRANSFER">Bank Transfer</option>
                                        <option value="UPI">UPI</option>
                                        <option value="CARD">Card</option>
                                    </select>
                                </div>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowConvertModal(null)}
                                    className="flex-1 px-6 py-4 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all text-xs uppercase tracking-widest"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg text-xs uppercase tracking-widest"
                                >
                                    Confirm
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showOutcomeModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[95vh] flex flex-col">
                        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 leading-tight">Record Outcome</h3>
                                <p className="text-slate-400 text-xs mt-0.5">Updating follow-up for {lead.name}</p>
                            </div>
                            <button onClick={() => setShowOutcomeModal(false)} className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-all">
                                <FiXCircle size={20} />
                            </button>
                        </header>

                        <form onSubmit={handleSubmitOutcome} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Action Outcome</label>
                                <select 
                                    required 
                                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold text-slate-800 appearance-none" 
                                    value={outcomeForm.outcome} 
                                    onChange={e => setOutcomeForm({ ...outcomeForm, outcome: e.target.value })}
                                >
                                    <option value="No Response">No Response</option>
                                    <option value="Interested">Interested</option>
                                    <option value="Not Interested">Not Interested</option>
                                    <option value="Call Later">Call Later</option>
                                    <option value="Quotation Sent">Quotation Sent</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Internal Notes</label>
                                <textarea 
                                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-slate-800 min-h-[100px]" 
                                    placeholder="What happened during this follow-up?"
                                    value={outcomeForm.notes}
                                    onChange={e => setOutcomeForm({ ...outcomeForm, notes: e.target.value })}
                                />
                            </div>

                            {outcomeForm.outcome !== 'Not Interested' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex justify-between items-center">
                                        Next Follow-up Date
                                        <span className="text-primary text-[8px] bg-primary-light/10 px-2 py-0.5 rounded-full tracking-wider">REQUIRED</span>
                                    </label>
                                    <input 
                                        required 
                                        type="datetime-local" 
                                        className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold text-slate-800" 
                                        value={outcomeForm.nextFollowUpDate} 
                                        onChange={e => setOutcomeForm({ ...outcomeForm, nextFollowUpDate: e.target.value })} 
                                    />
                                </div>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowOutcomeModal(false)}
                                    className="flex-1 px-6 py-4 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all text-xs uppercase tracking-widest"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg text-xs uppercase tracking-widest"
                                >
                                    Update
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showEditModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[95vh] flex flex-col">
                        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 leading-tight">Edit Lead Profile</h3>
                                <p className="text-slate-400 text-xs mt-0.5">Update core information and details</p>
                            </div>
                            <button onClick={() => setShowEditModal(false)} className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-all">
                                <FiXCircle size={20} />
                            </button>
                        </header>

                        <div className="p-8 overflow-y-auto custom-scrollbar">
                            <form onSubmit={handleEditSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Customer Name</label>
                                        <input required name="name" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold text-slate-800" value={editForm.name} onChange={handleEditChange} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Lead Source</label>
                                        <select name="source" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold text-slate-800 appearance-none" value={editForm.source} onChange={handleEditChange}>
                                            <option value="Walk-in">Walk-in</option>
                                            <option value="Website">Website</option>
                                            <option value="Call">Phone Call</option>
                                            <option value="WhatsApp">WhatsApp</option>
                                            <option value="Social Media">Social Media</option>
                                            <option value="Referral">Referral</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Interested Product</label>
                                        <select name="productId" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold text-slate-800 appearance-none" value={editForm.productId} onChange={handleEditChange}>
                                            <option value="">Select Product</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Quantity</label>
                                            <input type="number" name="quantity" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold text-slate-800" value={editForm.quantity} onChange={handleEditChange} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-emerald-500 uppercase tracking-widest mb-3">Budget (₹)</label>
                                            <input type="number" name="budget" className="w-full bg-emerald-50/20 border border-emerald-100 p-4 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold text-emerald-600" value={editForm.budget} onChange={handleEditChange} />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-blue-500 uppercase tracking-widest mb-3">Negotiation Amt (₹)</label>
                                        <input type="number" name="negotiationAmount" className="w-full bg-blue-50/20 border border-blue-100 p-4 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-bold text-blue-600" value={editForm.negotiationAmount} onChange={handleEditChange} />
                                    </div>

                                    {editForm.source && /referral|refferal/i.test(editForm.source) && (
                                        <div className="p-6 bg-purple-50 rounded-2xl border border-purple-100 space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-2">Referred By</label>
                                                <select name="referredById" className="w-full bg-white border border-purple-100 p-3 rounded-xl focus:ring-2 focus:ring-purple-500/20 outline-none font-bold text-purple-800" value={editForm.referredById} onChange={handleEditChange}>
                                                    <option value="">Select Employee</option>
                                                    {users.filter(u => !editForm.branchId || u.branchId === editForm.branchId).map(u => (
                                                        <option key={u.id} value={u.id}>{u.name || u.username}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex-1">
                                                    <label className="block text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-2">Comm %</label>
                                                    <input type="number" name="commissionPercentage" className="w-full bg-white border border-purple-100 p-3 rounded-xl focus:ring-2 focus:ring-purple-500/20 outline-none font-bold text-purple-600" value={editForm.commissionPercentage} onChange={handleEditChange} />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">Est. Amount</label>
                                                    <p className="text-lg font-black text-purple-600">₹{(parseFloat(editForm.negotiationAmount || 0) * parseFloat(editForm.commissionPercentage || 0) / 100).toFixed(2)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Internal Notes</label>
                                        <textarea name="notes" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-slate-800 min-h-[150px]" value={editForm.notes} onChange={handleEditChange} placeholder="Add detailed lead notes..."></textarea>
                                    </div>
                                </div>
                            </form>
                        </div>

                        <footer className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 px-6 py-4 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-all text-xs uppercase tracking-widest">Cancel</button>
                            <button type="button" onClick={handleEditSubmit} className="flex-1 px-6 py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg text-xs uppercase tracking-widest">Save Changes</button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
}

