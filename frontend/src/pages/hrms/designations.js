import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiTrash2, FiPlus, FiX, FiBriefcase } from 'react-icons/fi';

export default function Designations() {
    const [designations, setDesignations] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState({ name: '' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDesignations();
    }, []);

    const fetchDesignations = async () => {
        try {
            const res = await api.get('/hrms/designations');
            setDesignations(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load designations');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hrms/designations', form);
            toast.success("Designation Created");
            setForm({ name: '' });
            setIsModalOpen(false);
            fetchDesignations();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to create");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this designation?")) return;
        try {
            await api.delete(`/hrms/designations/${id}`);
            toast.success("Deleted");
            fetchDesignations();
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to delete");
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FiBriefcase className="text-primary" />
                        Designations Master
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Manage employee designations and job titles</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg font-bold hover:bg-primary-dark transition shadow-sm"
                >
                    <FiPlus /> Add New Designation
                </button>
            </div>

            {/* List Table */}
            <div className="card shadow-md border border-slate-200">
                <div className="table-container">
                    <table className="table-modern">
                        <thead>
                            <tr>
                                <th style={{ width: '10%' }}>#</th>
                                <th style={{ width: '40%' }}>Designation Name</th>
                                <th style={{ width: '30%' }}>Employees</th>
                                <th className="text-right" style={{ width: '20%' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {designations.map((d, idx) => (
                                <tr key={d.id}>
                                    <td className="text-slate-500">
                                        {idx + 1}
                                    </td>
                                    <td className="font-semibold text-slate-800">
                                        {d.name}
                                    </td>
                                    <td className="text-slate-600">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                            {d._count?.employees || 0} employees
                                        </span>
                                    </td>
                                    <td className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleDelete(d.id)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <FiTrash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {designations.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="text-center py-8 text-slate-400">
                                        <p>No designations found.</p>
                                        <button onClick={() => setIsModalOpen(true)} className="text-primary hover:underline mt-2 font-semibold">Create one</button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <header className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800">Add Designation</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <FiX size={20} />
                            </button>
                        </header>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Designation Name</label>
                                <input
                                    required
                                    autoFocus
                                    className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                    placeholder="e.g. Sales Manager"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                />
                                <p className="text-xs text-slate-500 mt-1">Enter a unique designation name for employees.</p>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark transition-colors shadow-sm"
                                >
                                    Create Designation
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
