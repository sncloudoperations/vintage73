import { useState, useEffect } from 'react';
import { FiPlus, FiLock, FiCheckCircle } from 'react-icons/fi';
import api from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';

export default function FinancialYear() {
    const { theme } = useTheme();
    const [years, setYears] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [closingYear, setClosingYear] = useState(null);
    const [retainedEarningsLedger, setRetainedEarningsLedger] = useState('');
    const [ledgers, setLedgers] = useState([]);

    const [formData, setFormData] = useState({
        name: '',
        startDate: '',
        endDate: '',
        invoicePrefix: 'INV',
        invoiceSequence: '001'
    });

    useEffect(() => {
        fetchYears();
        fetchLedgers();
    }, []);

    const fetchYears = async () => {
        try {
            const { data } = await api.get('/financial-years');
            setYears(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLedgers = async () => {
        try {
            const { data } = await api.get('/accounting/ledgers');
            // Filter for Equity accounts ideally, but show all for flexibility or filtered by groupType if available in frontend
            setLedgers(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/financial-years', formData);
            setShowModal(false);
            setFormData({ name: '', startDate: '', endDate: '', invoicePrefix: 'INV', invoiceSequence: '001' });
            fetchYears();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to create');
        }
    };

    const handlePreviewClose = async (year) => {
        try {
            setClosingYear(year);
            const { data } = await api.get(`/financial-years/${year.id}/preview`);
            setPreviewData(data);
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to preview');
        }
    };

    const handleConfirmClose = async () => {
        if (!retainedEarningsLedger) {
            alert('Please select a ledger for Net Profit/Loss transfer');
            return;
        }

        if (!confirm(`Are you sure you want to CLOSE ${closingYear.name}? This will lock all transactions for this period.`)) {
            return;
        }

        try {
            await api.post(`/financial-years/${closingYear.id}/close`, {
                retainedEarningsLedgerId: retainedEarningsLedger
            });
            alert('Financial Year Closed Successfully');
            setClosingYear(null);
            setPreviewData(null);
            fetchYears();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to close year');
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold">Financial Years</h1>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: theme.primaryColor }}
                >
                    <FiPlus /> New Financial Year
                </button>
            </div>

            {loading ? (
                <div>Loading...</div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prefix</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sequence</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {years.map((year) => (
                                <tr key={year.id}>
                                    <td className="px-6 py-4 font-medium">{year.name}</td>
                                    <td className="px-6 py-4">{new Date(year.startDate).toLocaleDateString('en-GB')}</td>
                                    <td className="px-6 py-4">{new Date(year.endDate).toLocaleDateString('en-GB')}</td>
                                    <td className="px-6 py-4">
                                        <span className="bg-slate-100 px-2 py-1 rounded text-xs font-medium font-mono">{year.invoicePrefix}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium font-mono">{year.invoiceSequence}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {year.isClosed ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                <FiLock size={12} /> Closed
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                <FiCheckCircle size={12} /> Open
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {!year.isClosed && (
                                            <button
                                                onClick={() => handlePreviewClose(year)}
                                                className="text-sm text-red-600 hover:text-red-800 font-medium"
                                            >
                                                Close Year
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-semibold mb-4">Create Financial Year</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. FY 2024-25"
                                    className="w-full border rounded p-2"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full border rounded p-2"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">End Date</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full border rounded p-2"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Invoice Prefix</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full border rounded p-2"
                                        value={formData.invoicePrefix}
                                        onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Starting Sequence</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full border rounded p-2"
                                        value={formData.invoiceSequence}
                                        onChange={(e) => setFormData({ ...formData, invoiceSequence: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-white rounded hover:opacity-90 transition-opacity"
                                    style={{ backgroundColor: theme.primaryColor }}
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Closing Preview Modal */}
            {closingYear && previewData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg">
                        <h2 className="text-xl font-semibold mb-4 text-red-600 flex items-center gap-2">
                            <FiLock /> Close Financial Year: {closingYear.name}
                        </h2>

                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-gray-600">Total Income</span>
                                <span className="font-semibold text-green-600">{previewData.totalIncome?.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-gray-600">Total Expense</span>
                                <span className="font-semibold text-red-600">{previewData.totalExpense?.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-medium pt-2">
                                <span>Net {previewData.isProfit ? 'Profit' : 'Loss'}</span>
                                <span className={previewData.isProfit ? 'text-green-700' : 'text-red-700'}>
                                    {Math.abs(previewData.netProfit)?.toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-1 text-gray-700">
                                Transfer Net {previewData.isProfit ? 'Profit' : 'Loss'} to Ledger:
                            </label>
                            <select
                                className="w-full border rounded p-2"
                                value={retainedEarningsLedger}
                                onChange={(e) => setRetainedEarningsLedger(e.target.value)}
                            >
                                <option value="">-- Select Ledger (e.g. Capital / Retained Earnings) --</option>
                                {ledgers.map(l => (
                                    <option key={l.id} value={l.id}>{l.name} ({l.group?.name})</option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                                Typically "Capital Account" or "Retained Earnings".
                            </p>
                        </div>

                        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-sm text-yellow-800 mb-6">
                            <strong>Warning:</strong> Closing the year will lock all transactions for this period. You cannot undo this action easily.
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => { setClosingYear(null); setPreviewData(null); }}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmClose}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                                Confirm Close Year
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
