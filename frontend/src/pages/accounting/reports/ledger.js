import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { FiDownload, FiPrinter, FiFilter, FiSearch } from 'react-icons/fi';

export default function LedgerReport() {
    const router = useRouter();
    const [transactions, setTransactions] = useState([]);
    const [ledgerInfo, setLedgerInfo] = useState(null);
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(false);
    
    // Ledger Selection
    const [ledgers, setLedgers] = useState([]);
    const [selectedLedgerId, setSelectedLedgerId] = useState('');

    // Date Filtering (Default to current month)
    const date = new Date();
    const [startDate, setStartDate] = useState(new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        fetchCompanyProfile();
        fetchLedgers();
    }, []); 

    const fetchCompanyProfile = async () => {
        try {
            const res = await api.get('/company');
            setCompany(res.data);
        } catch (err) {
            console.error("Failed to load company info");
        }
    };

    const fetchLedgers = async () => {
        try {
            const res = await api.get('/accounting/ledgers');
            setLedgers(res.data);
            return res.data; // Return for immediately using in auto-fetch
        } catch (err) {
            console.error(err);
            toast.error("Failed to load ledgers");
            return [];
        }
    };

    // Auto-fetch if ledgerId is in query
    useEffect(() => {
        if (router.isReady && router.query.ledgerId) {
            const { ledgerId, startDate: qStart, endDate: qEnd } = router.query;
            
            setSelectedLedgerId(ledgerId);
            if (qStart) setStartDate(qStart);
            if (qEnd) setEndDate(qEnd);

            // Fetch report data directly using query values to avoid waiting for state update
            const autoFetch = async () => {
                setLoading(true);
                try {
                    const res = await api.get('/accounting/reports/ledger-statement', {
                        params: {
                            ledgerId: ledgerId,
                            startDate: qStart || startDate,
                            endDate: qEnd || endDate
                        }
                    });

                    setLedgerInfo(res.data.ledger);
                    setTransactions(res.data.statement);
                } catch (err) {
                    console.error(err);
                    toast.error('Failed to load Ledger Report');
                } finally {
                    setLoading(false);
                }
            };
            autoFetch();
        }
    }, [router.isReady, router.query]);

    const fetchReport = async () => {
        if (!selectedLedgerId) {
            toast.error("Please select a ledger");
            return;
        }

        setLoading(true);
        try {
            const res = await api.get('/accounting/reports/ledger-statement', {
                params: {
                    ledgerId: selectedLedgerId,
                    startDate,
                    endDate
                }
            });

            setLedgerInfo(res.data.ledger);
            setTransactions(res.data.statement);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load Ledger Report');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        if (!transactions.length) {
            toast.error("No data to export");
            return;
        }
        
        const csvContent = [
            ['Date', 'Voucher No', 'Particulars', 'Debit', 'Credit', 'Balance'],
            // Opening Balance Row
            [
                startDate, 
                '-', 
                'By Balance b/d (Opening)', 
                '-', 
                '-', 
                `${ledgerInfo?.openingBalance} ${ledgerInfo?.balanceType === 'DEBIT' ? 'Dr' : 'Cr'}`
            ],
            // Transactions
            ...transactions.map(tx => [
                new Date(tx.date).toLocaleDateString(),
                tx.voucherNumber,
                `"${tx.particulars} - ${tx.narration || ''}"`, 
                tx.debit || 0,
                tx.credit || 0,
                `${Math.abs(tx.balance)} ${tx.balance >= 0 ? 'Dr' : 'Cr'}`
            ]),
            // Closing Balance Row
            [
                endDate, 
                '-', 
                'Total Closing Balance', 
                '-', 
                '-', 
                `${transactions.length > 0 ? Math.abs(transactions[transactions.length-1].balance) : ledgerInfo?.openingBalance} ${transactions.length > 0 ? (transactions[transactions.length-1].balance >= 0 ? 'Dr' : 'Cr') : (ledgerInfo?.balanceType === 'DEBIT' ? 'Dr' : 'Cr')}`
            ]
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ledger_${ledgerInfo?.name || 'Report'}_${startDate}_to_${endDate}.csv`;
        a.click();
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div id="printable-report" className="p-8 max-w-[1200px] mx-auto print:p-0 print:max-w-none bg-white min-h-screen">
             <style jsx global>{`
                @media print {
                    @page { size: A4; margin: 10mm; }
                    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    
                    /* Hide everything by default */
                    body * {
                        visibility: hidden;
                    }

                    /* Show only the report container and its children */
                    #printable-report, #printable-report * {
                        visibility: visible;
                    }

                    /* Position the report at the very top */
                    #printable-report {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 0;
                    }

                    /* Hide specific elements marked as hidden in print */
                    .print\\:hidden { 
                        display: none !important; 
                        visibility: hidden !important;
                    }
                }
            `}</style>

            {/* Controls (Hidden in Print) */}
            <div className="mb-6 flex flex-wrap justify-between items-end gap-4 print:hidden bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Select Ledger</label>
                        <select
                            className="border border-slate-300 rounded px-3 py-1.5 text-sm w-64 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            value={selectedLedgerId}
                            onChange={(e) => setSelectedLedgerId(e.target.value)}
                        >
                            <option value="">-- Choose Ledger --</option>
                            {ledgers.map(l => (
                                <option key={l.id} value={l.id}>{l.name} ({l.group?.name})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">From Date</label>
                        <input 
                            type="date" 
                            className="border border-slate-300 rounded px-3 py-1.5 text-sm"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">To Date</label>
                        <input 
                            type="date" 
                            className="border border-slate-300 rounded px-3 py-1.5 text-sm"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={fetchReport}
                        className="bg-emerald-600 text-white px-5 py-1.5 rounded text-sm font-semibold hover:bg-emerald-700 flex items-center gap-2"
                    >
                        <FiFilter /> Generate
                    </button>
                     {transactions.length > 0 && (
                        <button 
                             onClick={handleExport}
                             className="border border-slate-300 text-slate-700 px-4 py-1.5 rounded text-sm font-semibold hover:bg-white flex items-center gap-2"
                         >
                             <FiDownload /> Excel
                         </button>
                     )}
                </div>
                <div>
                     <button 
                        onClick={handlePrint}
                        className="bg-slate-800 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-slate-900 flex items-center gap-2 shadow-sm"
                    >
                        <FiPrinter /> Print
                    </button>
                </div>
            </div>

            {loading && !ledgerInfo ? (
                 <div className="p-12 text-center text-slate-400">Loading Report...</div>
            ) : !ledgerInfo ? (
                <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    Select a ledger and date range to generate report
                </div>
            ) : (
                <>
                {/* Report Header */}
                <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wide">{company?.companyName || 'Company Name'}</h1>
                    <p className="text-sm text-slate-600 mt-1">{company?.address}, {company?.city} - {company?.pincode}</p>
                    <div className="mt-4 border-t border-slate-300 pt-2 inline-block px-8">
                        <h2 className="text-xl font-bold text-slate-800 underline decoration-2 underline-offset-4 decoration-slate-400">
                            {ledgerInfo.name} Report
                        </h2>
                        <p className="text-xs text-slate-500 font-medium mt-1 uppercase">Period: {startDate} to {endDate}</p>
                    </div>
                </div>

                {/* Report Content */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-300 text-sm">
                        <thead>
                            <tr className="bg-slate-100 text-slate-700">
                                <th className="border border-slate-300 px-3 py-2 text-left w-[12%]">Date</th>
                                <th className="border border-slate-300 px-3 py-2 text-left w-[15%]">Voucher No</th>
                                <th className="border border-slate-300 px-3 py-2 text-left w-[35%]">Particulars</th>
                                <th className="border border-slate-300 px-3 py-2 text-right w-[12%]">Debit (In)</th>
                                <th className="border border-slate-300 px-3 py-2 text-right w-[12%]">Credit (Out)</th>
                                <th className="border border-slate-300 px-3 py-2 text-right w-[14%] font-bold">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Opening Balance Row */}
                            <tr className="bg-slate-50 font-medium text-slate-700">
                                <td className="border border-slate-300 px-3 py-2">{startDate}</td>
                                <td className="border border-slate-300 px-3 py-2">-</td>
                                <td className="border border-slate-300 px-3 py-2 italic">By Balance b/d (Opening)</td>
                                <td className="border border-slate-300 px-3 py-2 text-right">-</td>
                                <td className="border border-slate-300 px-3 py-2 text-right">-</td>
                                <td className="border border-slate-300 px-3 py-2 text-right font-bold text-slate-800">
                                    ₹{ledgerInfo?.openingBalance?.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                                    <span className="text-[10px] ml-1 text-slate-500">{ledgerInfo?.balanceType === 'DEBIT' ? 'Dr' : 'Cr'}</span>
                                </td>
                            </tr>

                            {/* Transactions */}
                            {transactions.map((tx, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="border border-slate-300 px-3 py-2 text-slate-600">
                                        {new Date(tx.date).toLocaleDateString()}
                                    </td>
                                    <td className="border border-slate-300 px-3 py-2 text-slate-600 text-xs">
                                        {tx.voucherNumber}
                                        <span className="block text-[10px] text-slate-400 capitalize">{tx.voucherType.toLowerCase()}</span>
                                    </td>
                                    <td className="border border-slate-300 px-3 py-2 text-slate-800 font-medium">
                                        {tx.particulars}
                                        {tx.narration && (
                                            <div className="text-[11px] text-slate-500 font-normal italic mt-0.5">{tx.narration}</div>
                                        )}
                                    </td>
                                    <td className="border border-slate-300 px-3 py-2 text-right text-emerald-700">
                                        {tx.debit > 0 ? `₹${tx.debit.toLocaleString('en-IN', {minimumFractionDigits: 2})}` : '-'}
                                    </td>
                                    <td className="border border-slate-300 px-3 py-2 text-right text-red-700">
                                        {tx.credit > 0 ? `₹${tx.credit.toLocaleString('en-IN', {minimumFractionDigits: 2})}` : '-'}
                                    </td>
                                    <td className="border border-slate-300 px-3 py-2 text-right font-mono text-slate-700 bg-slate-50/50">
                                        ₹{Math.abs(tx.balance).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                                        <span className="text-[10px] ml-1 text-slate-400">{tx.balance >= 0 ? 'Dr' : 'Cr'}</span>
                                    </td>
                                </tr>
                            ))}

                            {/* Empty Row if no transactions */}
                            {transactions.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="border border-slate-300 px-3 py-8 text-center text-slate-400 italic">
                                        No transactions found in this period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                             {/* Closing Balance Row */}
                             <tr className="bg-slate-100 font-bold border-t-2 border-slate-800 text-slate-900">
                                <td className="border border-slate-300 px-3 py-3" colSpan="3">Total Closing Balance</td>
                                 <td className="border border-slate-300 px-3 py-3 text-right">
                                    {/* Optional: Total Debits */}
                                 </td>
                                 <td className="border border-slate-300 px-3 py-3 text-right">
                                    {/* Optional: Total Credits */}
                                 </td>
                                 <td className="border border-slate-300 px-3 py-3 text-right text-base">
                                    {transactions.length > 0 
                                        ? `₹${Math.abs(transactions[transactions.length-1].balance).toLocaleString('en-IN', {minimumFractionDigits: 2})}`
                                        : `₹${ledgerInfo?.openingBalance?.toLocaleString('en-IN', {minimumFractionDigits: 2})}`
                                    }
                                     <span className="text-xs ml-1 text-slate-600">
                                         {transactions.length > 0 
                                            ? (transactions[transactions.length-1].balance >= 0 ? 'Dr' : 'Cr')
                                            : (ledgerInfo?.balanceType === 'DEBIT' ? 'Dr' : 'Cr')
                                         }
                                     </span>
                                 </td>
                            </tr>
                        </tfoot>
                    </table>

                    <div className="mt-8 grid grid-cols-2 gap-8 print:mt-16">
                        <div className="text-center pt-8 border-t border-slate-300 w-48 ml-8">
                            <p className="text-sm font-semibold text-slate-700">Accountant Sign</p>
                        </div>
                        <div className="text-center pt-8 border-t border-slate-300 w-48 ml-auto mr-8">
                            <p className="text-sm font-semibold text-slate-700">Authorized Signatory</p>
                        </div>
                    </div>
                </div>
                </>
            )}
        </div>
    );
}
