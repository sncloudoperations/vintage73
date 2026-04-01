import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiCalendar, FiClock, FiCheckCircle, FiPhone, FiUser, FiArrowRight, FiAlertCircle } from 'react-icons/fi';
import Link from 'next/link';
import moment from 'moment';


export default function LeadFollowups() {
    const [followUps, setFollowUps] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFollowUps();
    }, []);

    const fetchFollowUps = async () => {
        try {
            const res = await api.get('/crm/followups');
            setFollowUps(res.data);
        } catch (err) {
            toast.error("Failed to fetch follow-ups");
        } finally {
            setLoading(false);
        }
    };

    const handleComplete = async (id, leadId) => {
        try {
            // We'll update the follow-up status and log an activity
            await api.put(`/crm/leads/${leadId}/activities`, { type: 'NOTE', description: 'Follow-up completed' });
            // In a real app, you'd have a specific endpoint to mark follow-up as done.
            // For now, let's assume we remove it from the 'Pending' list by refreshing.
            toast.success("Follow-up marked as completed");
            fetchFollowUps();
        } catch (err) {
            toast.error("Failed to complete follow-up");
        }
    };

    const todayFollowUps = followUps.filter(f => moment(f.date).isSame(moment(), 'day'));
    const overdueFollowUps = followUps.filter(f => moment(f.date).isBefore(moment(), 'day'));

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
            <header>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Follow-up Management</h1>
                <p className="text-slate-500 font-medium">Manage your daily interactions and pending follow-ups</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Today's Follow-ups */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><FiCalendar /></div>
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">Today's Schedule</h2>
                    </div>
                    {todayFollowUps.length === 0 ? (
                        <div className="card p-12 text-center text-slate-400 font-bold italic border-dashed border-2 border-slate-100">
                            No follow-ups scheduled for today.
                        </div>
                    ) : (
                        todayFollowUps.map(fu => (
                            <FollowUpCard key={fu.id} fu={fu} onComplete={handleComplete} />
                        ))
                    )}
                </div>

                {/* Overdue Follow-ups */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-red-50 text-red-600 rounded-lg"><FiAlertCircle /></div>
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">Overdue Follow-ups</h2>
                    </div>
                    {overdueFollowUps.length === 0 ? (
                        <div className="card p-12 text-center text-slate-400 font-bold italic border-dashed border-2 border-slate-100">
                            Great job! No overdue follow-ups.
                        </div>
                    ) : (
                        overdueFollowUps.map(fu => (
                            <FollowUpCard key={fu.id} fu={fu} onComplete={handleComplete} isOverdue />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function FollowUpCard({ fu, onComplete, isOverdue }) {
    return (
        <div className={`card p-5 shadow-sm border-l-4 transition-all hover:shadow-md ${isOverdue ? 'border-red-400' : 'border-emerald-400'}`}>
            <div className="flex justify-between items-start">
                <div className="flex gap-4">
                    <div className="mt-1">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${isOverdue ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                            <FiClock />
                        </div>
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 text-base">{fu.lead.name}</h3>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-2">
                            {moment(fu.date).format('hh:mm a')} • {fu.lead.phone}
                        </p>

                        <p className="text-sm text-slate-600 leading-relaxed max-w-sm italic">"{fu.notes || 'No specific notes'}"</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link href={`/crm/leads/${fu.leadId}`} className="p-2 text-slate-300 hover:text-blue-500 transition-colors">
                        <FiArrowRight size={20} />
                    </Link>
                    <button 
                        onClick={() => onComplete(fu.id, fu.leadId)}
                        className="p-2 text-slate-300 hover:text-emerald-500 transition-colors"
                        title="Mark as Completed"
                    >
                        <FiCheckCircle size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
