import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { FiPlus, FiMoreHorizontal, FiDollarSign, FiCalendar, FiUser, FiArrowRight } from 'react-icons/fi';

const STAGES = {
    'PROSPECTING': { label: 'Prospecting', color: 'bg-blue-50/50 border-blue-200 text-blue-700', bar: 'bg-blue-500' },
    'NEGOTIATION': { label: 'Negotiation', color: 'bg-amber-50/50 border-amber-200 text-amber-700', bar: 'bg-amber-500' },
    'WON': { label: 'Won', color: 'bg-primary-light/10 border-primary/20 text-primary', bar: 'bg-primary' },
    'LOST': { label: 'Lost', color: 'bg-red-50/50 border-red-200 text-red-700', bar: 'bg-red-500' }
};

export default function Deals() {
    const [deals, setDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [leads, setLeads] = useState([]);
    const [users, setUsers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ title: '', value: '', stage: 'PROSPECTING', leadId: '', assignedTo: '', probability: 50 });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchDeals();
        fetchLeads();
        fetchUsers();
    }, []);

    const fetchDeals = async () => {
        try {
            const res = await api.get('/crm/deals');
            setDeals(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const fetchLeads = async () => {
        try { const res = await api.get('/crm/leads'); setLeads(res.data); } catch (err) { console.error(err); }
    }

    const fetchUsers = async () => {
        try { const res = await api.get('/users'); setUsers(res.data); } catch (err) { console.error(err); }
    }

    const onDragEnd = async (result) => {
        if (!result.destination) return;
        const { source, destination, draggableId } = result;

        if (source.droppableId !== destination.droppableId) {
            // Optimistic Update
            const updatedDeals = deals.map(d =>
                d.id.toString() === draggableId ? { ...d, stage: destination.droppableId } : d
            );
            setDeals(updatedDeals);

            // API Call
            try {
                await api.put(`/crm/deals/${draggableId}`, { stage: destination.droppableId });
                toast.success(`Moved to ${STAGES[destination.droppableId].label}`, { icon: '🚀' });
            } catch (err) {
                toast.error("Failed to move deal");
                fetchDeals(); // Revert on fail
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/crm/deals/${editingId}`, form);
                toast.success("Deal updated");
            } else {
                await api.post('/crm/deals', form);
                toast.success("Deal created");
            }
            setShowModal(false);
            fetchDeals();
        } catch (err) { toast.error("Failed to save deal"); }
    };

    const handleEdit = (deal) => {
        setForm({
            title: deal.title,
            value: deal.value,
            stage: deal.stage,
            leadId: deal.leadId || '',
            assignedTo: deal.assignedTo || '',
            probability: deal.probability
        });
        setEditingId(deal.id);
        setShowModal(true);
    };

    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumSignificantDigits: 3 }).format(val);

    return (
        <div className="p-8 h-[calc(100vh-64px)] overflow-hidden flex flex-col bg-slate-50/50">
            <div className="flex justify-between items-center mb-8 flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Pipeline</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                        <p className="text-slate-500 font-medium text-sm">Real-time Opportunity Tracking</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setForm({ title: '', value: '', stage: 'PROSPECTING', leadId: '', assignedTo: '', probability: 50 });
                        setShowModal(true);
                    }}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-medium hover:bg-slate-800 transition shadow-xl shadow-slate-900/10 active:scale-95"
                >
                    <FiPlus className="text-lg" /> <span className="text-sm">New Deal</span>
                </button>
            </div>

            {/* Kanban Board */}
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 scrollbar-hide">
                    <div className="flex gap-6 h-full min-w-max px-1">
                        {Object.entries(STAGES).map(([stageKey, config]) => {
                            const stageDeals = deals.filter(d => d.stage === stageKey);
                            const stageValue = stageDeals.reduce((sum, d) => sum + Number(d.value), 0);

                            return (
                                <div key={stageKey} className="w-80 flex flex-col h-full rounded-3xl bg-slate-100/50 border border-slate-200/60 flex-shrink-0 backdrop-blur-sm">
                                    {/* Header */}
                                    <div className="p-4 rounded-t-3xl bg-white/40 border-b border-slate-200/50 backdrop-blur-md sticky top-0 z-10">
                                        <div className={`h-1 w-8 rounded-full mb-3 ${config.bar}`}></div>
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <h3 className="font-medium text-sm uppercase tracking-wider text-slate-700">{config.label}</h3>
                                                <p className="text-xs text-slate-400 font-semibold mt-0.5">{stageDeals.length} Deals</p>
                                            </div>
                                            <div className="text-sm font-medium text-slate-800 bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm">
                                                {formatCurrency(stageValue)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Droppable Area */}
                                    <Droppable droppableId={stageKey}>
                                        {(provided, snapshot) => (
                                            <div
                                                {...provided.droppableProps}
                                                ref={provided.innerRef}
                                                className={`flex-1 overflow-y-auto p-3 space-y-3 transition-colors ${snapshot.isDraggingOver ? 'bg-slate-100/80' : ''}`}
                                            >
                                                {stageDeals.map((deal, index) => (
                                                    <Draggable key={deal.id} draggableId={deal.id.toString()} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                onClick={() => handleEdit(deal)}
                                                                style={{ ...provided.draggableProps.style }}
                                                                className={`bg-white p-4 rounded-2xl border border-slate-100 cursor-grab active:cursor-grabbing group hover:border-primary/30 transition-all ${snapshot.isDragging ? 'shadow-2xl rotate-2 scale-105 z-50 ring-2 ring-primary/20' : 'shadow-sm hover:shadow-md'}`}
                                                            >
                                                                {/* Card Content */}
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div className={`text-[10px] font-medium px-2 py-0.5 rounded-md uppercase tracking-wider ${config.color}`}>
                                                                        {config.label}
                                                                    </div>
                                                                    <FiMoreHorizontal className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                                                                </div>

                                                                <h4 className="font-semibold text-slate-800 mb-1 leading-snug">{deal.title}</h4>
                                                                <p className="text-slate-500 font-medium text-sm mb-4">{formatCurrency(deal.value)}</p>

                                                                {/* Probability Bar */}
                                                                <div className="w-full h-1.5 bg-slate-100 rounded-full mb-4 overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full ${deal.probability > 75 ? 'bg-primary' : deal.probability > 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                                        style={{ width: `${deal.probability}%` }}
                                                                    ></div>
                                                                </div>

                                                                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                                                    {deal.assignedUser ? (
                                                                        <div className="flex items-center gap-1.5 ring-2 ring-white rounded-full bg-slate-50 pr-2">
                                                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-[10px] flex items-center justify-center font-medium text-white shadow-sm">
                                                                                {deal.assignedUser.name[0]}
                                                                            </div>
                                                                            <span className="text-[10px] font-medium text-slate-600">{deal.assignedUser.name.split(' ')[0]}</span>
                                                                        </div>
                                                                    ) : <span className="text-[10px] text-slate-400 italic">Unassigned</span>}

                                                                    <span className="text-[10px] font-semibold text-slate-400">
                                                                        {new Date(deal.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </DragDropContext>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Deal' : 'New Deal'}</h2>
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 font-medium transition-colors">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5 ml-1">Deal Title</label>
                                <input required className="input w-full bg-slate-50 border-slate-200 focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all font-semibold" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Website Redesign" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5 ml-1">Value</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                                        <input type="number" required className="input w-full bg-slate-50 border-slate-200 focus:bg-white pl-8 font-medium text-primary" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="0.00" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5 ml-1">Stage</label>
                                    <select className="input w-full bg-slate-50 border-slate-200 focus:bg-white font-medium" value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })}>
                                        {Object.entries(STAGES).map(([key, config]) => (
                                            <option key={key} value={key}>{config.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5 ml-1">Related Lead</label>
                                <select className="input w-full bg-slate-50 border-slate-200 focus:bg-white font-medium" value={form.leadId} onChange={e => setForm({ ...form, leadId: e.target.value })}>
                                    <option value="">Select Lead</option>
                                    {leads.map(l => (
                                        <option key={l.id} value={l.id}>{l.name} ({l.company || 'No Company'})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase mb-1.5 ml-1">Assigned To</label>
                                <select className="input w-full bg-slate-50 border-slate-200 focus:bg-white font-medium" value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })}>
                                    <option value="">Unassigned</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name || u.username}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1.5 ml-1">
                                    <label className="block text-xs font-medium text-slate-400 uppercase">Probability</label>
                                    <span className="text-xs font-medium text-primary bg-primary-light/10 px-2 py-0.5 rounded-full">{form.probability}%</span>
                                </div>
                                <input type="range" min="0" max="100" step="10" className="w-full accent-primary h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer" value={form.probability} onChange={e => setForm({ ...form, probability: e.target.value })} />
                            </div>

                            <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-medium hover:bg-slate-800 transition shadow-lg shadow-slate-900/20 active:scale-[0.98]">
                                {editingId ? 'Update Deal' : 'Create Deal'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
