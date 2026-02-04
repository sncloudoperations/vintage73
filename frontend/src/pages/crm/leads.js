import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { FiPlus, FiTrash2, FiEdit2, FiPhone, FiMail, FiBriefcase } from 'react-icons/fi';

export default function Leads() {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', source: '', status: 'NEW', notes: '' });
    const [editingId, setEditingId] = useState(null);
    const [users, setUsers] = useState([]);

    useEffect(() => {
        fetchLeads();
        fetchUsers();
    }, []);

    const fetchLeads = async () => {
        try {
            const res = await api.get('/crm/leads');
            setLeads(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch(err) { console.error(err); }
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/crm/leads/${editingId}`, form);
                toast.success("Lead updated");
            } else {
                await api.post('/crm/leads', form);
                toast.success("Lead created");
            }
            setShowModal(false);
            setEditingId(null);
            setForm({ name: '', company: '', email: '', phone: '', source: '', status: 'NEW', notes: '' });
            fetchLeads();
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed");
        }
    };

    const handleEdit = (lead) => {
        setForm(lead);
        setEditingId(lead.id);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#10B981', // emerald-600
            cancelButtonColor: '#EF4444', // red-500
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await api.delete(`/crm/leads/${id}`);
                toast.success("Lead deleted");
                fetchLeads();
            } catch (err) {
                toast.error("Failed to delete");
            }
        }
    };

    const statusColors = {
        'NEW': 'bg-blue-100 text-blue-800',
        'CONTACTED': 'bg-amber-100 text-amber-800',
        'QUALIFIED': 'bg-emerald-100 text-emerald-800',
        'LOST': 'bg-red-100 text-red-800'
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
             <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Leads</h1>
                    <p className="text-slate-500 mt-1 font-medium">Manage potential clients</p>
                </div>
                <button 
                    onClick={() => {
                        setEditingId(null);
                        setForm({ name: '', company: '', email: '', phone: '', source: '', status: 'NEW', notes: '' });
                        setShowModal(true);
                    }}
                    className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-900/20"
                >
                    <FiPlus /> Add Lead
                </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-xs">
                        <tr>
                            <th className="px-6 py-5">Name / Company</th>
                            <th className="px-6 py-5">Contact</th>
                            <th className="px-6 py-5">Status</th>
                            <th className="px-6 py-5">Owner</th>
                            <th className="px-6 py-5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {leads.map(lead => (
                            <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors group">
                                <td className="px-6 py-4">
                                    <p className="font-bold text-slate-800 text-base">{lead.name}</p>
                                    {lead.company && (
                                        <div className="flex items-center gap-1.5 text-slate-500 mt-1 text-xs font-semibold">
                                            <FiBriefcase /> {lead.company}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        {lead.email && <div className="flex items-center gap-2 text-slate-600"><FiMail className="text-slate-400"/> {lead.email}</div>}
                                        {lead.phone && <div className="flex items-center gap-2 text-slate-600"><FiPhone className="text-slate-400"/> {lead.phone}</div>}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusColors[lead.status] || 'bg-slate-100 text-slate-600'}`}>
                                        {lead.status}
                                    </span>
                                    {lead.source && <div className="text-[10px] text-slate-400 mt-1 font-mono uppercase">via {lead.source}</div>}
                                </td>
                                <td className="px-6 py-4">
                                    {lead.assignedUser ? (
                                         <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold border border-emerald-200">
                                                {lead.assignedUser.name?.[0] || 'U'}
                                            </div>
                                            <span className="text-slate-700 font-medium text-xs">{lead.assignedUser.name}</span>
                                         </div>
                                    ) : <span className="text-slate-400 italic text-xs">Unassigned</span>}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEdit(lead)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><FiEdit2 /></button>
                                        <button onClick={() => handleDelete(lead.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><FiTrash2 /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {leads.length === 0 && !loading && (
                            <tr><td colSpan="5" className="p-12 text-center text-slate-400">No leads found. Create one to get started.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-800">{editingId ? 'Edit Lead' : 'New Lead'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">Close</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Name</label>
                                    <input required className="input w-full bg-slate-50 border-transparent focus:bg-white" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Full Names" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Company</label>
                                    <input className="input w-full bg-slate-50 border-transparent focus:bg-white" value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="Org Name" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label>
                                    <input type="email" className="input w-full bg-slate-50 border-transparent focus:bg-white" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="alex@example.com" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Phone</label>
                                    <input className="input w-full bg-slate-50 border-transparent focus:bg-white" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+91..." />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Source</label>
                                    <select className="input w-full bg-slate-50 border-transparent focus:bg-white" value={form.source} onChange={e => setForm({...form, source: e.target.value})}>
                                        <option value="">Select Source</option>
                                        <option value="Website">Website</option>
                                        <option value="Referral">Referral</option>
                                        <option value="Cold Call">Cold Call</option>
                                        <option value="Ads">Ads</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Status</label>
                                    <select className="input w-full bg-slate-50 border-transparent focus:bg-white" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                                        <option value="NEW">New</option>
                                        <option value="CONTACTED">Contacted</option>
                                        <option value="QUALIFIED">Qualified</option>
                                        <option value="LOST">Lost</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Assigned To</label>
                                <select className="input w-full bg-slate-50 border-transparent focus:bg-white" value={form.assignedTo || ''} onChange={e => setForm({...form, assignedTo: e.target.value})}>
                                    <option value="">Unassigned</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name || u.username}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Notes</label>
                                <textarea className="input w-full bg-slate-50 border-transparent focus:bg-white h-20" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}></textarea>
                            </div>

                            <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition">
                                {editingId ? 'Update Lead' : 'Create Lead'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
