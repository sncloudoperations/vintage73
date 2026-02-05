import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';

export default function LeavesPage() {
    const [activeTab, setActiveTab] = useState('my-leaves');
    const [user, setUser] = useState(null);

    useEffect(() => {
        const u = JSON.parse(localStorage.getItem('user'));
        setUser(u);
    }, []);

    const isAdmin = user?.role === 'admin';

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Leaves Management</h1>
                {isAdmin && (
                    <div className="flex bg-slate-100 rounded-lg p-1">
                        <button
                            onClick={() => setActiveTab('my-leaves')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'my-leaves' ? 'bg-white shadow text-primary' : 'text-slate-500'}`}
                        >
                            My Leaves
                        </button>
                        <button
                            onClick={() => setActiveTab('manage')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'manage' ? 'bg-white shadow text-primary' : 'text-slate-500'}`}
                        >
                            Approve Requests
                        </button>
                    </div>
                )}
            </header>

            {activeTab === 'my-leaves' ? <MyLeaves user={user} /> : <ManageLeaves />}
        </div>
    );
}

function MyLeaves({ user }) {
    const [leaves, setLeaves] = useState([]);
    const [leaveTypes, setLeaveTypes] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ startDate: '', endDate: '', reason: '', leaveTypeId: '', isHalfDay: false });

    useEffect(() => {
        if (user) {
            fetchLeaves();
            fetchLeaveTypes();
        }
    }, [user]);

    const fetchLeaves = async () => {
        try {
            const res = await api.get(`/hrms/leaves?userId=${user.id}`);
            setLeaves(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchLeaveTypes = async () => {
        try {
            const res = await api.get('/hrms/leave-types');
            setLeaveTypes(res.data);
        } catch (err) { console.error(err); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = { ...formData, userId: user.id };
            if (data.isHalfDay) {
                // Should we force end date = start date? Let's just pass it as is, backend handles it or we trust user.
                // Better UX: if half day, we can default end to start.
                if (data.startDate !== data.endDate) {
                    // toast.error("Half day leave should be for a single date");
                    // return;
                }
            }
            await api.post('/hrms/leaves/apply', data);
            toast.success("Leave Applied Successfully");
            setShowForm(false);
            setFormData({ startDate: '', endDate: '', reason: '', leaveTypeId: '', isHalfDay: false });
            fetchLeaves();
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to apply");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-dark transition"
                >
                    {showForm ? 'Cancel' : 'Apply for Leave'}
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 max-w-lg mx-auto">
                    <h3 className="text-lg font-bold mb-4">New Leave Request</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Leave Type</label>
                            <select required className="p-2 border rounded w-full"
                                value={formData.leaveTypeId} onChange={e => setFormData({ ...formData, leaveTypeId: e.target.value })}
                            >
                                <option value="">Select Type</option>
                                {leaveTypes.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} ({t.isPaid ? 'Paid' : 'Unpaid'} - Limit: {t.monthlyLimit || '∞'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    id="halfDay"
                                    className="sr-only peer"
                                    checked={formData.isHalfDay}
                                    onChange={e => setFormData({ ...formData, isHalfDay: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm peer-checked:bg-primary"></div>
                                <span className="ml-3 text-sm font-medium text-slate-700">Half Day</span>
                            </label>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                                <input required type="date" className="p-2 border rounded w-full"
                                    value={formData.startDate} onChange={e => {
                                        setFormData(prev => ({
                                            ...prev,
                                            startDate: e.target.value,
                                            endDate: prev.isHalfDay ? e.target.value : prev.endDate
                                        }))
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                                <input required type="date" className="p-2 border rounded w-full"
                                    value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                    disabled={formData.isHalfDay}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                            <textarea required className="p-2 border rounded w-full" rows="3"
                                value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })}
                            ></textarea>
                        </div>
                        <button type="submit" className="w-full bg-primary text-white py-2 rounded font-bold">Submit Request</button>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-3">Type</th>
                            <th className="px-6 py-3">Dates</th>
                            <th className="px-6 py-3">Reason</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Applied On</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {leaves.map(l => (
                            <tr key={l.id}>
                                <td className="px-6 py-3 font-medium text-slate-800">
                                    {l.leaveType ? l.leaveType.name : 'Other'}
                                    {l.isHalfDay && <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded font-bold uppercase">Half Day</span>}
                                    {l.leaveType && <span className="text-xs text-slate-400 block">{l.leaveType.isPaid ? 'Paid' : 'Unpaid'}</span>}
                                </td>
                                <td className="px-6 py-3 text-slate-700">
                                    {new Date(l.startDate).toLocaleDateString()}
                                    {!l.isHalfDay && l.startDate !== l.endDate && ` - ${new Date(l.endDate).toLocaleDateString()}`}
                                </td>
                                <td className="px-6 py-3 text-slate-600">{l.reason}</td>
                                <td className="px-6 py-3">
                                    <StatusBadge status={l.status} />
                                </td>
                                <td className="px-6 py-3 text-slate-400 text-xs">
                                    {new Date(l.createdAt).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                        {leaves.length === 0 && <tr><td colSpan="5" className="p-4 text-center">No leaves found</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ManageLeaves() {
    const [leaves, setLeaves] = useState([]);

    useEffect(() => {
        fetchLeaves();
    }, []);

    const fetchLeaves = async () => {
        try {
            const res = await api.get(`/hrms/leaves`); // gets all
            setLeaves(res.data);
        } catch (err) { console.error(err); }
    };

    const updateStatus = async (id, status) => {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            await api.put(`/hrms/leaves/${id}/status`, { status, approvedById: user.id });
            toast.success(`Request ${status}`);
            fetchLeaves();
        } catch (err) {
            toast.error("Failed to update");
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-3">Employee</th>
                            <th className="px-6 py-3">Type</th>
                            <th className="px-6 py-3">Dates</th>
                            <th className="px-6 py-3">Reason</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {leaves.map(l => (
                            <tr key={l.id}>
                                <td className="px-6 py-3 font-medium text-slate-800">
                                    {l.user?.name || l.user?.username}
                                </td>
                                <td className="px-6 py-3">
                                    {l.leaveType ? (
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${l.leaveType.isPaid ? 'bg-primary-light/10 text-primary border-primary-light/20' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                            {l.leaveType.name}
                                        </span>
                                    ) : <span className="text-slate-400 text-xs">Other</span>}
                                    {l.isHalfDay && <div className="mt-1"><span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 text-[10px] rounded font-bold uppercase">Half Day</span></div>}
                                </td>
                                <td className="px-6 py-3 text-slate-700">
                                    {new Date(l.startDate).toLocaleDateString()}
                                    {!l.isHalfDay && l.startDate !== l.endDate && ` - ${new Date(l.endDate).toLocaleDateString()}`}
                                </td>
                                <td className="px-6 py-3 text-slate-600">{l.reason}</td>
                                <td className="px-6 py-3">
                                    <StatusBadge status={l.status} />
                                </td>
                                <td className="px-6 py-3 space-x-2">
                                    {l.status === 'PENDING' && (
                                        <>
                                            <button onClick={() => updateStatus(l.id, 'APPROVED')} className="text-primary hover:text-primary-dark font-bold text-xs uppercase">Approve</button>
                                            <button onClick={() => updateStatus(l.id, 'REJECTED')} className="text-red-600 hover:text-red-700 font-bold text-xs uppercase">Reject</button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function StatusBadge({ status }) {
    const colors = {
        'PENDING': 'bg-amber-100 text-amber-700',
        'APPROVED': 'bg-primary-light/10 text-primary',
        'REJECTED': 'bg-red-100 text-red-700'
    };
    return (
        <span className={`px-2 py-1 rounded text-xs font-bold ${colors[status] || 'bg-gray-100'}`}>
            {status}
        </span>
    );
}
