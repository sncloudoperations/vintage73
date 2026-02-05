import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiDollarSign, FiPrinter, FiX, FiFilter, FiUser, FiCalendar, FiFileText, FiCheckCircle } from 'react-icons/fi';
import { useReactToPrint } from 'react-to-print';

export default function PayrollPage() {
    const [payrolls, setPayrolls] = useState([]);
    const [companyProfile, setCompanyProfile] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    
    // Filters
    const [filters, setFilters] = useState({
        userId: '',
        month: '',
        year: new Date().getFullYear().toString(),
        status: ''
    });

    // Pay Slip Modal
    const [selectedPayroll, setSelectedPayroll] = useState(null);
    const slipRef = useRef();
    const handlePrint = useReactToPrint({
        contentRef: slipRef,
    });

    // Bank Statement
    const [showBankStatement, setShowBankStatement] = useState(false);
    const bankStatementRef = useRef();
    const handlePrintBankStatement = useReactToPrint({
        contentRef: bankStatementRef,
    });

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const u = JSON.parse(storedUser);
            setCurrentUser(u);
            if (u.role === 'admin') {
                fetchUsers();
            } else {
                setFilters(prev => ({ ...prev, userId: u.id.toString() }));
            }
        }
        fetchCompanyProfile();
    }, []);

    useEffect(() => {
        // Fetch payroll whenever filters change (and after initial load)
        if (currentUser) fetchPayroll();
    }, [filters, currentUser]);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchPayroll = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            if (filters.userId) query.append('userId', filters.userId);
            if (filters.month) query.append('month', filters.month);
            if (filters.year) query.append('year', filters.year);
            if (filters.status) query.append('status', filters.status);

            const res = await api.get(`/hrms/payroll/history?${query.toString()}`);
            setPayrolls(res.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load payroll history");
        } finally {
            setLoading(false);
        }
    };

    const fetchCompanyProfile = async () => {
        try {
            const res = await api.get('/company'); 
            setCompanyProfile(res.data);
        } catch (err) {
            console.error("Failed to fetch company profile:", err);
        }
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-4">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                        <FiFileText className="text-emerald-600" />
                        Payroll Management
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Manage and view salary history</p>
                </div>
                <div className="flex gap-3">
                    {payrolls.length > 0 && filters.month && filters.year && (
                        <button 
                            onClick={() => setShowBankStatement(true)}
                            className="bg-white text-slate-700 border border-slate-200 px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
                        >
                            <FiCreditCard className="text-emerald-500" /> Bank Statement
                        </button>
                    )}
                </div>
            </header>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 items-end">
                {currentUser?.role === 'admin' && (
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <FiUser size={10} /> Employee
                        </label>
                        <select 
                            className="input-select w-full bg-slate-50 border-slate-200 text-xs font-bold"
                            value={filters.userId}
                            onChange={e => setFilters({...filters, userId: e.target.value})}
                        >
                            <option value="">All Employees</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                )}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <FiCalendar size={10} /> Month
                    </label>
                    <select 
                        className="input-select w-full bg-slate-50 border-slate-200 text-xs font-bold"
                        value={filters.month}
                        onChange={e => setFilters({...filters, month: e.target.value})}
                    >
                        <option value="">All Months</option>
                        {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <FiCalendar size={10} /> Year
                    </label>
                    <input 
                        type="number"
                        className="input w-full bg-slate-50 border-slate-200 text-xs font-bold"
                        value={filters.year}
                        onChange={e => setFilters({...filters, year: e.target.value})}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <FiFilter size={10} /> Status
                    </label>
                    <select 
                        className="input-select w-full bg-slate-50 border-slate-200 text-xs font-bold"
                        value={filters.status}
                        onChange={e => setFilters({...filters, status: e.target.value})}
                    >
                        <option value="">All Statuses</option>
                        <option value="GENERATED">Generated</option>
                        <option value="APPROVED">Approved</option>
                        <option value="PAID">Paid</option>
                    </select>
                </div>
                <button 
                    onClick={fetchPayroll}
                    className="h-10 bg-slate-100 text-slate-600 rounded-xl px-4 flex items-center justify-center gap-2 hover:bg-slate-200 transition-all text-xs font-black uppercase tracking-widest"
                >
                    Refresh
                </button>
            </div>

            <div className="card shadow-md border border-slate-200">
                <div className="table-container">
                    <table className="table-modern">
                        <thead>
                            <tr>
                                <th style={{ width: '4%' }}>#</th>
                                <th style={{ width: '18%' }}>Employee</th>
                                <th style={{ width: '15%' }}>Period</th>
                                <th className="text-right" style={{ width: '10%' }}>Basic</th>
                                <th className="text-right" style={{ width: '10%' }}>Allowances</th>
                                <th className="text-right" style={{ width: '10%' }}>Deductions</th>
                                <th className="text-right" style={{ width: '12%' }}>Net Salary</th>
                                <th className="text-center" style={{ width: '10%' }}>Status</th>
                                <th className="text-center" style={{ width: '11%' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="9" className="p-12 text-center text-slate-400 font-medium italic">
                                    Loading history...
                                </td></tr>
                            ) : payrolls.length === 0 ? (
                                <tr><td colSpan="9" className="p-12 text-center text-slate-400 italic">No payroll records match your criteria</td></tr>
                            ) : (
                                payrolls.map((p, index) => (
                                    <tr key={p.id}>
                                        <td className="text-slate-500">{index + 1}</td>
                                        <td>
                                            <div className="font-bold text-slate-800">{p.user?.name}</div>
                                            <div className="text-[10px] text-slate-400">@{p.user?.username}</div>
                                        </td>
                                        <td>
                                            <div className="font-bold text-slate-700">{p.month} {p.year}</div>
                                            <div className="text-[10px] text-slate-400 uppercase tracking-tighter italic">
                                                {p.fromDate ? new Date(p.fromDate).toLocaleDateString() : '?'} - {p.toDate ? new Date(p.toDate).toLocaleDateString() : '?'}
                                            </div>
                                        </td>
                                        <td className="text-right font-mono text-slate-600">
                                            {companyProfile?.currencySymbol || '₹'}{Number(p.basicSalary).toLocaleString()}
                                        </td>
                                        <td className="text-right font-mono text-emerald-600">
                                            +{Number(p.allowances).toLocaleString()}
                                        </td>
                                        <td className="text-right font-mono text-red-400">
                                            -{Number(p.deductions).toLocaleString()}
                                        </td>
                                        <td className="text-right font-mono font-black text-slate-900 text-sm">
                                            {companyProfile?.currencySymbol || '₹'}{Number(p.netSalary).toLocaleString()}
                                        </td>
                                        <td className="text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                                p.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                p.status === 'APPROVED' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                'bg-amber-50 text-amber-600 border-amber-100'
                                            }`}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="text-center">
                                            <button 
                                                onClick={() => setSelectedPayroll(p)}
                                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                title="View Pay Slip"
                                            >
                                                <FiPrinter size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Summary Footer */}
                {!loading && payrolls.length > 0 && (
                    <div className="bg-slate-50 border-t border-slate-300 px-6 py-3 flex justify-between items-center text-xs">
                        <div className="text-slate-500">
                            Showing <span className="font-bold text-slate-700">{payrolls.length}</span> payroll records
                        </div>
                        <div className="flex gap-8">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Allowances</span>
                                <span className="font-mono font-bold text-emerald-600 text-sm">
                                    {companyProfile?.currencySymbol || '₹'}{payrolls.reduce((sum, p) => sum + Number(p.allowances), 0).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Deductions</span>
                                <span className="font-mono font-bold text-red-400 text-sm">
                                    {companyProfile?.currencySymbol || '₹'}{payrolls.reduce((sum, p) => sum + Number(p.deductions), 0).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Net Payable</span>
                                <span className="font-mono font-black text-slate-900 text-base">
                                    {companyProfile?.currencySymbol || '₹'}{payrolls.reduce((sum, p) => sum + Number(p.netSalary), 0).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Payslip Modal */}
            {selectedPayroll && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] border border-slate-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                    <FiFileText className="text-slate-600" />
                                </div>
                                <h3 className="font-bold text-slate-800 tracking-tight">Employee Pay Slip</h3>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-all shadow-sm">
                                    <FiPrinter /> Print Slip
                                </button>
                                <button onClick={() => setSelectedPayroll(null)} className="p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-lg transition-all">
                                    <FiX size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 bg-slate-50" ref={slipRef}>
                            <div className="bg-white p-12 shadow-sm rounded-xl max-w-3xl mx-auto border border-slate-100 print:shadow-none print:border-none print:p-0">
                                {/* Company Header */}
                                <div className="flex justify-between items-start border-b border-slate-200 pb-8 mb-8">
                                    <div className="space-y-1">
                                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{companyProfile?.companyName}</h2>
                                        <p className="text-slate-500 text-sm font-medium max-w-xs leading-relaxed">{companyProfile?.address}, {companyProfile?.city}, {companyProfile?.state}</p>
                                        <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider pt-1">GSTIN: {companyProfile?.gstin}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] mb-4 inline-block">Payslip</div>
                                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Month & Year</p>
                                        <p className="text-slate-900 font-black text-lg">{selectedPayroll.month} {selectedPayroll.year}</p>
                                    </div>
                                </div>

                                {/* Employee & Summary Grid */}
                                <div className="grid grid-cols-2 gap-12 mb-10">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Employee Information</h4>
                                        <div className="space-y-2.5">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400 font-medium">Name:</span>
                                                <span className="text-slate-900 font-bold uppercase">{selectedPayroll.user?.name}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400 font-medium">Designation:</span>
                                                <span className="text-slate-900 font-bold">{selectedPayroll.user?.employeeProfile?.designation || '-'}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400 font-medium">Employee Code:</span>
                                                <span className="text-slate-900 font-mono font-bold">{selectedPayroll.user?.employeeProfile?.employeeCode || '-'}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400 font-medium">Joining Date:</span>
                                                <span className="text-slate-900 font-bold">{selectedPayroll.user?.employeeProfile?.joiningDate ? new Date(selectedPayroll.user.employeeProfile.joiningDate).toLocaleDateString() : '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Attendance Summary</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Days</p>
                                                <p className="text-slate-900 font-black text-lg">{selectedPayroll.totalDays}</p>
                                            </div>
                                            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
                                                <p className="text-[9px] font-black text-emerald-600/60 uppercase tracking-widest mb-1">Present</p>
                                                <p className="text-emerald-700 font-black text-lg">{selectedPayroll.presentDays}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Earnings & Deductions Table */}
                                <div className="grid grid-cols-2 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden mb-10">
                                    <div className="bg-white p-6">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Earnings</h4>
                                        <div className="space-y-3">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Basic Salary</span>
                                                <span className="text-slate-900 font-bold">{Number(selectedPayroll.basicSalary).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Incentives</span>
                                                <span className="text-slate-900 font-bold">{Number(selectedPayroll.incentives).toLocaleString()}</span>
                                            </div>
                                            <div className="pt-3 border-t border-slate-100 flex justify-between text-sm font-black">
                                                <span className="text-slate-900 uppercase tracking-widest text-[10px]">Gross Earnings</span>
                                                <span className="text-slate-900">{Number(selectedPayroll.grossSalary).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white p-6">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Deductions</h4>
                                        <div className="space-y-3">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Absence Deduction</span>
                                                <span className="text-red-600 font-bold">-{Number(selectedPayroll.deductions).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Salary Advance</span>
                                                <span className="text-red-600 font-bold">-{Number(selectedPayroll.advanceDeduction || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="pt-3 border-t border-slate-100 flex justify-between text-sm font-black">
                                                <span className="text-slate-900 uppercase tracking-widest text-[10px]">Total Deductions</span>
                                                <span className="text-red-600">{Number(Number(selectedPayroll.deductions) + Number(selectedPayroll.advanceDeduction || 0)).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Net Salary Footer */}
                                <div className="bg-slate-900 rounded-2xl p-8 flex justify-between items-center text-white shadow-xl shadow-slate-900/10">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Net Payable Salary</p>
                                        <p className="text-xs text-slate-400 italic">Only {Number(selectedPayroll.netSalary).toLocaleString()} Rupees</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-3xl font-black tracking-tight"><span className="text-slate-500 text-lg mr-2">{companyProfile?.currencySymbol || '₹'}</span>{Number(selectedPayroll.netSalary).toLocaleString()}</p>
                                    </div>
                                </div>

                                {/* Signatures */}
                                <div className="flex justify-between mt-20 px-4">
                                    <div className="text-center">
                                        <div className="w-48 border-t border-slate-300 pt-3">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee Signature</p>
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="w-48 border-t border-slate-300 pt-3">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized Signatory</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-12 text-center">
                                    <p className="text-[9px] text-slate-300 font-bold uppercase tracking-[0.25em]">This is a computer generated document</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Bank Statement Modal */}
            {showBankStatement && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] border border-slate-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                                    <FiCreditCard className="text-emerald-600 text-xl" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg tracking-tight">Salary Statement for Bank</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{filters.month} {filters.year} • {payrolls.length} Employees</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handlePrintBankStatement} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95">
                                    <FiPrinter /> Print Document
                                </button>
                                <button onClick={() => setShowBankStatement(false)} className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all">
                                    <FiX size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-12 bg-slate-100" ref={bankStatementRef}>
                            <div className="bg-white p-16 shadow-lg rounded-[2rem] max-w-4xl mx-auto print:shadow-none print:p-0 print:m-0">
                                {/* Header */}
                                <div className="text-center border-b-2 border-slate-900 pb-8 mb-10">
                                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-1">{companyProfile?.companyName}</h2>
                                    <p className="text-slate-500 text-sm font-medium">{companyProfile?.address}, {companyProfile?.city}, {companyProfile?.state}</p>
                                    <p className="text-slate-500 text-xs mt-1 font-bold">GSTIN: {companyProfile?.gstin} | Pan: {companyProfile?.pan}</p>
                                </div>

                                <div className="flex justify-between items-end mb-8 border-b border-slate-100 pb-8">
                                    <div>
                                        <h3 className="text-lg font-black text-slate-800 uppercase underline decoration-2 underline-offset-4 mb-4 text-center w-full">SALARY DISBURSEMENT STATEMENT</h3>
                                        <div className="space-y-1 text-sm text-slate-600 font-medium text-left">
                                            <p><span className="font-black text-slate-900">Period:</span> {filters.month} {filters.year}</p>
                                            <p><span className="font-black text-slate-900">Branch:</span> {filters.userId ? users.find(u => u.id === parseInt(filters.userId))?.name : 'All Employees'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {companyProfile?.bank && (
                                            <div className="mb-4 text-xs text-left">
                                                <p className="font-black text-slate-400 uppercase tracking-widest text-[9px] mb-1 text-right">Source Bank Details</p>
                                                <p className="font-bold text-slate-800 text-right">{companyProfile.bank.name} - {companyProfile.bank.branchName}</p>
                                                <p className="text-slate-600 text-right">A/C: <span className="font-mono">{companyProfile.bank.accountNumber}</span></p>
                                                <p className="text-slate-600 text-[10px] text-right">IFSC: <span className="font-mono">{companyProfile.bank.ifscCode}</span></p>
                                            </div>
                                        )}
                                        <div className="text-[10px] font-bold text-slate-500 space-y-1">
                                            <p>Date: {new Date().toLocaleDateString()}</p>
                                            <p>Document No: BS-{filters.month?.substring(0,3).toUpperCase()}-{filters.year}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Table */}
                                <table className="w-full border-collapse border border-slate-300 text-xs mb-10">
                                    <thead>
                                        <tr className="bg-slate-50">
                                            <th className="border border-slate-300 p-2 text-center w-8">#</th>
                                            <th className="border border-slate-300 p-2 text-left">EMPLOYEE NAME</th>
                                            <th className="border border-slate-300 p-2 text-left">BANK NAME</th>
                                            <th className="border border-slate-300 p-2 text-left">ACCOUNT NUMBER</th>
                                            <th className="border border-slate-300 p-2 text-left">IFSC CODE</th>
                                            <th className="border border-slate-300 p-2 text-right">AMOUNT ({companyProfile?.currencySymbol || '₹'})</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payrolls.map((p, idx) => (
                                            <tr key={p.id} className="hover:bg-slate-50/50">
                                                <td className="border border-slate-300 p-2 text-center">{idx + 1}</td>
                                                <td className="border border-slate-300 p-2 font-bold uppercase">{p.user?.name}</td>
                                                <td className="border border-slate-300 p-2">{p.user?.employeeProfile?.bankName || '-'}</td>
                                                <td className="border border-slate-300 p-2 font-mono font-bold tracking-tight">{p.user?.employeeProfile?.accountNumber || '-'}</td>
                                                <td className="border border-slate-300 p-2 font-mono uppercase">{p.user?.employeeProfile?.ifscCode || '-'}</td>
                                                <td className="border border-slate-300 p-2 text-right font-black text-slate-900">{Number(p.netSalary).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-slate-100 font-black">
                                            <td colSpan="5" className="border border-slate-300 p-3 text-right text-sm uppercase">Total Payable Amount</td>
                                            <td className="border border-slate-300 p-3 text-right text-sm">{companyProfile?.currencySymbol || '₹'}{payrolls.reduce((s,p) => s + Number(p.netSalary), 0).toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Footer summary */}
                                <div className="mb-16">
                                    <p className="text-xs text-slate-500 font-black uppercase mb-1 tracking-widest">Total Amount in Words</p>
                                    <p className="border-b border-slate-300 pb-2 text-sm font-bold italic text-slate-700">
                                        Only {payrolls.reduce((s,p) => s + Number(p.netSalary), 0).toLocaleString()} {companyProfile?.currencyName || 'Rupees'}
                                    </p>
                                </div>

                                {/* Signatures */}
                                <div className="flex justify-between items-end mt-20 px-4">
                                    <div className="text-center w-56">
                                        <div className="border-t-2 border-slate-900 pt-3">
                                            <p className="text-[10px] font-black uppercase tracking-widest">Accountant / Prepared By</p>
                                        </div>
                                    </div>
                                    <div className="text-center w-56">
                                        <div className="border-t-2 border-slate-900 pt-3">
                                            <p className="text-[10px] font-black uppercase tracking-widest">Authorized Signatory</p>
                                            <p className="text-[8px] text-slate-400 mt-1 uppercase">For {companyProfile?.companyName}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-16 text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                                    This is a computer generated document and does not require a physical stamp unless specified.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
