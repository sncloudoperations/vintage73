import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { FiPlus, FiDollarSign, FiCheck, FiX, FiCheckCircle } from 'react-icons/fi';

export default function SalaryAdvance() {
    const [advances, setAdvances] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [companyProfile, setCompanyProfile] = useState(null);
    const [formData, setFormData] = useState({
        amount: '',
        reason: ''
    });

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        fetchAdvances();
        fetchCompanyProfile();
    }, []);

    const fetchAdvances = async () => {
        try {
            const res = await api.get('/hrms/salary-advance');
            setAdvances(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load advances');
        } finally {
            setLoading(false);
        }
    };

    const fetchCompanyProfile = async () => {
        try {
            const res = await api.get('/company');
            setCompanyProfile(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hrms/salary-advance', formData);
            toast.success('Salary advance request submitted successfully');
            setIsModalOpen(false);
            setFormData({ amount: '', reason: '' });
            fetchAdvances();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to submit request');
        }
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            await api.put(`/hrms/salary-advance/${id}/status`, { status });
            toast.success(`Request ${status.toLowerCase()} successfully`);
            fetchAdvances();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update status');
        }
    };

    const getStatusBadge = (advance) => {
        if (advance.deductedInPayroll) {
            return (
                <span className="px-3 py-1 rounded-full text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
                    DEDUCTED
                </span>
            );
        }
        
        const styles = {
            PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
            APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            REJECTED: 'bg-red-50 text-red-700 border-red-200'
        };
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${styles[advance.status] || styles.PENDING}`}>
                {advance.status}
            </span>
        );
    };

    const isAdmin = user?.role === 'admin';
    const currencySymbol = companyProfile?.currencySymbol || '₹';

    // Calculate pending approved advances total
    const pendingTotal = advances
        .filter(a => a.status === 'APPROVED' && !a.deductedInPayroll)
        .reduce((sum, a) => sum + parseFloat(a.amount), 0);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FiDollarSign className="text-emerald-600" />
                        Salary Advance
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Request and manage salary advances</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-black transition-all shadow-sm hover:shadow-lg"
                >
                    <FiPlus /> Request Advance
                </button>
            </header>

            {/* Pending Advances Alert */}
            {!isAdmin && pendingTotal > 0 && (
                <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <FiCheckCircle className="text-amber-600 mt-0.5 flex-shrink-0" size={20} />
                        <div>
                            <p className="text-sm font-bold text-amber-900">Pending Deduction</p>
                            <p className="text-xs text-amber-700 mt-1">
                                You have {currencySymbol}{pendingTotal.toFixed(2)} in approved advances that will be deducted from your next salary.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="px-6 py-4 text-left">Employee</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                                <th className="px-6 py-4 text-left">Reason</th>
                                <th className="px-6 py-4 text-left">Request Date</th>
                                <th className="px-6 py-4 text-left">Status</th>
                                <th className="px-6 py-4 text-left">Approved By</th>
                                <th className="px-6 py-4 text-left">Deducted In</th>
                                {isAdmin && <th className="px-6 py-4 text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={isAdmin ? "8" : "7"} className="p-8 text-center text-slate-400">Loading...</td></tr>
                            ) : advances.length === 0 ? (
                                <tr><td colSpan={isAdmin ? "8" : "7"} className="p-8 text-center text-slate-400">No advance requests found</td></tr>
                            ) : (
                                advances.map(adv => (
                                    <tr key={adv.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800">{adv.user?.name}</div>
                                            <div className="text-xs text-slate-400">@{adv.user?.username}</div>
                                            {adv.user?.employeeProfile?.basicSalary && (
                                                <div className="text-xs text-slate-500 mt-0.5">
                                                    Salary: {currencySymbol}{parseFloat(adv.user.employeeProfile.basicSalary).toFixed(2)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="font-bold text-emerald-600 text-base">
                                                {currencySymbol}{parseFloat(adv.amount).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                                            {adv.reason}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {new Date(adv.requestDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(adv)}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {adv.approver ? (
                                                <div>
                                                    <div className="font-medium">{adv.approver.name}</div>
                                                    <div className="text-xs text-slate-400">
                                                        {adv.approvedAt ? new Date(adv.approvedAt).toLocaleDateString() : ''}
                                                    </div>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {adv.payroll ? (
                                                <div>
                                                    <div className="font-medium">{adv.payroll.month} {adv.payroll.year}</div>
                                                    <div className="text-xs text-slate-400">
                                                        Net: {currencySymbol}{parseFloat(adv.payroll.netSalary).toFixed(2)}
                                                    </div>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        {isAdmin && (
                                            <td className="px-6 py-4 text-right">
                                                {adv.status === 'PENDING' && (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleStatusUpdate(adv.id, 'APPROVED')}
                                                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                            title="Approve"
                                                        >
                                                            <FiCheck size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleStatusUpdate(adv.id, 'REJECTED')}
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-slate-800">Request Salary Advance</h2>
                            <p className="text-sm text-slate-500 mt-1">Submit a request for salary advance</p>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Amount ({currencySymbol})
                                </label>
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    className="input w-full bg-slate-50 border-transparent focus:bg-white transition-all font-bold text-lg"
                                    value={formData.amount}
                                    onChange={e => setFormData({...formData, amount: e.target.value})}
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Reason
                                </label>
                                <textarea
                                    required
                                    rows="4"
                                    className="input w-full bg-slate-50 border-transparent focus:bg-white transition-all resize-none"
                                    value={formData.reason}
                                    onChange={e => setFormData({...formData, reason: e.target.value})}
                                    placeholder="Explain why you need the advance..."
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all"
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
