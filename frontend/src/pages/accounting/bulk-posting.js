import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
    FiRefreshCw,
    FiCalendar,
    FiCheckCircle,
    FiAlertCircle,
    FiArrowLeft,
    FiPlay,
    FiCpu,
    FiActivity
} from 'react-icons/fi';
import { useRouter } from 'next/router';
import { useTheme } from '@/context/ThemeContext';
import { toast } from 'react-toastify';

const BulkPosting = () => {
    const router = useRouter();
    const { theme } = useTheme();
    const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('IDLE'); // IDLE, PROCESSING, COMPLETED, ERROR
    const [results, setResults] = useState(null);

    const handleStartSync = async () => {
        if (!fromDate || !toDate) {
            toast.warning('Please select date range');
            return;
        }

        setIsProcessing(true);
        setStatus('PROCESSING');
        setProgress(10); // Initial kick-off

        try {
            // Simulate real progress as we don't have a stream yet, 
            // but the backend handles it in one go. For better UX, we'll increment.
            const progressInterval = setInterval(() => {
                setProgress(prev => (prev < 90 ? prev + 5 : prev));
            }, 500);

            const res = await api.post('/accounting/bulk-post', {
                fromDate,
                toDate,
                transactionTypes: ['SALES', 'PURCHASE']
            });

            clearInterval(progressInterval);
            setProgress(100);
            setResults(res.data);
            setStatus('COMPLETED');
            toast.success('Sync completed successfully');
        } catch (err) {
            console.error('Sync error:', err);
            setStatus('ERROR');
            toast.error('Sync failed: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const totalProcessed = results ? (results.sales.processed + results.purchases.processed) : 0;
    const totalItems = results ? (results.sales.total + results.purchases.total) : 0;
    const totalErrors = results ? (results.sales.errors.length + results.purchases.errors.length) : 0;

    return (
        <div className="p-4 max-w-4xl mx-auto min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center mb-10 sticky top-0 bg-white/80 backdrop-blur-md z-10 py-4 border-b border-slate-100">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                        <FiArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Bulk Posting Utility</h1>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Manual Ledger Synchronization</p>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {/* Left Side: Controls */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-100 border border-slate-50">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <FiCalendar className="text-slate-400" /> Date Range
                        </h3>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">From</label>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-xs font-bold text-slate-700 focus:ring-2 focus:bg-white transition-all outline-none"
                                    style={{ ringColor: theme.primaryColor + '20', borderColor: theme.primaryColor + '10' }}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">To</label>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-xs font-bold text-slate-700 focus:ring-2 focus:bg-white transition-all outline-none"
                                    style={{ ringColor: theme.primaryColor + '20', borderColor: theme.primaryColor + '10' }}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleStartSync}
                            disabled={isProcessing}
                            className="w-full mt-8 h-14 rounded-2xl text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all disabled:opacity-50"
                            style={{ backgroundColor: theme.primaryColor }}
                        >
                            {isProcessing ? (
                                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <FiRefreshCw size={18} />
                            )}
                            {isProcessing ? 'Syncing...' : 'Start Manual Sync'}
                        </button>
                    </div>

                    <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-2xl overflow-hidden relative group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
                        <FiCpu className="text-slate-700 mb-4" size={32} />
                        <h4 className="font-black text-xs uppercase tracking-widest mb-2">Engine Logic</h4>
                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                            This utility re-evaluates all transactions in the selected range using your current Ledger Posting Setup. Existing vouchers will be replaced to ensure reports match policies.
                        </p>
                    </div>
                </div>

                {/* Right Side: Progress & Results */}
                <div className="md:col-span-2 space-y-6">
                    {/* Progress Section */}
                    <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-100 border border-slate-50">
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-1">
                                    <FiActivity className="text-slate-400" /> Progress
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{status}</p>
                            </div>
                            <div className="text-2xl font-black tabular-nums" style={{ color: theme.primaryColor }}>
                                {progress}%
                            </div>
                        </div>

                        {/* Professional Progress Bar */}
                        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden mb-8 p-1 border border-slate-50">
                            <div
                                className="h-full rounded-full transition-all duration-500 ease-out relative"
                                style={{ width: `${progress}%`, backgroundColor: theme.primaryColor }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 animate-shimmer"></div>
                            </div>
                        </div>

                        {/* Results Grid */}
                        {results && (
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                    <div className="text-[10px] font-black uppercase text-slate-400 mb-4">Sales Postings</div>
                                    <div className="flex items-end justify-between">
                                        <div className="text-3xl font-black text-slate-800">{results.sales.processed}<span className="text-xs text-slate-300 font-bold ml-1">/ {results.sales.total}</span></div>
                                        <div className={`text-[10px] font-black px-2 py-1 rounded-lg ${results.sales.errors.length > 0 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                            {results.sales.errors.length} ERRORS
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                    <div className="text-[10px] font-black uppercase text-slate-400 mb-4">Purchase Postings</div>
                                    <div className="flex items-end justify-between">
                                        <div className="text-3xl font-black text-slate-800">{results.purchases.processed}<span className="text-xs text-slate-300 font-bold ml-1">/ {results.purchases.total}</span></div>
                                        <div className={`text-[10px] font-black px-2 py-1 rounded-lg ${results.purchases.errors.length > 0 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                            {results.purchases.errors.length} ERRORS
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {status === 'IDLE' && (
                            <div className="h-40 flex flex-col items-center justify-center text-center opacity-40">
                                <FiPlay size={32} className="text-slate-300 mb-3" />
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select dates and start</p>
                            </div>
                        )}
                    </div>

                    {/* Details Table if Errors */}
                    {(results?.sales.errors.length > 0 || results?.purchases.errors.length > 0) && (
                        <div className="bg-red-50/50 p-6 rounded-3xl border border-red-100">
                            <h4 className="text-[10px] font-black uppercase text-red-400 mb-4 flex items-center gap-2">
                                <FiAlertCircle /> Transaction Failure Details
                            </h4>
                            <div className="max-h-40 overflow-y-auto space-y-2">
                                {[...results.sales.errors.map(e => ({ ...e, type: 'Sale' })), ...results.purchases.errors.map(e => ({ ...e, type: 'Purchase' }))].map((err, i) => (
                                    <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-red-50 shadow-sm">
                                        <span className="text-[10px] font-bold text-slate-500">{err.type} ID: {err.id}</span>
                                        <span className="text-[10px] font-black text-red-500">{err.error}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
         @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
         }
         .animate-shimmer {
            animation: shimmer 1.5s infinite linear;
         }
      `}</style>
        </div>
    );
};

export default BulkPosting;
