import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiSave, FiUser, FiShoppingBag, FiLayers, FiInfo } from 'react-icons/fi';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function CreateLead() {
    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        source: 'Walk-in',
        productId: '',
        quantity: '',
        budget: '',
        priority: 'MEDIUM',
        assignedTo: '',
        notes: ''
    });
    const [products, setProducts] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetchProducts();
        fetchUsers();
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await api.get('/products');
            setProducts(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/crm/leads', form);
            toast.success("Lead created successfully");
            router.push('/crm/leads');
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to create lead");
        } finally {

            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
            <header className="flex justify-between items-center">
                <Link href="/crm/leads" className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-bold text-sm">
                    <FiArrowLeft /> Back to Leads
                </Link>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Create New Lead</h1>
            </header>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Customer Details */}
                <div className="card shadow-sm border-slate-200">
                    <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm"><FiUser /></div>
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Customer Information</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Customer Name <span className="text-red-500">*</span></label>
                            <input required name="name" className="input bg-slate-50 border-transparent focus:bg-white" value={form.name} onChange={handleChange} placeholder="Full Name" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Phone Number <span className="text-red-500">*</span></label>
                            <input required name="phone" className="input bg-slate-50 border-transparent focus:bg-white" value={form.phone} onChange={handleChange} placeholder="+91..." />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Email Address</label>
                            <input type="email" name="email" className="input bg-slate-50 border-transparent focus:bg-white" value={form.email} onChange={handleChange} placeholder="example@mail.com" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Address</label>
                            <input name="address" className="input bg-slate-50 border-transparent focus:bg-white" value={form.address} onChange={handleChange} placeholder="City, State, Country" />
                        </div>
                    </div>
                </div>

                {/* Lead Details */}
                <div className="card shadow-sm border-slate-200">
                    <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg text-sm"><FiShoppingBag /></div>
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Lead Details</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Lead Source</label>
                            <select name="source" className="input bg-slate-50 border-transparent focus:bg-white" value={form.source} onChange={handleChange}>
                                <option value="Walk-in">Walk-in</option>
                                <option value="Website">Website</option>
                                <option value="Call">Phone Call</option>
                                <option value="WhatsApp">WhatsApp</option>
                                <option value="Social Media">Social Media</option>
                                <option value="Referral">Referral</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Interested Product</label>
                            <select name="productId" className="input bg-slate-50 border-transparent focus:bg-white" value={form.productId} onChange={handleChange}>
                                <option value="">Select a Product</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name} - ₹{p.price}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Quantity</label>
                            <input type="number" name="quantity" className="input bg-slate-50 border-transparent focus:bg-white" value={form.quantity} onChange={handleChange} placeholder="Estimated Quantity" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Budget (₹)</label>
                            <input type="number" name="budget" className="input bg-slate-50 border-transparent focus:bg-white" value={form.budget} onChange={handleChange} placeholder="Max Budget" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Priority</label>
                            <select name="priority" className="input bg-slate-50 border-transparent focus:bg-white" value={form.priority} onChange={handleChange}>
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Assign Employee</label>
                            <select name="assignedTo" className="input bg-slate-50 border-transparent focus:bg-white" value={form.assignedTo} onChange={handleChange}>
                                <option value="">Select Employee</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="card shadow-sm border-slate-200">
                    <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg text-sm"><FiInfo /></div>
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Notes / Description</h3>
                    </div>
                    <textarea name="notes" className="input bg-slate-50 border-transparent focus:bg-white min-h-[120px]" value={form.notes} onChange={handleChange} placeholder="Any specific requirements or conversation summary..."></textarea>
                </div>

                <div className="flex justify-end pt-4">
                    <button type="submit" disabled={loading} className="btn btn-primary px-12 py-4 shadow-xl shadow-emerald-500/30 flex items-center gap-2">
                        {loading ? <span className="animate-pulse">Saving...</span> : <><FiSave /> Save Lead</>}
                    </button>
                </div>
            </form>
        </div>
    );
}
