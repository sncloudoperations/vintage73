import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
    FiSearch,
    FiPlus,
    FiTrash2,
    FiX,
    FiChevronDown,
    FiEdit2
} from 'react-icons/fi';
import { useRouter } from 'next/router';
import { useTheme } from '@/context/ThemeContext';
import { toast } from 'react-toastify';
import SearchableSelect from '@/components/SearchableSelect';

const PostingSetup = () => {
    const router = useRouter();
    const { theme } = useTheme();
    const [ledgers, setLedgers] = useState([]);
    const [postings, setPostings] = useState([]);
    const [metadata, setMetadata] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);

    const [newPosting, setNewPosting] = useState({
        transactionType: 'SALES',
        role: '',
        label: '',
        ledgerId: '',
        side: 'CREDIT',
        postingMethod: 'INDIVIDUAL',
        targetTable: 'Sale',
        amountField: '',
        customFormula: '',
        condition: ''
    });
    const [isEdit, setIsEdit] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [ledgersRes, postingsRes, metadataRes] = await Promise.all([
                api.get('/accounting/ledgers?limit=1000'),
                api.get('/accounting/posting-setup'),
                api.get('/accounting/posting-setup/metadata')
            ]);
            setLedgers(ledgersRes.data);
            setMetadata(metadataRes.data);
            setPostings(postingsRes.data);
        } catch (err) {
            console.error('Error fetching data:', err);
            toast.error('Failed to load configuration');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (posting) => {
        setNewPosting({
            ...posting,
            ledgerId: posting.ledgerId,
            targetTable: posting.targetTable || 'Sale'
        });
        setIsEdit(true);
        setShowAddModal(true);
    };

    const resetForm = () => {
        setNewPosting({
            transactionType: 'SALES',
            role: '',
            label: '',
            ledgerId: '',
            side: 'CREDIT',
            postingMethod: 'INDIVIDUAL',
            targetTable: 'Sale',
            amountField: '',
            customFormula: '',
            condition: ''
        });
        setIsEdit(false);
    };

    const handleUpsert = async (posting) => {
        try {
            await api.post('/accounting/posting-setup', posting);
            toast.success('Configuration updated');
            fetchData();
            setShowAddModal(false);
        } catch (err) {
            toast.error('Update failed');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this mapping?')) return;
        try {
            await api.delete(`/accounting/posting-setup/${id}`);
            toast.success('Mapping deleted');
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Delete failed');
        }
    };

    const filteredPostings = postings.filter(p =>
        (p.label?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.transactionType.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.role.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.ledger?.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const ledgerOptions = ledgers.map(l => ({
        value: l.id,
        label: `${l.name}${l.group ? ` (${l.group.name})` : ''}`
    }));

    const selectedModel = metadata.find(m => m.id === (newPosting.targetTable || 'Sale'));

    if (loading) return <div className="h-screen flex items-center justify-center text-xs font-medium uppercase tracking-widest text-slate-400">Loading Configuration...</div>;

    return (
        <div className="p-4 bg-slate-50 min-h-screen font-sans">
            {/* Header section matching screenshot */}
            <div className="mb-6 px-2">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-xl font-semibold text-slate-800">Ledger Posting Setup</h1>
                        <p className="text-sm text-slate-500 mt-0.5">{postings.length} configurations</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <button
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                        >
                            <FiX className="text-slate-400" />
                            Export CSV
                        </button>
                        <button
                            onClick={() => { resetForm(); setShowAddModal(true); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all shadow-md active:scale-95"
                            style={{ backgroundColor: theme.primaryColor }}
                        >
                            <FiPlus />
                            Add Posting
                        </button>
                    </div>
                </div>

                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiSearch className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search configurations or roles..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-1 transition-all"
                        style={{ ringColor: theme.primaryColor + '30', borderColor: theme.primaryColor + '20' }}
                    />
                </div>
            </div>

            {/* Main Table Matching Screenshot Style */}
            <div className="mx-2 bg-white shadow-sm border border-slate-200 rounded-xl mb-12 table-container scroll-line lg:no-scrollbar overflow-x-auto">
                <table className="w-full text-left border-collapse table-modern min-w-[800px]">
                    <thead>
                        <tr className="text-white text-[12px] font-medium uppercase tracking-wider h-10 whitespace-nowrap" style={{ backgroundColor: theme.primaryColor }}>
                            <th className="px-4 py-2 border-r border-white/10 w-[20%]">Mapping Label</th>
                            <th className="px-4 py-2 border-r border-white/10 w-[15%]">Type / Role</th>
                            <th className="px-4 py-2 border-r border-white/10 w-[25%]">Ledger Mapping</th>
                            <th className="px-4 py-2 border-r border-white/10 w-[10%] text-center">Side</th>
                            <th className="px-4 py-2 border-r border-white/10 w-[20%]">Mapping Detail</th>
                            <th className="px-4 py-2 w-[10%] text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="text-[13px]">
                        {filteredPostings.map((p, idx) => (
                            <tr key={idx} className={`${idx % 2 === 0 ? 'bg-[#f9f9f9]' : 'bg-white'} transition-colors border-b border-slate-100 group`} style={{ '--hover-bg': theme.primaryColor + '08' }}>
                                <td className="px-4 py-3 font-medium text-slate-800 border-r border-slate-100" style={{ backgroundColor: theme.primaryColor + '08' }}>
                                    {p.label || `${p.transactionType}: ${p.role}`}
                                </td>
                                <td className="px-4 py-1 border-r border-slate-100 text-[11px] font-medium text-slate-500 uppercase">
                                    {p.transactionType} / {p.role}
                                </td>
                                <td className="px-4 py-1 border-r border-slate-100">
                                    <SearchableSelect
                                        options={ledgerOptions}
                                        value={p.ledgerId}
                                        onChange={(val) => handleUpsert({ ...p, ledgerId: val })}
                                        placeholder="Select Ledger"
                                        className="w-full"
                                    />
                                </td>
                                <td className="px-4 py-1 border-r border-slate-100 text-center">
                                    <span
                                        onClick={() => handleUpsert({ ...p, side: p.side === 'DEBIT' ? 'CREDIT' : 'DEBIT' })}
                                        className={`px-2 py-1 rounded text-[10px] font-medium cursor-pointer select-none ${p.side === 'DEBIT' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}
                                    >
                                        {p.side}
                                    </span>
                                </td>
                                <td className="px-4 py-1 border-r border-slate-100 italic text-[11px] text-slate-500">
                                    {p.amountField || p.customFormula || 'No mapping'}
                                </td>
                                <td className="px-4 py-1 text-center">
                                    <div className="flex justify-center gap-2">
                                        <button
                                            onClick={() => handleEdit(p)}
                                            className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                            title="Edit Mapping"
                                        >
                                            <FiEdit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(p.id)}
                                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                            title="Delete Mapping"
                                        >
                                            <FiTrash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Total Count at footer */}
            <div className="mt-4 px-4 flex items-center gap-10 text-[13px] font-medium italic" style={{ color: theme.primaryColor }}>
                <span>Total Count</span>
                <span className="text-xl font-bold not-italic text-slate-900">{postings.length}</span>
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] sm:max-h-[85vh]">
                        <div className="bg-slate-50 px-6 sm:px-8 py-5 sm:py-6 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-medium text-slate-800 uppercase tracking-tight">{isEdit ? 'Edit Posting Mapping' : 'New Posting Mapping'}</h3>
                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">{isEdit ? 'Update existing rule' : 'Define Ledger Posting Rules'}</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><FiX /></button>
                        </div>

                        <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 flex-1 overflow-y-auto">
                            <div className="space-y-1">
                                <label className="text-[10px] font-medium uppercase text-slate-400 ml-1">Friendly Label</label>
                                <input
                                    className="w-full h-11 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-xs font-medium text-slate-700 outline-none focus:ring-2 transition-all"
                                    style={{ ringColor: theme.primaryColor + '20' }}
                                    placeholder="e.g., Discount (Debit)"
                                    value={newPosting.label}
                                    onChange={(e) => setNewPosting({ ...newPosting, label: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-medium uppercase text-slate-400 ml-1">Transaction Type</label>
                                <SearchableSelect
                                    options={[
                                        { value: 'SALES', label: 'SALES' },
                                        { value: 'PURCHASE', label: 'PURCHASE' },
                                        { value: 'PAYMENT', label: 'PAYMENT' },
                                        { value: 'RECEIPT', label: 'RECEIPT' },
                                        { value: 'STOCK_TRANSFER', label: 'STOCK_TRANSFER' },
                                        { value: 'STOCK_RECEIPT', label: 'STOCK_RECEIPT' },
                                    ]}
                                    value={newPosting.transactionType}
                                    onChange={(val) => setNewPosting({ ...newPosting, transactionType: val })}
                                    direction="down"
                                    triggerClassName="h-11 bg-slate-50 border-slate-100 rounded-2xl"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-medium uppercase text-slate-400 ml-1">Posting Role/Key</label>
                                <input
                                    className="w-full h-11 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-xs font-medium text-slate-700 outline-none focus:ring-2 transition-all"
                                    style={{ ringColor: theme.primaryColor + '20' }}
                                    placeholder="e.g., DISCOUNT_EXP"
                                    value={newPosting.role}
                                    onChange={(e) => setNewPosting({ ...newPosting, role: e.target.value.toUpperCase() })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-medium uppercase text-slate-400 ml-1">Ledger Side</label>
                                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl h-11">
                                    <button
                                        onClick={() => setNewPosting({ ...newPosting, side: 'DEBIT' })}
                                        className={`flex-1 rounded-lg text-[10px] font-medium transition-all ${newPosting.side === 'DEBIT' ? 'bg-white shadow-sm text-red-600' : 'text-slate-400'}`}
                                    >DEBIT</button>
                                    <button
                                        onClick={() => setNewPosting({ ...newPosting, side: 'CREDIT' })}
                                        className={`flex-1 rounded-lg text-[10px] font-medium transition-all ${newPosting.side === 'CREDIT' ? 'bg-white shadow-sm text-green-600' : 'text-slate-400'}`}
                                    >CREDIT</button>
                                </div>
                            </div>

                            <div className="col-span-1 sm:col-span-2 space-y-1">
                                <label className="text-[10px] font-medium uppercase text-slate-400 ml-1">Link Account (Ledger)</label>
                                <SearchableSelect
                                    options={ledgerOptions}
                                    value={newPosting.ledgerId}
                                    onChange={(val) => setNewPosting({ ...newPosting, ledgerId: val })}
                                    placeholder="Select Ledger..."
                                    direction="down"
                                    triggerClassName="h-11 bg-slate-50 border-slate-100 rounded-2xl"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-medium uppercase text-slate-400 ml-1">Target Model</label>
                                <SearchableSelect
                                    options={metadata.map(m => ({ value: m.id, label: m.name }))}
                                    value={newPosting.targetTable}
                                    onChange={(val) => setNewPosting({ ...newPosting, targetTable: val })}
                                    direction="down"
                                    triggerClassName="h-11 bg-slate-50 border-slate-100 rounded-2xl"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-medium uppercase text-slate-400 ml-1">Posting Mode</label>
                                <SearchableSelect
                                    options={[
                                        { value: 'INDIVIDUAL', label: 'Individual per Invoice' },
                                        { value: 'SUM', label: 'Sum (Aggregated)' }
                                    ]}
                                    value={newPosting.postingMethod}
                                    onChange={(val) => setNewPosting({ ...newPosting, postingMethod: val })}
                                    direction="down"
                                    triggerClassName="h-11 bg-slate-50 border-slate-100 rounded-2xl"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-medium uppercase text-slate-400 ml-1">Source Field</label>
                                <SearchableSelect
                                    options={[
                                        { value: '', label: '-- Custom Formula --' },
                                        ...(selectedModel?.fields.map(f => ({ value: f, label: f })) || [])
                                    ]}
                                    value={newPosting.amountField}
                                    onChange={(val) => setNewPosting({ ...newPosting, amountField: val, customFormula: '' })}
                                    direction="down"
                                    triggerClassName="h-11 bg-slate-50 border-slate-100 rounded-2xl"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-medium uppercase text-slate-400 ml-1">Custom Formula</label>
                                <input
                                    className="w-full h-11 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-[11px] font-mono font-medium text-slate-700 outline-none focus:ring-2 transition-all"
                                    style={{ ringColor: theme.primaryColor + '20' }}
                                    placeholder="e.g. totalAmount * 0.05"
                                    value={newPosting.customFormula}
                                    disabled={!!newPosting.amountField}
                                    onChange={(e) => setNewPosting({ ...newPosting, customFormula: e.target.value })}
                                />
                            </div>

                            <div className="col-span-1 sm:col-span-2 space-y-1">
                                <label className="text-[10px] font-medium uppercase text-slate-400 ml-1">Condition (Post only if true)</label>
                                <input
                                    className="w-full h-11 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-[11px] font-mono font-medium text-slate-700 outline-none focus:ring-2 transition-all"
                                    style={{ ringColor: theme.primaryColor + '20' }}
                                    placeholder="e.g. taxAmount > 0"
                                    value={newPosting.condition}
                                    onChange={(e) => setNewPosting({ ...newPosting, condition: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="px-6 sm:px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex gap-4 flex-shrink-0">
                            <button
                                onClick={() => handleUpsert(newPosting)}
                                className="flex-1 h-12 sm:h-14 text-white rounded-2xl font-medium text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                                style={{ backgroundColor: theme.primaryColor, boxShadow: `0 10px 15px -3px ${theme.primaryColor}30` }}
                            >
                                {isEdit ? 'Update Posting Mapping' : 'Save Posting Mapping'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PostingSetup;
