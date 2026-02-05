import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiMessageCircle, FiEye, FiPhone } from 'react-icons/fi';

export default function CreditManagement() {
    const [debtors, setDebtors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [companyProfile, setCompanyProfile] = useState(null);
    const [stats, setStats] = useState({ totalCredit: 0, todayCredit: 0 });
    
    // Settlement State
    const [showSettleModal, setShowSettleModal] = useState(false);
    const [settleForm, setSettleForm] = useState({ amount: '', method: 'Cash', notes: '' });

    useEffect(() => {
        fetchDebtors();
    }, []);

    const fetchDebtors = async () => {
        try {
            const [credRes, compRes] = await Promise.all([
                api.get('/credits'),
                api.get('/company')
            ]);
            setDebtors(credRes.data);
            setCompanyProfile(compRes.data);
            
            // Calculate basic stats for display
            const total = credRes.data.reduce((acc, d) => acc + d.totalDebt, 0);
            setStats({ totalCredit: total, todayCredit: 0 }); // todayCredit can befetched if endpoint exists
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = async (id) => {
        try {
            const res = await api.get(`/credits/${id}`);
            setSelectedCustomer(res.data);
            setShowModal(true);
        } catch (err) {
            toast.error("Failed to fetch details");
        }
    };

    const sendWhatsApp = (phone, name, amount) => {
        if (!phone) {
            toast.error("Phone number not available");
            return;
        }
        // Remove non-digits
        const cleanPhone = phone.replace(/\D/g, '');
        // Default to country code or assume valid
        const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone; 

        const message = `Hello ${name}, your outstanding balance is ₹${amount}. Please pay at your earliest convenience. Thank you.`;
        const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

    const handleSettle = async (e) => {
        e.preventDefault();
        try {
            await api.post('/credits/settle', {
                customerId: selectedCustomer.id,
                amount: settleForm.amount,
                paymentMethod: settleForm.method,
                notes: settleForm.notes
            });
            toast.success("Payment Recorded & Settled");
            setShowSettleModal(false);
            setShowModal(false); // Close details too to refresh
            fetchDebtors(); // Refresh list
        } catch (err) {
            toast.error(err.response?.data?.error || "Settlement Failed");
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
             <div className="mb-8">
                <span className="text-3xl font-black text-slate-800 tracking-tight">{companyProfile?.currencySymbol || '₹'}{Number(stats.totalCredit).toFixed(0)}</span>
                <p className="text-slate-500 mt-1 font-medium">Track outstanding payments and send reminders</p>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-xs">
                        <tr>
                            <th className="px-6 py-5">Customer</th>
                            <th className="px-6 py-5">Phone</th>
                            <th className="px-6 py-5">Pending Invoices</th>
                            <th className="px-6 py-5">Total Debt</th>
                            <th className="px-6 py-5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {debtors.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-800">{c.name}</td>
                                <td className="px-6 py-4 text-slate-600 font-mono">{c.phone || '-'}</td>
                                <td className="px-6 py-4">
                                    <span className="bg-orange-100 text-orange-700 font-bold px-2 py-1 rounded-md text-xs">
                                        {c.pendingInvoices} Invoices
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-black text-red-600 text-base">{formatCurrency(c.totalDebt)}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button 
                                            onClick={() => handleViewDetails(c.id)}
                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                            title="View Details"
                                        >
                                            <FiEye size={18} />
                                        </button>
                                        <button 
                                            onClick={() => sendWhatsApp(c.phone, c.name, c.totalDebt)}
                                            className="flex items-center gap-2 bg-emerald-500 text-white px-3 py-2 rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200 text-xs"
                                        >
                                            <FiMessageCircle size={16} /> WhatsApp
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {debtors.length === 0 && !loading && (
                            <tr><td colSpan="5" className="p-12 text-center text-slate-400">No customers with outstanding credit.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Detail Modal */}
            {showModal && selectedCustomer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black text-slate-800">{selectedCustomer.name}</h2>
                                <p className="text-sm text-slate-500 font-bold">{selectedCustomer.phone}</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 font-bold transition">✕</button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Date</th>
                                        <th className="px-4 py-3 text-left">Invoice No</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                        <th className="px-4 py-3 text-right">Paid</th>
                                        <th className="px-4 py-3 text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {selectedCustomer.sales.map(sale => (
                                        <tr key={sale.id}>
                                            <td className="px-4 py-3 text-slate-600">{new Date(sale.saleDate).toLocaleDateString()}</td>
                                            <td className="px-4 py-3 font-bold text-slate-700">{sale.invoiceNumber}</td>
                                            <td className="px-4 py-3 text-right font-medium">₹{sale.totalAmount}</td>
                                            <td className="px-4 py-3 text-right text-emerald-600">₹{sale.paidAmount}</td>
                                            <td className="px-4 py-3 text-right font-bold text-red-600">₹{sale.balanceAmount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase">Total Outstanding</span>
                                <p className="text-2xl font-black text-slate-800">₹{selectedCustomer.totalDebt}</p>
                            </div>
                            <button 
                                onClick={() => sendWhatsApp(selectedCustomer.phone, selectedCustomer.name, selectedCustomer.totalDebt)}
                                className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 flex items-center gap-2 text-sm"
                            >
                                <FiMessageCircle /> WhatsApp
                            </button>
                            <button 
                                onClick={() => {
                                    setSettleForm({ amount: selectedCustomer.totalDebt, method: 'Cash', notes: '' });
                                    setShowSettleModal(true);
                                }}
                                className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-slate-800 shadow-lg text-sm"
                            >
                                Settle Payment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settlement Modal */}
            {showSettleModal && selectedCustomer && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-slate-800">Record Payment</h3>
                            <button onClick={() => setShowSettleModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                        </div>
                        <form onSubmit={handleSettle} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Received Amount</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                    <input 
                                        autoFocus
                                        type="number" 
                                        required
                                        className="input w-full pl-8 font-bold text-lg text-emerald-600" 
                                        value={settleForm.amount} 
                                        onChange={e => setSettleForm({...settleForm, amount: e.target.value})} 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Payment Method</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Cash', 'UPI', 'Bank'].map(m => (
                                        <button 
                                            key={m}
                                            type="button"
                                            onClick={() => setSettleForm({...settleForm, method: m})}
                                            className={`py-2 text-xs font-bold rounded border ${settleForm.method === m ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Notes</label>
                                <input className="input w-full" placeholder="Reference No. etc" value={settleForm.notes} onChange={e => setSettleForm({...settleForm, notes: e.target.value})} />
                            </div>
                            <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition">
                                Confirm Settlement
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
