import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiRefreshCw, FiSave, FiList, FiPlus, FiTrash2, FiEdit2, FiCalendar, FiPrinter } from 'react-icons/fi';
import ConfirmationModal from '@/components/ConfirmationModal';
import ProfessionalModal from '@/components/ProfessionalModal';
import VoucherPrint from '@/components/VoucherPrint';

export default function ContraEntry() {
    const [ledgers, setLedgers] = useState([]);
    const [activeTab, setActiveTab] = useState('create');
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        fromAccount: '',
        toAccount: '',
        amount: '',
        narration: '',
        reference: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // History State
    const [vouchers, setVouchers] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [editId, setEditId] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

    // Print State
    const [printVoucher, setPrintVoucher] = useState(null);

    useEffect(() => {
        fetchLedgers();
        fetchHistory();
    }, []);

    const fetchLedgers = async () => {
        try {
            const res = await api.get('/accounting/ledgers');
            setLedgers(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load ledgers');
        }
    };

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await api.get('/accounting/vouchers?voucherType=CONTRA');
            setVouchers(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load voucher history');
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (formData.fromAccount === formData.toAccount) {
            return toast.error('From and To accounts cannot be the same');
        }
        setIsSaveModalOpen(true);
    };

    const confirmSave = async () => {
        setIsSaveModalOpen(false);
        setIsSubmitting(true);
        try {
            let res;
            if (editId) {
                res = await api.put(`/accounting/vouchers/${editId}`, {
                    ...formData,
                    voucherType: 'CONTRA'
                });
                toast.success('Contra entry updated successfully!');
            } else {
                res = await api.post('/accounting/vouchers/contra', formData);
                toast.success(`Contra entry ${res.data.voucherNumber} created successfully!`);
            }

            const savedVoucher = res.data;
            if (window.confirm('Entry saved. Do you want to print the voucher?')) {
                const fullVoucher = await api.get(`/accounting/vouchers/${savedVoucher.id}`);
                setPrintVoucher(fullVoucher.data);
            }

            resetForm();
            setActiveTab('history');
            fetchHistory();
            fetchLedgers();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save contra entry');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            date: new Date().toISOString().split('T')[0],
            fromAccount: '',
            toAccount: '',
            amount: '',
            narration: '',
            reference: ''
        });
        setEditId(null);
    };

    const handleEdit = (v) => {
        setEditId(v.id);
        const debitEntry = v.entries.find(e => e.debitLedgerId);
        const creditEntry = v.entries.find(e => e.creditLedgerId);
        
        setFormData({
            date: new Date(v.date).toISOString().split('T')[0],
            fromAccount: creditEntry?.creditLedgerId || '',
            toAccount: debitEntry?.debitLedgerId || '',
            amount: v.totalAmount,
            narration: v.narration || '',
            reference: v.reference || ''
        });
        setActiveTab('create');
    };

    const handleDeleteClick = (id) => {
        setDeleteId(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        try {
            await api.delete(`/accounting/vouchers/${deleteId}`);
            toast.success('Voucher deleted successfully');
            fetchHistory();
        } catch (err) {
            toast.error('Failed to delete voucher');
        } finally {
            setIsDeleteModalOpen(false);
        }
    };

    const handlePrint = (v) => {
        setPrintVoucher(v);
    };

    // Filter cash and bank ledgers
    const cashBankLedgers = ledgers.filter(l => 
        (l.group?.name === 'Bank Accounts' || l.group?.name === 'Cash-in-Hand' || l.group?.name === 'Current Assets') && 
        (l.name.toLowerCase().includes('cash') || l.name.toLowerCase().includes('bank') || l.name.toLowerCase().includes('paytm') || l.name.toLowerCase().includes('upi'))
    );

    const selectedFromAccount = ledgers.find(l => l.id == formData.fromAccount);
    const selectedToAccount = ledgers.find(l => l.id == formData.toAccount);

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 animate-in fade-in duration-500">
            {printVoucher && (
                <VoucherPrint 
                    voucher={printVoucher} 
                    onClose={() => setPrintVoucher(null)} 
                />
            )}

            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shadow-md">
                            <FiRefreshCw className="text-white" size={20} />
                        </div>
                        Contra Entry
                    </h1>
                    <p className="text-slate-500 text-xs font-medium mt-1 uppercase tracking-wider">Transfer between cash and bank accounts</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-lg w-fit shadow-inner">
                    <button
                        onClick={() => { setActiveTab('create'); if(!editId) resetForm(); }}
                        className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'create' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <FiPlus /> {editId ? 'EDIT ENTRY' : 'NEW ENTRY'}
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        <FiList /> HISTORY
                    </button>
                </div>
            </header>

            {activeTab === 'create' ? (
                <div className="space-y-4">
                    <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                        {/* Status / Header Bar */}
                        <div className={`px-6 py-2 flex justify-between items-center ${editId ? 'bg-blue-600' : 'bg-emerald-900'} transition-colors`}>
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Type:</span>
                                <span className="text-xs font-bold text-white uppercase tracking-wider">
                                    {editId ? 'AMENDMENT MODE' : 'INTERNAL BANK/CASH CONTRA'}
                                </span>
                            </div>
                            {editId && (
                                <button onClick={resetForm} className="text-[10px] font-bold text-white uppercase tracking-wider hover:underline flex items-center gap-1">
                                    <FiX size={14} /> Cancel Editing
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Voucher Date</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none group-focus-within:text-emerald-600 transition-colors">
                                            <FiCalendar size={18} className="text-slate-400 group-focus-within:text-emerald-500" />
                                        </div>
                                        <input
                                            required
                                            type="date"
                                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-semibold transition-all"
                                            value={formData.date}
                                            onChange={e => setFormData({...formData, date: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Reference No. (Optional)</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-semibold transition-all font-mono"
                                        value={formData.reference}
                                        onChange={e => setFormData({...formData, reference: e.target.value})}
                                        placeholder="EX: BK-1002, IMPS, etc."
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-blue-600">Transfer Amount (₹)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-blue-400">₹</span>
                                        <input
                                            required
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            className="w-full pl-8 pr-4 py-3 bg-blue-50/30 border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent focus:bg-white text-lg font-bold text-blue-600 tabular-nums transition-all"
                                            value={formData.amount}
                                            onChange={e => setFormData({...formData, amount: e.target.value})}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
                                <div className="flex-1 w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            Transfer From (Credit)
                                        </label>
                                        {selectedFromAccount && (
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${selectedFromAccount.currentBalance >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                <span className="text-[10px] font-bold text-slate-500">
                                                    Bal: ₹{Math.abs(selectedFromAccount.currentBalance).toFixed(2)} {selectedFromAccount.currentBalance >= 0 ? 'Dr' : 'Cr'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <select
                                        required
                                        className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent rounded-lg text-sm font-semibold p-3 transition-all outline-none"
                                        value={formData.fromAccount}
                                        onChange={e => setFormData({...formData, fromAccount: e.target.value})}
                                    >
                                        <option value="">Select Source Account...</option>
                                        {cashBankLedgers.map(ledger => (
                                            <option key={ledger.id} value={ledger.id}>
                                                {ledger.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-2 italic">Funds will be deducted from this ledger.</p>
                                </div>

                                <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 -mx-5 z-10 text-blue-500">
                                    <FiRefreshCw size={18} />
                                </div>

                                <div className="flex-1 w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            Transfer To (Debit)
                                        </label>
                                        {selectedToAccount && (
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${selectedToAccount.currentBalance >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                <span className="text-[10px] font-bold text-slate-500">
                                                    Bal: ₹{Math.abs(selectedToAccount.currentBalance).toFixed(2)} {selectedToAccount.currentBalance >= 0 ? 'Dr' : 'Cr'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <select
                                        required
                                        className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent rounded-lg text-sm font-semibold p-3 transition-all outline-none"
                                        value={formData.toAccount}
                                        onChange={e => setFormData({...formData, toAccount: e.target.value})}
                                    >
                                        <option value="">Select Destination Account...</option>
                                        {cashBankLedgers.map(ledger => (
                                            <option key={ledger.id} value={ledger.id}>
                                                {ledger.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-2 italic">Funds will be added to this ledger.</p>
                                </div>
                            </div>

                            <div className="mb-8">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Detailed Narration</label>
                                <textarea
                                    required
                                    rows="2"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:bg-white text-sm font-semibold text-slate-800 transition-all resize-none italic"
                                    value={formData.narration}
                                    onChange={e => setFormData({...formData, narration: e.target.value})}
                                    placeholder="E.g. Cash deposited in bank, internal fund transfer, etc..."
                                />
                            </div>

                            <div className="flex items-center gap-4 pt-6 border-t border-slate-100">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 bg-slate-900 text-white py-3.5 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-800 shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <FiSave size={16} />
                                    {isSubmitting ? 'PROCESSING...' : (editId ? 'UPDATE ENTRY' : 'POST CONTRA ENTRY')}
                                </button>
                                {editId && (
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="px-8 py-3.5 rounded-lg font-bold text-xs uppercase tracking-widest border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all"
                                    >
                                        CANCEL
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    <div className="bg-slate-800 rounded-xl p-3 flex items-center gap-3 border-l-4 border-blue-500">
                        <div className="w-6 h-6 rounded bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold text-xs">!</div>
                        <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
                            Contra entries are internal transfers. They do not affect the net worth of the business, only its liquidity distribution.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[15%]">Date</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[15%]">Voucher No</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[45%]">Movement Path</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-[15%]">Amount Moved</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center w-[10%]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {historyLoading ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-3"></div>
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Syncing Registry...</span>
                                            </td>
                                        </tr>
                                    ) : vouchers.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                                No contra history detected
                                            </td>
                                        </tr>
                                    ) : (
                                        vouchers.map(v => {
                                            const debitEntry = v.entries.find(e => e.debitLedgerId);
                                            const creditEntry = v.entries.find(e => e.creditLedgerId);
                                            return (
                                                <tr key={v.id} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-semibold text-slate-800 tracking-tight">
                                                                {new Date(v.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </span>
                                                            <span className="text-[10px] font-medium text-slate-400 uppercase">
                                                                {v.reference || '-'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-bold text-slate-900">{v.voucherNumber}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-tighter">Debit To:</span> 
                                                                <span className="text-[11px] font-bold text-slate-700">{debitEntry?.debitLedger?.name || 'Unknown'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100 uppercase tracking-tighter">Credit From:</span> 
                                                                <span className="text-[11px] font-bold text-slate-700">{creditEntry?.creditLedger?.name || 'Unknown'}</span>
                                                            </div>
                                                            <p className="text-[10px] font-medium text-slate-500 italic truncate max-w-sm mt-1" title={v.narration}>
                                                                {v.narration}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-sm font-bold text-slate-900 tabular-nums">
                                                                ₹{parseFloat(v.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                            </span>
                                                            {v.status === 'CANCELLED' ? (
                                                                <span className="mt-1 px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[8px] font-bold uppercase tracking-widest ring-1 ring-red-200">Reversed</span>
                                                            ) : (
                                                                <span className="mt-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 text-[8px] font-bold uppercase tracking-widest ring-1 ring-blue-200">Balanced</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => setPrintVoucher(v)}
                                                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                                title="Print"
                                                            >
                                                                <FiPrinter size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleEdit(v)}
                                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                title="Edit"
                                                            >
                                                                <FiEdit2 size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteClick(v.id)}
                                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                title="Void"
                                                            >
                                                                <FiTrash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Confirm Cancellation"
                message="Are you sure you want to void this contra entry? This will immediately reverse all ledger impacts. This action cannot be undone."
            />

            <ProfessionalModal
                isOpen={isSaveModalOpen}
                onClose={() => setIsSaveModalOpen(false)}
                onConfirm={confirmSave}
                type="success"
                title={editId ? "Update Contra Entry" : "Post Contra Entry"}
                message={editId ? "Confirm that you want to apply these adjustments to the existing entry." : "This will create a new contra entry and update ledger balances immediately."}
                confirmText={editId ? "Update Now" : "Post Contra"}
                details={[
                    { label: 'Voucher Date', value: formData.date },
                    { label: 'Transfer From', value: ledgers.find(l => l.id == formData.fromAccount)?.name || 'N/A' },
                    { label: 'Transfer To', value: ledgers.find(l => l.id == formData.toAccount)?.name || 'N/A' },
                    { label: 'Amount', value: `₹${parseFloat(formData.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }
                ]}
            />
        </div>
    );
}
