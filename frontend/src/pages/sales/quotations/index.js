import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { FiPlus, FiPrinter, FiEye, FiCheckCircle, FiFileText, FiDollarSign } from 'react-icons/fi';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';

export default function QuotationsList() {
    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetchQuotations();
    }, []);

    const fetchQuotations = async () => {
        try {
            const { data } = await api.get('/quotations');
            setQuotations(data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to fetch quotations');
        } finally {
            setLoading(false);
        }
    };

    const handleConvert = async (id) => {
        if (!confirm('Are you sure you want to convert this quotation to a Sale Invoice?')) return;
        try {
            await api.post(`/quotations/${id}/convert`);
            toast.success('Quotation converted to Sale successfully!');
            fetchQuotations();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Conversion failed');
        }
    };

    return (
        <Layout>
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Quotations</h1>
                        <p className="text-slate-500 text-sm">Manage and track customer quotations</p>
                    </div>
                    <button
                        onClick={() => router.push('/sales/quotations/create')}
                        className="btn btn-primary flex items-center gap-2"
                    >
                        <FiPlus /> New Quotation
                    </button>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Quote #</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {quotations.map((q) => (
                                <tr key={q.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {new Date(q.quotationDate).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-blue-600">
                                        {q.quotationNumber}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-800">
                                        {q.customer?.name || 'Walk-in'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-bold text-slate-700">
                                        ₹{Number(q.totalAmount).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                                            ${q.status === 'CONVERTED' ? 'bg-green-100 text-green-800' :
                                                q.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                                                    'bg-blue-100 text-blue-800'}`}>
                                            {q.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        {q.status !== 'CONVERTED' && (
                                            <button
                                                onClick={() => handleConvert(q.id)}
                                                className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center gap-1"
                                                title="Convert to Invoice"
                                            >
                                                <FiCheckCircle /> Convert
                                            </button>
                                        )}
                                        {/* Placeholders for View/Print - can be implemented similarly to Invoice */}
                                        <button className="text-slate-400 hover:text-blue-600"><FiEye /></button>
                                    </td>
                                </tr>
                            ))}
                            {quotations.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="6" className="text-center py-8 text-gray-400">
                                        No quotations found. Create one to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
}
