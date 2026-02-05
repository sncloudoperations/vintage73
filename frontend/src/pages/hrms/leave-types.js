import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiTrash2, FiPlus, FiX } from 'react-icons/fi';

export default function LeaveTypes() {
    const [types, setTypes] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingType, setEditingType] = useState(null);
    const [form, setForm] = useState({ name: '', isPaid: true, monthlyLimit: 0, color: '#3B82F6' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTypes();
    }, []);

    const fetchTypes = async () => {
        try {
            const res = await api.get('/hrms/leave-types');
            setTypes(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingType) {
                await api.put(`/hrms/leave-types/${editingType.id}`, form);
                toast.success("Leave Type Updated");
            } else {
                await api.post('/hrms/leave-types', form);
                toast.success("Leave Type Created");
            }
            closeModal();
            fetchTypes();
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to save");
        }
    };

    const handleEdit = (type) => {
        setEditingType(type);
        setForm({
            name: type.name,
            isPaid: type.isPaid,
            monthlyLimit: type.monthlyLimit,
            color: type.color || '#3B82F6'
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingType(null);
        setForm({ name: '', isPaid: true, monthlyLimit: 0, color: '#3B82F6' });
    };

    const handleDelete = async (id) => {
        if(!confirm("Are you sure?")) return;
        try {
            await api.delete(`/hrms/leave-types/${id}`);
            toast.success("Deleted");
            fetchTypes();
        } catch(err) { toast.error("Failed to delete"); }
    };

    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Leave Types Master</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage leave categories and limits</p>
                </div>
                <button 
                    onClick={() => {
                        setEditingType(null);
                        setForm({ name: '', isPaid: true, monthlyLimit: 0, color: '#3B82F6' });
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-emerald-700 transition shadow-sm"
                >
                    <FiPlus /> Add New Type
                </button>
            </div>

            {/* List Table */}
            <div className="card shadow-md border border-slate-200">
                <div className="table-container">
                    <table className="table-modern">
                        <thead>
                            <tr>
                                <th style={{ width: '40%' }}>Name</th>
                                <th style={{ width: '20%' }}>Payment Status</th>
                                <th style={{ width: '20%' }}>Monthly Limit</th>
                                <th className="text-right" style={{ width: '20%' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {types.map(t => (
                                <tr key={t.id}>
                                    <td className="font-medium text-slate-800">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full border border-slate-200" style={{ backgroundColor: t.color || '#3B82F6' }}></div>
                                            {t.name}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${t.isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                                            {t.isPaid ? 'Paid' : 'Unpaid'}
                                        </span>
                                    </td>
                                    <td className="text-slate-600">
                                        {t.monthlyLimit === 0 ? (
                                            <span className="text-slate-400 italic text-xs">Unlimited</span>
                                        ) : (
                                            <span className="font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-700 text-xs">{t.monthlyLimit} days</span>
                                        )}
                                    </td>
                                    <td className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => handleEdit(t)} 
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="Edit"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(t.id)} 
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <FiTrash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                             {types.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="text-center py-8 text-slate-400">
                                        <p>No leave types found.</p>
                                        <button onClick={() => setIsModalOpen(true)} className="text-emerald-600 hover:underline mt-2 font-semibold">Create one</button>
                                    </td>
                                </tr>
                             )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <header className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800">{editingType ? 'Edit Leave Type' : 'Add Leave Type'}</h3>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <FiX size={20} />
                            </button>
                        </header>
                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Type Name</label>
                                <input 
                                    required 
                                    autoFocus
                                    className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all" 
                                    placeholder="e.g. Casual Leave"
                                    value={form.name} 
                                    onChange={e => setForm({...form, name: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Monthly Limit <span className="font-normal text-slate-400">(days)</span></label>
                                <input 
                                    type="number" 
                                    className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all" 
                                    min="0"
                                    placeholder="0 for unlimited"
                                    value={form.monthlyLimit} 
                                    onChange={e => setForm({...form, monthlyLimit: e.target.value})}
                                />
                                <p className="text-xs text-slate-500 mt-1">Set to 0 for unlimited leaves per month.</p>
                            </div>

                            <div className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg bg-slate-50">
                                <input 
                                    type="checkbox" 
                                    id="isPaid" 
                                    className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300"
                                    checked={form.isPaid} 
                                    onChange={e => setForm({...form, isPaid: e.target.checked})}
                                />
                                <label htmlFor="isPaid" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                                    Is this a Paid Leave?
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Color Label</label>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="color" 
                                        className="h-10 w-20 rounded cursor-pointer border border-slate-300 p-1"
                                        value={form.color || '#3B82F6'}
                                        onChange={e => setForm({...form, color: e.target.value})}
                                    />
                                    <span className="text-sm text-slate-500 font-mono">{form.color || '#3B82F6'}</span>
                                </div>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button 
                                    type="button" 
                                    onClick={closeModal}
                                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                                >
                                    {editingType ? 'Update Type' : 'Create Type'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
