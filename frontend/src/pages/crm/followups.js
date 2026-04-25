import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { 
    FiCalendar, FiClock, FiCheckCircle, FiPhone, FiUser, 
    FiArrowRight, FiAlertCircle, FiMessageSquare, FiTrendingUp,
    FiX, FiHash, FiMoreVertical
} from 'react-icons/fi';
import Link from 'next/link';
import moment from 'moment';

export default function LeadFollowups() {
    const [sections, setSections] = useState({ overdue: [], today: [], upcoming: [] });
    const [loading, setLoading] = useState(true);
    const [selectedFollowUp, setSelectedFollowUp] = useState(null);
    const [showOutcomeModal, setShowOutcomeModal] = useState(false);
    const [outcomeForm, setOutcomeForm] = useState({ outcome: 'No Response', notes: '', nextFollowUpDate: '' });

    useEffect(() => {
        fetchFollowUps();
    }, []);

    const fetchFollowUps = async () => {
        try {
            const res = await api.get('/crm/followups');
            setSections(res.data);
        } catch (err) {
            toast.error("Failed to fetch follow-ups");
        } finally {
            setLoading(false);
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
            fetchFollowUps();
        } catch (err) {
            toast.error("Failed to update follow-up");
        }
    };

    const handleWhatsApp = (phone) => {
        if (!phone) return toast.error("Phone number missing");
        window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
    };

    const handleCall = (phone) => {
        if (!phone) return toast.error("Phone number missing");
        window.location.href = `tel:${phone}`;
    };

    if (loading) return <div className="p-12 text-center text-slate-400 font-medium animate-pulse uppercase tracking-widest">Loading Follow-ups...</div>;

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-semibold text-slate-800 tracking-tight">Follow-up Dashboard</h1>
                    <p className="text-slate-500 font-medium">Manage your active leads and scheduled tasks</p>
                </div>
                <div className="flex gap-4">
                    <div className="text-right">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none">Total Pending</p>
                        <p className="text-2xl font-semibold text-primary">
                            {sections.overdue.length + sections.today.length + sections.upcoming.length}
                        </p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Overdue */}
                <Section 
                    title="Overdue Follow-ups" 
                    icon={<FiAlertCircle />} 
                    color="red" 
                    items={sections.overdue} 
                    onAction={handleOpenOutcome} 
                    onCall={handleCall}
                    onWhatsApp={handleWhatsApp}
                />
                
                {/* Today */}
                <Section 
                    title="Today's Schedule" 
                    icon={<FiCalendar />} 
                    color="amber" 
                    items={sections.today} 
                    onAction={handleOpenOutcome} 
                    onCall={handleCall}
                    onWhatsApp={handleWhatsApp}
                />
                
                {/* Upcoming */}
                <Section 
                    title="Upcoming" 
                    icon={<FiClock />} 
                    color="emerald" 
                    items={sections.upcoming} 
                    onAction={handleOpenOutcome} 
                    onCall={handleCall}
                    onWhatsApp={handleWhatsApp}
                />
            </div>

            {/* Outcome Modal */}
            {showOutcomeModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <form onSubmit={handleSubmitOutcome} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-8 space-y-6 animate-in zoom-in duration-300">
                        <header className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-semibold text-slate-800 tracking-tight">Record Outcome</h3>
                                <p className="text-xs text-slate-400 font-medium mt-1">Updating follow-up for {selectedFollowUp.lead.name}</p>
                            </div>
                            <button type="button" onClick={() => setShowOutcomeModal(false)} className="p-2 hover:bg-slate-50 rounded-full"><FiX /></button>
                        </header>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-medium text-slate-400 uppercase mb-2 tracking-widest">Action Outcome</label>
                                <select 
                                    required 
                                    className="input" 
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
                                <label className="block text-[10px] font-medium text-slate-400 uppercase mb-2 tracking-widest">Internal Notes</label>
                                <textarea 
                                    className="input min-h-[80px]" 
                                    placeholder="What happened during this follow-up?"
                                    value={outcomeForm.notes}
                                    onChange={e => setOutcomeForm({ ...outcomeForm, notes: e.target.value })}
                                />
                            </div>

                            {/* Next Follow-up required unless Not Interested */}
                            {outcomeForm.outcome !== 'Not Interested' && (
                                <div>
                                    <label className="block text-[10px] font-medium text-slate-400 uppercase mb-2 tracking-widest flex justify-between items-center">
                                        Next Follow-up Date
                                        <span className="text-primary text-[8px]">REQUIRED</span>
                                    </label>
                                    <input 
                                        required 
                                        type="datetime-local" 
                                        className="input" 
                                        value={outcomeForm.nextFollowUpDate} 
                                        onChange={e => setOutcomeForm({ ...outcomeForm, nextFollowUpDate: e.target.value })} 
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button type="button" onClick={() => setShowOutcomeModal(false)} className="btn btn-secondary flex-1 font-medium text-xs uppercase tracking-widest">Cancel</button>
                            <button type="submit" className="btn btn-primary flex-1 font-medium text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20">Update & Schedule</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

function Section({ title, icon, color, items, onAction, onCall, onWhatsApp }) {
    const colors = {
        red: 'bg-red-50 text-red-600 border-red-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100'
    };

    return (
        <div className="flex flex-col space-y-4">
            <div className={`p-3 rounded-2xl border flex items-center gap-3 ${colors[color]}`}>
                <div className="text-xl">{icon}</div>
                <h2 className="text-xs font-semibold uppercase tracking-widest">{title} <span className="ml-2 bg-white/50 px-2 py-0.5 rounded-full">{items.length}</span></h2>
            </div>
            
            <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-250px)] pr-2 scrollbar-thin">
                {items.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-slate-100 p-8 rounded-3xl text-center text-slate-300 font-medium italic text-sm">
                        No tasks found
                    </div>
                ) : (
                    items.map(fu => (
                        <div key={fu.id} className={`bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group border-l-4 ${
                            color === 'red' ? 'border-l-red-400' : color === 'amber' ? 'border-l-amber-400' : 'border-l-emerald-400'
                        }`}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-medium text-slate-800 text-sm tracking-tight">{fu.lead.name}</h3>
                                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <FiTrendingUp size={10} className="text-primary" /> {fu.lead.status.replace('_', ' ')}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest leading-none">Follow-up At</p>
                                    <p className="text-xs font-medium text-slate-700 mt-1">{moment(fu.date).format('DD MMM, hh:mm a')}</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-3 mb-4">
                                <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mb-1 leading-none">Interested In</p>
                                <p className="text-xs font-medium text-slate-600 tracking-tight">{fu.lead.product?.name || 'Inquiry'}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => onCall(fu.lead.phone)}
                                    className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 text-xs font-medium"
                                >
                                    <FiPhone /> Call
                                </button>
                                <button 
                                    onClick={() => onWhatsApp(fu.lead.phone)}
                                    className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2 text-xs font-medium"
                                >
                                    <FiMessageSquare /> WhatsApp
                                </button>
                            </div>
                            
                            <div className="mt-2 flex gap-2">
                                <Link 
                                    href={`/crm/leads/${fu.leadId}`}
                                    className="flex-1 p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 text-xs font-medium"
                                >
                                    Details <FiArrowRight />
                                </Link>
                                <button 
                                    onClick={() => onAction(fu)}
                                    className="flex-1 p-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2 text-xs font-medium"
                                >
                                    <FiCheckCircle /> Mark Done
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
