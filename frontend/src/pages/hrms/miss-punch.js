import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiPlus, FiClock, FiCheck, FiX, FiCalendar } from 'react-icons/fi';

export default function MissPunchRequests() {
    const [requests, setRequests] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [formData, setFormData] = useState({
        date: '',
        checkInTime: '',
        checkOutTime: '',
        reason: ''
    });

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const res = await api.get('/hrms/miss-punch');
            setRequests(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load requests');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // 3-Day Rule Validation
        const requestDate = new Date(formData.date);
        requestDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffInMs = today.getTime() - requestDate.getTime();
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        if (diffInDays > 3) {
            toast.error('Miss Punch request cannot be applied after 3 days from the missed date');
            return;
        }

        if (requestDate > today) {
            toast.error('Miss Punch cannot be applied for future dates');
            return;
        }

        try {
            await api.post('/hrms/miss-punch', formData);
            toast.success('Miss punch request submitted successfully');
            setIsModalOpen(false);
            setFormData({ date: '', checkInTime: '', checkOutTime: '', reason: '' });
            fetchRequests();
        } catch (err) {
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to submit request');
        }
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            await api.put(`/hrms/miss-punch/${id}/status`, { status });
            toast.success(`Request ${status.toLowerCase()} successfully`);
            fetchRequests();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update status');
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
            APPROVED: 'bg-primary-light/10 text-primary border-primary/20',
            REJECTED: 'bg-red-50 text-red-700 border-red-200'
        };
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.PENDING}`}>
                {status}
            </span>
        );
    };

    const isAdmin = user?.role === 'admin';

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
                        <FiClock className="text-primary" />
                        Miss Punch Requests
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Request attendance corrections for missed punches</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-slate-900 text-white px-6 py-3 rounded-xl font-medium text-sm flex items-center gap-2 hover:bg-black transition-all shadow-sm hover:shadow-lg"
                >
                    <FiPlus /> Request Miss Punch
                </button>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100 uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="px-6 py-4 text-left">Employee</th>
                                <th className="px-6 py-4 text-left">Date</th>
                                <th className="px-6 py-4 text-left">Check-In</th>
                                <th className="px-6 py-4 text-left">Check-Out</th>
                                <th className="px-6 py-4 text-left">Reason</th>
                                <th className="px-6 py-4 text-left">Status</th>
                                <th className="px-6 py-4 text-left">Reviewed By</th>
                                {isAdmin && <th className="px-6 py-4 text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={isAdmin ? "8" : "7"} className="p-8 text-center text-slate-400">Loading...</td></tr>
                            ) : requests.length === 0 ? (
                                <tr><td colSpan={isAdmin ? "8" : "7"} className="p-8 text-center text-slate-400">No requests found</td></tr>
                            ) : (
                                requests.map(req => (
                                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-800">{req.user?.name}</div>
                                            <div className="text-xs text-slate-400">@{req.user?.username}</div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-700">
                                            {new Date(req.date).toLocaleDateString('en-GB')}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {req.checkInTime || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {req.checkOutTime || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                                            {req.reason}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(req.status)}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {req.reviewer ? (
                                                <div>
                                                    <div className="font-medium">{req.reviewer.name}</div>
                                                    <div className="text-xs text-slate-400">
                                                        {req.reviewedAt ? new Date(req.reviewedAt).toLocaleDateString('en-GB') : ''}
                                                    </div>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        {isAdmin && (
                                            <td className="px-6 py-4 text-right">
                                                {req.status === 'PENDING' && (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleStatusUpdate(req.id, 'APPROVED')}
                                                            className="p-2 text-primary hover:bg-primary-light/10 rounded-lg transition-colors"
                                                            title="Approve"
                                                        >
                                                            <FiCheck size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleStatusUpdate(req.id, 'REJECTED')}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Reject"
                                                        >
                                                            <FiX size={18} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Request Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-100">
                            <h2 className="text-xl font-semibold text-slate-800">Request Miss Punch</h2>
                            <p className="text-sm text-slate-500 mt-1">Submit a request for missed attendance punch</p>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">
                                    Date
                                </label>
                                <input
                                    required
                                    type="date"
                                    className="input w-full bg-slate-50 border-transparent focus:bg-white transition-all mb-1"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                />
                                <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1.5 px-1 uppercase tracking-tighter">
                                    <FiCalendar size={12} /> Limit: Within 3 days from missed date
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">
                                        Check-In Time
                                    </label>
                                    <input
                                        type="time"
                                        className="input w-full bg-slate-50 border-transparent focus:bg-white transition-all"
                                        value={formData.checkInTime}
                                        onChange={e => setFormData({ ...formData, checkInTime: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">
                                        Check-Out Time
                                    </label>
                                    <input
                                        type="time"
                                        className="input w-full bg-slate-50 border-transparent focus:bg-white transition-all"
                                        value={formData.checkOutTime}
                                        onChange={e => setFormData({ ...formData, checkOutTime: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">
                                    Reason
                                </label>
                                <textarea
                                    required
                                    rows="3"
                                    className="input w-full bg-slate-50 border-transparent focus:bg-white transition-all resize-none"
                                    value={formData.reason}
                                    onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                    placeholder="Explain why you missed the punch..."
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-medium text-sm text-slate-600 hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl font-medium text-sm hover:bg-black transition-all"
                                >
                                    Submit Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
