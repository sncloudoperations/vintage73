import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { FiPrinter, FiEye, FiCheckCircle, FiFileText, FiDollarSign, FiX, FiSearch } from 'react-icons/fi';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import { useReactToPrint } from 'react-to-print';
import DynamicInvoice from '@/components/DynamicInvoice';

export default function InvoicesList() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [companyProfile, setCompanyProfile] = useState(null);
    const [invoiceSettings, setInvoiceSettings] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();

    // Print/View State
    const [printData, setPrintData] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const printRef = useRef();
    const handlePrint = useReactToPrint({ contentRef: printRef });

    useEffect(() => {
        fetchInvoices();
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/company');
            setCompanyProfile(res.data);
            setInvoiceSettings(res.data?.invoiceSettings || null);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchInvoices = async () => {
        try {
            const { data } = await api.get('/sales?isInvoice=true');
            setInvoices(data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to fetch invoices');
        } finally {
            setLoading(false);
        }
    };

    const handleView = async (id) => {
        try {
            const { data } = await api.get(`/sales?id=${id}`);
            const invoice = Array.isArray(data) ? data[0] : data;
            
            // Format data for DynamicInvoice
            const formattedData = {
                ...invoice,
                items: invoice.items.map(item => ({
                    ...item,
                    name: item.product?.name || 'Unknown Product',
                    hsnCode: item.product?.hsnCode || ''
                }))
            };
            setPrintData(formattedData);
            setShowPreview(true);
        } catch (error) {
            toast.error('Failed to load invoice details');
        }
    };

    const handleDirectPrint = async (invoice) => {
        const formattedData = {
            ...invoice,
            items: invoice.items.map(item => ({
                ...item,
                name: item.product?.name || 'Unknown Product',
                hsnCode: item.product?.hsnCode || ''
            }))
        };
        setPrintData(formattedData);
        setTimeout(() => handlePrint(), 100);
    };

    const filteredInvoices = invoices.filter(inv => 
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.customer?.name && inv.customer.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Tax Invoices</h1>
                    <p className="text-slate-500 text-sm">View and manage converted quotation invoices</p>
                </div>
                <div className="relative w-full md:w-80">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Search invoice # or customer..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-primary bg-white shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold border-b text-sm uppercase tracking-wider">
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Invoice #</th>
                            <th className="px-6 py-4">Customer</th>
                            <th className="px-6 py-4 text-right">Total Amount</th>
                            <th className="px-6 py-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            Array(5).fill(0).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td colSpan="5" className="p-4 bg-slate-50/50"></td>
                                </tr>
                            ))
                        ) : filteredInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 text-sm text-slate-600">
                                    {new Date(inv.saleDate).toLocaleDateString('en-GB')}
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-primary">
                                    {inv.invoiceNumber}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-700">
                                    <div className="font-medium">{inv.customer?.name || 'Walk-in Customer'}</div>
                                    <div className="text-xs text-slate-400">{inv.customer?.phone}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-right font-bold text-slate-800">
                                    ₹{Number(inv.totalAmount).toFixed(2)}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex justify-center gap-3">
                                        <button
                                            onClick={() => handleView(inv.id)}
                                            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                            title="View Invoice"
                                        >
                                            <FiEye size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDirectPrint(inv)}
                                            className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                                            title="Print Invoice"
                                        >
                                            <FiPrinter size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!loading && filteredInvoices.length === 0 && (
                            <tr>
                                <td colSpan="5" className="text-center py-12 text-slate-400">
                                    <FiFileText className="mx-auto mb-2 text-4xl opacity-20" />
                                    No invoices found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Preview Modal */}
            {showPreview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative overflow-hidden flex flex-col h-[90vh]">
                        <div className="flex justify-between items-center p-4 border-b bg-white relative z-10">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Invoice Preview</h2>
                                <p className="text-xs text-slate-500">{printData?.invoiceNumber}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handlePrint()}
                                    className="bg-primary text-white flex items-center gap-2 px-6 py-2 rounded-lg font-bold hover:bg-primary-dark transition-all"
                                >
                                    <FiPrinter /> Print Invoice
                                </button>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
                                >
                                    <FiX size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 p-8 bg-slate-100 overflow-y-auto pattern-grid-slate-200">
                            <div className="mx-auto shadow-2xl bg-white max-w-[800px]">
                                <DynamicInvoice
                                    printData={printData}
                                    companyProfile={companyProfile}
                                    invoiceSettings={invoiceSettings}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Off-screen Print Container */}
            <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
                <div ref={printRef}>
                    {printData && (
                        <DynamicInvoice
                            printData={printData}
                            companyProfile={companyProfile}
                            invoiceSettings={invoiceSettings}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
