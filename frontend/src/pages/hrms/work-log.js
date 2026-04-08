import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { FiPlus, FiSearch, FiCalendar, FiX, FiFileText, FiEdit2 } from 'react-icons/fi';
import { toast } from 'react-toastify';

export default function WorkLogPage() {
    const [user, setUser] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Search/filter state
    const [filterDate, setFilterDate] = useState('');
    const [filterKeyword, setFilterKeyword] = useState('');

    // Form state
    const [formData, setFormData] = useState({ date: '', description: '' });
    const [submitting, setSubmitting] = useState(false);
    const [editingLog, setEditingLog] = useState(null);

    useEffect(() => {
        const u = JSON.parse(localStorage.getItem('user'));
        setUser(u);
        fetchLogs(u);
    }, []);

    const fetchLogs = async (u) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            // Staff users only see their own logs
            if (u?.role !== 'admin') {
                params.append('userId', u.id);
            }
            const res = await api.get(`/hrms/work-logs?${params.toString()}`);
            setLogs(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load work logs');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.date || !formData.description.trim()) {
            toast.error('Please fill in all fields');
            return;
        }
        setSubmitting(true);
        try {
            if (editingLog) {
                const res = await api.put(`/hrms/work-logs/${editingLog.id}`, {
                    date: formData.date,
                    description: formData.description.trim()
                });
                setLogs(prev => prev.map(l => l.id === editingLog.id ? res.data : l));
                toast.success('Work log updated successfully');
            } else {
                const res = await api.post('/hrms/work-logs', {
                    userId: user.id,
                    date: formData.date,
                    description: formData.description.trim()
                });
                setLogs(prev => [res.data, ...prev]);
                toast.success('Work log added successfully');
            }
            setShowModal(false);
            setFormData({ date: '', description: '' });
            setEditingLog(null);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save work log');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (log) => {
        setEditingLog(log);
        setFormData({
            date: log.date.split('T')[0],
            description: log.description
        });
        setShowModal(true);
    };

    const openModal = () => {
        const today = new Date().toISOString().split('T')[0];
        setFormData({ date: today, description: '' });
        setEditingLog(null);
        setShowModal(true);
    };

    // Filtered logs
    const filteredLogs = logs.filter(log => {
        const matchDate = !filterDate || log.date.startsWith(filterDate);
        const matchKeyword = !filterKeyword || log.description.toLowerCase().includes(filterKeyword.toLowerCase());
        return matchDate && matchKeyword;
    });

    const isAdmin = user?.role === 'admin';

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Daily Work Log Report</h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        {isAdmin ? 'View work logs from your assigned staff' : 'Track your daily work activities'}
                    </p>
                </div>
                <button
                    onClick={openModal}
                    className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg font-medium hover:bg-primary-dark transition shadow-sm"
                >
                    <FiPlus /> Add Work Log
                </button>
            </header>

            {/* Search / Filter Bar */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by description..."
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        value={filterKeyword}
                        onChange={e => setFilterKeyword(e.target.value)}
                    />
                    {filterKeyword && (
                        <button onClick={() => setFilterKeyword('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <FiX size={14} />
                        </button>
                    )}
                </div>
                <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="date"
                        className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        value={filterDate}
                        onChange={e => setFilterDate(e.target.value)}
                    />
                    {filterDate && (
                        <button onClick={() => setFilterDate('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <FiX size={14} />
                        </button>
                    )}
                </div>
                <div className="flex items-center text-xs text-slate-400 font-medium bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                    {filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">Loading work logs...</div>
                ) : filteredLogs.length === 0 ? (
                    <div className="p-12 text-center">
                        <FiFileText className="mx-auto text-slate-300 mb-3" size={40} />
                        <p className="text-slate-400 font-medium">No work logs found</p>
                        <p className="text-slate-300 text-sm mt-1">
                            {filterDate || filterKeyword ? 'Try adjusting your filters' : 'Click "Add Work Log" to get started'}
                        </p>
                    </div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-3">Date</th>
                                {isAdmin && <th className="px-6 py-3">Employee</th>}
                                <th className="px-6 py-3">Description</th>
                                <th className="px-6 py-3">Added On</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredLogs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 bg-primary-light/10 text-primary px-2.5 py-1 rounded-full text-xs font-bold">
                                            <FiCalendar size={11} />
                                            {new Date(log.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                    </td>
                                    {isAdmin && (
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-800">{log.user?.name || '-'}</div>
                                            <div className="text-xs text-slate-400 font-mono">@{log.user?.username}</div>
                                        </td>
                                    )}
                                    <td className="px-6 py-4 text-slate-700 max-w-md">
                                        <p className="whitespace-pre-line">{log.description}</p>
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 text-xs">
                                        {new Date(log.createdAt).toLocaleDateString('en-GB')}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {(isAdmin || user?.id === log.userId) && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleEdit(log); }}
                                                className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                                title="Edit Log"
                                            >
                                                <FiEdit2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Add Work Log Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/40 rounded-t-2xl">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">{editingLog ? 'Edit Work Log' : 'Add Work Log'}</h2>
                                <p className="text-slate-400 text-xs mt-0.5">{editingLog ? 'Update your activity record' : 'Record your daily work activities'}</p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-all"
                            >
                                <FiX />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                                    Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    required
                                    type="date"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                                    Work Description <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    required
                                    rows={5}
                                    placeholder="Describe the work done today..."
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                                <p className="text-xs text-slate-400 mt-1">{formData.description.length} characters</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-lg font-medium hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 bg-primary text-white py-2.5 rounded-lg font-bold hover:bg-primary-dark transition disabled:opacity-60"
                                >
                                    {submitting ? 'Saving...' : editingLog ? 'Update Work Log' : 'Save Work Log'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
