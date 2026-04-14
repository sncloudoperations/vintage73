import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiPlus, FiCheckCircle, FiCircle, FiCalendar, FiUser, FiLink } from 'react-icons/fi';

export default function CRMTasks() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [leads, setLeads] = useState([]);
    const [deals, setDeals] = useState([]);
    const [users, setUsers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ title: '', dueDate: '', priority: 'MEDIUM', description: '', leadId: '', dealId: '', assignedTo: '', status: 'PENDING' });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchTasks();
        fetchLeads();
        fetchDeals();
        fetchUsers();
    }, []);

    const fetchTasks = async () => {
        try {
            const res = await api.get('/crm/tasks');
            setTasks(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const fetchLeads = async () => {
        try {
            const res = await api.get('/crm/leads');
            setLeads(res.data);
        } catch (err) { console.error(err); }
    }

    const fetchDeals = async () => {
        try {
            const res = await api.get('/crm/deals');
            setDeals(res.data);
        } catch (err) { console.error(err); }
    }

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (err) { console.error(err); }
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/crm/tasks/${editingId}`, form);
                toast.success("Task updated");
            } else {
                await api.post('/crm/tasks', form);
                toast.success("Task created");
            }
            setShowModal(false);
            setEditingId(null);
            setForm({ title: '', dueDate: '', priority: 'MEDIUM', description: '', leadId: '', dealId: '', assignedTo: '', status: 'PENDING' });
            fetchTasks();
        } catch (err) {
            toast.error("Failed to save task");
        }
    };

    const handleEdit = (task) => {
        setForm({
            title: task.title,
            dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
            priority: task.priority,
            description: task.description || '',
            leadId: task.leadId || '',
            dealId: task.dealId || '',
            assignedTo: task.assignedTo || '',
            status: task.status
        });
        setEditingId(task.id);
        setShowModal(true);
    };

    const toggleStatus = async (task) => {
        try {
            const newStatus = task.status === 'PENDING' ? 'COMPLETED' : 'PENDING';
            await api.put(`/crm/tasks/${task.id}`, { status: newStatus });
            toast.success(`Task marked as ${newStatus.toLowerCase()}`);
            fetchTasks();
        } catch (err) {
            toast.error("Failed to update status");
        }
    };

    const priorityColors = {
        'HIGH': 'text-red-600 bg-red-50 border-red-200',
        'MEDIUM': 'text-amber-600 bg-amber-50 border-amber-200',
        'LOW': 'text-primary bg-primary-light/10 border-primary/20'
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Tasks</h1>
                    <p className="text-slate-500 mt-1 font-medium">Manage your activities</p>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setForm({ title: '', dueDate: '', priority: 'MEDIUM', description: '', leadId: '', dealId: '', assignedTo: '', status: 'PENDING' });
                        setShowModal(true);
                    }}
                    className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl font-medium hover:bg-slate-800 transition shadow-lg shadow-slate-900/20"
                >
                    <FiPlus /> Add Task
                </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {tasks.map(task => (
                    <div key={task.id} className={`p-4 hover:bg-slate-50 transition-colors flex items-start gap-4 group ${task.status === 'COMPLETED' ? 'bg-slate-50/50' : ''}`}>
                        <button
                            onClick={() => toggleStatus(task)}
                            className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${task.status === 'COMPLETED'
                                ? 'bg-primary border-primary text-white'
                                : 'border-slate-300 text-transparent hover:border-primary'
                                }`}
                        >
                            <FiCheckCircle className="text-sm" />
                        </button>

                        <div className="flex-1 cursor-pointer" onClick={() => handleEdit(task)}>
                            <div className="flex justify-between items-start">
                                <h3 className={`font-semibold text-slate-800 ${task.status === 'COMPLETED' ? 'line-through text-slate-400' : ''}`}>{task.title}</h3>
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded border uppercase tracking-wider ${priorityColors[task.priority]}`}>
                                    {task.priority}
                                </span>
                            </div>

                            {task.description && <p className="text-sm text-slate-500 mt-1 line-clamp-1">{task.description}</p>}

                            <div className="flex gap-4 mt-3">
                                {task.dueDate && (
                                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED' ? 'text-red-500' : 'text-slate-400'}`}>
                                        <FiCalendar /> {new Date(task.dueDate).toLocaleDateString()}
                                    </div>
                                )}

                                {(task.lead || task.deal) && (
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                        <FiLink />
                                        {task.lead ? `Lead: ${task.lead.name}` : `Deal: ${task.deal.title}`}
                                    </div>
                                )}

                                {task.assignedUser && (
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 ml-auto">
                                        <FiUser /> {task.assignedUser.name}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {tasks.length === 0 && !loading && (
                    <div className="p-12 text-center text-slate-400">No tasks found.</div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Task' : 'New Task'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-medium">Close</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Task Title</label>
                                <input required className="input w-full bg-slate-50 border-transparent focus:bg-white" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Call Client" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Due Date</label>
                                    <input type="date" className="input w-full bg-slate-50 border-transparent focus:bg-white" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Priority</label>
                                    <select className="input w-full bg-slate-50 border-transparent focus:bg-white" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Related To</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <select className="input w-full bg-slate-50 border-transparent focus:bg-white" value={form.leadId} onChange={e => setForm({ ...form, leadId: e.target.value, dealId: '' })}>
                                        <option value="">Select Lead</option>
                                        {leads.map(l => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                    <select className="input w-full bg-slate-50 border-transparent focus:bg-white" value={form.dealId} onChange={e => setForm({ ...form, dealId: e.target.value, leadId: '' })}>
                                        <option value="">Select Deal</option>
                                        {deals.map(d => (
                                            <option key={d.id} value={d.id}>{d.title}</option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">*Select either a Lead OR a Deal</p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Assigned To</label>
                                <select className="input w-full bg-slate-50 border-transparent focus:bg-white" value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })}>
                                    <option value="">Unassigned</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name || u.username}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase mb-1">Description</label>
                                <textarea className="input w-full bg-slate-50 border-transparent focus:bg-white h-20" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}></textarea>
                            </div>

                            <button type="submit" className="w-full bg-primary text-white py-3 rounded-xl font-medium hover:bg-primary-dark transition">
                                {editingId ? 'Update Task' : 'Create Task'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
