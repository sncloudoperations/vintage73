import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import { FiPlus, FiTrash2, FiSave, FiUser, FiCalendar } from 'react-icons/fi';

export default function CreateQuotation() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        customerId: '',
        quotationDate: new Date().toISOString().split('T')[0],
        validUntil: '',
        notes: '',
        terms: '',
        isTaxInclusive: false,
        items: []
    });

    // Item Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [custRes, prodRes] = await Promise.all([
                api.get('/customers'),
                api.get('/products')
            ]);
            setCustomers(custRes.data);
            setProducts(prodRes.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load customers/products');
        }
    };

    useEffect(() => {
        if (searchTerm.length > 1) {
            const results = products.filter(p =>
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.barcode?.includes(searchTerm)
            );
            setSearchResults(results.slice(0, 5));
        } else {
            setSearchResults([]);
        }
    }, [searchTerm, products]);

    const addItem = (product) => {
        const existingItem = formData.items.find(i => i.productId === product.id);
        if (existingItem) {
            toast.info('Item already added');
            return;
        }

        const basePrice = Number(product.price);
        const taxRate = Number(product.taxRate || 0);
        // Simplified Logic: Assuming price is exclusive for calculation base, adjusted if inclusive

        const newItem = {
            productId: product.id,
            name: product.name,
            hsnCode: product.hsnCode || '',
            quantity: 1,
            unitPrice: basePrice,
            taxRate: taxRate,
            taxAmount: (basePrice * taxRate / 100),
            discountAmount: 0,
            discountPercent: 0,
            total: basePrice + (basePrice * taxRate / 100)
        };

        setFormData(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
        setSearchTerm('');
        setSearchResults([]);
    };

    const updateItem = (index, field, value) => {
        const newItems = [...formData.items];
        const item = { ...newItems[index] };

        if (field === 'discountPercent') {
            item.discountPercent = parseFloat(value) || 0;
            item.discountAmount = (item.unitPrice * item.discountPercent) / 100;
        } else if (field === 'discountAmount') {
            item.discountAmount = parseFloat(value) || 0;
            item.discountPercent = (item.discountAmount / item.unitPrice) * 100;
        } else {
            item[field] = Number(value);
        }

        // Recalculate
        const baseTotal = item.quantity * item.unitPrice;
        const tax = baseTotal * (item.taxRate / 100);
        item.taxAmount = tax;
        item.total = baseTotal + tax - (item.discountAmount * item.quantity);

        newItems[index] = item;
        setFormData({ ...formData, items: newItems });
    };

    const removeItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    const calculateGrandTotal = () => {
        return formData.items.reduce((sum, item) => sum + item.total, 0);
    };

    const handleSubmit = async () => {
        if (!formData.customerId || formData.items.length === 0) {
            toast.error('Please select customer and add items');
            return;
        }

        setLoading(true);
        try {
            const storedUser = localStorage.getItem('user');
            const branchId = storedUser ? JSON.parse(storedUser).branchId : null;

            if (!branchId) {
                toast.error('Branch not found. Please relogin.');
                return;
            }

            // Clean data before sending (remove hsnCode if not in schema, though extra fields are usually ignored or we can keep it if backend handles it)
            // Backend Prisma create will fail if we send extra fields not in schema? 
            // Prisma usually complains about unknown fields. We should sanitize `items` before sending.

            const payloadItems = formData.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxRate: item.taxRate,
                taxAmount: item.taxAmount,
                discountAmount: item.discountAmount,
                discountPercent: item.discountPercent,
                total: item.total
            }));

            await api.post('/quotations', {
                ...formData,
                customerId: parseInt(formData.customerId),
                items: payloadItems,
                taxType: 'INTRA', // Default for new quotations, can be refined later if needed
                branchId
            });
            toast.success('Quotation created!');
            router.push('/sales/quotations');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to create');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="p-6 max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">New Quotation</h1>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="btn btn-primary flex items-center gap-2"
                    >
                        <FiSave /> Save Quotation
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                        <div className="flex gap-2">
                            <select
                                className="input flex-1"
                                value={formData.customerId}
                                onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                            >
                                <option value="">Select Customer</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quotation Date</label>
                        <input
                            type="date"
                            className="input w-full"
                            value={formData.quotationDate}
                            onChange={e => setFormData({ ...formData, quotationDate: e.target.value })}
                        />
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                        <input
                            type="date"
                            className="input w-full"
                            value={formData.validUntil}
                            onChange={e => setFormData({ ...formData, validUntil: e.target.value })}
                        />
                    </div>
                </div>

                {/* Product Search */}
                <div className="bg-white p-6 rounded-lg shadow-sm mb-6 relative">
                    <h2 className="text-lg font-semibold mb-4">Add Items</h2>
                    <input
                        className="input w-full"
                        placeholder="Search products by name or barcode..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />

                    {searchResults.length > 0 && (
                        <div className="absolute z-10 w-full left-0 mt-1 bg-white border border-gray-200 shadow-xl rounded-md overflow-hidden">
                            {searchResults.map(prod => (
                                <div
                                    key={prod.id}
                                    className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0 flex justify-between"
                                    onClick={() => addItem(prod)}
                                >
                                    <span className="font-medium">{prod.name}</span>
                                    <span className="text-gray-500">HSN: {prod.hsnCode} | ₹{prod.price}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Items Table */}
                    <div className="mt-6 overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-200 text-sm font-medium text-gray-500">
                                    <th className="pb-3">Product</th>
                                    <th className="pb-3 w-20">HSN</th>
                                    <th className="pb-3 w-24">Qty</th>
                                    <th className="pb-3 w-32">Price</th>
                                    <th className="pb-3 w-32">Discount</th>
                                    <th className="pb-3 w-20">Tax %</th>
                                    <th className="pb-3 w-32">Total</th>
                                    <th className="pb-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {formData.items.map((item, index) => (
                                    <tr key={index}>
                                        <td className="py-3 pr-4">{item.name}</td>
                                        <td className="py-3 text-sm text-gray-500">{item.hsnCode}</td>
                                        <td className="py-3">
                                            <input
                                                type="number"
                                                className="input w-20 px-2 py-1 text-sm"
                                                min="1"
                                                value={item.quantity}
                                                onChange={e => updateItem(index, 'quantity', e.target.value)}
                                            />
                                        </td>
                                        <td className="py-3">
                                            <input
                                                type="number"
                                                className="input w-24 px-2 py-1 text-sm"
                                                value={item.unitPrice}
                                                onChange={e => updateItem(index, 'unitPrice', e.target.value)}
                                            />
                                        </td>
                                        <td className="py-3">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        className="input w-16 px-1 py-1 text-xs"
                                                        placeholder="%"
                                                        value={item.discountPercent}
                                                        onChange={e => updateItem(index, 'discountPercent', e.target.value)}
                                                    />
                                                    <span className="text-[10px] text-gray-400">%</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        className="input w-16 px-1 py-1 text-xs"
                                                        placeholder="Amt"
                                                        value={item.discountAmount}
                                                        onChange={e => updateItem(index, 'discountAmount', e.target.value)}
                                                    />
                                                    <span className="text-[10px] text-gray-400">₹</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 text-sm text-gray-600">{item.taxRate}%</td>
                                        <td className="py-3 font-bold">₹{item.total.toFixed(2)}</td>
                                        <td className="py-3 text-right">
                                            <button onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                                                <FiTrash2 />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-100">
                                    <td colSpan="5" className="text-right py-4 font-bold text-gray-600">Grand Total:</td>
                                    <td colSpan="2" className="py-4 text-xl font-bold text-blue-600">
                                        ₹{calculateGrandTotal().toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Terms</label>
                    <textarea
                        className="input w-full"
                        rows="3"
                        placeholder="Additional notes for the customer..."
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    />
                </div>
            </div>
        </>
    );
}

