import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiSave, FiUser, FiShoppingBag, FiLayers, FiInfo, FiTrendingUp, FiDollarSign, FiX } from 'react-icons/fi';
import Link from 'next/link';
import moment from 'moment';
import { useRouter } from 'next/router';

export default function CreateLead() {
    const [currentStep, setCurrentStep] = useState(1);
    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        source: 'Walk-in',
        productId: '',
        quantity: '1',
        budget: '',
        negotiationAmount: '',
        priority: 'MEDIUM',
        assignedTo: '',
        branchId: '',
        referredById: '',
        commissionPercentage: '5',
        notes: '',
        followUpDate: ''
    });
    const [products, setProducts] = useState([]);
    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetchProducts();
        fetchUsers();
        fetchBranches();
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

    const fetchBranches = async () => {
        try {
            const res = await api.get('/branches');
            setBranches(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => {
            const newForm = { ...prev, [name]: value };
            
            // Auto-calculate Budget
            if (name === 'productId' || name === 'quantity') {
                const product = products.find(p => p.id.toString() === newForm.productId);
                if (product) {
                    const price = parseFloat(product.price);
                    const qty = parseInt(newForm.quantity || 1);
                    newForm.budget = (price * qty).toFixed(2);
                    // Also set negotiation amount same as budget initially
                    if (!prev.negotiationAmount || prev.negotiationAmount === prev.budget) {
                        newForm.negotiationAmount = newForm.budget;
                    }
                }
            }
            return newForm;
        });
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
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

    // Calculate commission for display
    const commissionDisplay = (parseFloat(form.negotiationAmount || 0) * parseFloat(form.commissionPercentage || 0) / 100).toFixed(2);

    const steps = [
        { id: 1, title: 'Customer Info' },
        { id: 2, title: 'Lead Details' },
        { id: 3, title: 'Final Notes' }
    ];

    return (
        <div className="fixed inset-0 z-[50] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto pt-10 pb-10">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <header className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight">Create New Lead</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Initialize a new sales opportunity</p>
                    </div>
                    <button 
                        onClick={() => router.push('/crm/leads')}
                        className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:rotate-90 transition-all duration-300"
                    >
                        <FiX className="text-xl" />
                    </button>
                </header>

                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Progress Pipeline */}
                    <div className="px-12 py-6 bg-slate-50/30 border-b border-slate-100 flex-shrink-0">
                        <div className="flex items-center justify-between relative max-w-2xl mx-auto">
                            {/* Connector Line */}
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-full bg-slate-200 -z-0">
                                <div 
                                    className="h-full bg-primary transition-all duration-500 shadow-[0_0_10px_2px_rgba(var(--primary-rgb),0.2)]" 
                                    style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                                ></div>
                            </div>

                            {steps.map((s) => (
                                <div key={s.id} className="relative z-10 flex flex-col items-center gap-2 group">
                                    <div 
                                        className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all duration-300 border-4 ${
                                            currentStep >= s.id 
                                            ? 'bg-primary border-primary/20 text-white shadow-lg shadow-primary/20' 
                                            : 'bg-white border-slate-100 text-slate-400'
                                        }`}
                                    >
                                        {currentStep > s.id ? '✓' : s.id}
                                    </div>
                                    <span className={`text-[10px] uppercase tracking-widest font-black transition-colors ${currentStep >= s.id ? 'text-slate-800' : 'text-slate-400'}`}>
                                        {s.title}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-12 scrollbar-hide">
                        <form onSubmit={(e) => { e.preventDefault(); if(currentStep === 3) handleSubmit(); }} className="space-y-8 max-w-2xl mx-auto">
                            {currentStep === 1 && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-8">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold leading-none"><FiUser /></div>
                                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-[10px]">Customer Information</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer Name <span className="text-red-500">*</span></label>
                                            <input required name="name" className="input bg-white border-slate-200 focus:ring-4 focus:ring-primary/5 transition-all font-semibold" value={form.name} onChange={handleChange} placeholder="Full Name" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number <span className="text-red-500">*</span></label>
                                            <input required name="phone" className="input bg-white border-slate-200 focus:ring-4 focus:ring-primary/5 transition-all font-semibold uppercase" value={form.phone} onChange={handleChange} placeholder="+91..." />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                            <input type="email" name="email" className="input bg-white border-slate-200 focus:ring-4 focus:ring-primary/5 transition-all font-semibold" value={form.email} onChange={handleChange} placeholder="example@mail.com" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Branch Location <span className="text-red-500">*</span></label>
                                            <select required name="branchId" className="input bg-white border-slate-200 focus:ring-4 focus:ring-primary/5 transition-all font-bold" value={form.branchId} onChange={handleChange}>
                                                <option value="">Select Branch</option>
                                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {currentStep === 2 && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-8">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold leading-none"><FiShoppingBag /></div>
                                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-[10px]">Lead & Interest Details</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lead Source</label>
                                            <select name="source" className="input bg-white border-slate-200 font-bold" value={form.source} onChange={handleChange}>
                                                <option value="Walk-in">Walk-in</option>
                                                <option value="Website">Website</option>
                                                <option value="Call">Phone Call</option>
                                                <option value="WhatsApp">WhatsApp</option>
                                                <option value="Social Media">Social Media</option>
                                                <option value="Referral">Referral</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Interested</label>
                                            <select name="productId" className="input bg-white border-slate-200 font-bold" value={form.productId} onChange={handleChange}>
                                                <option value="">Select a Product</option>
                                                {products.map(p => <option key={p.id} value={p.id}>{p.name} - ₹{p.price}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity</label>
                                            <input type="number" name="quantity" className="input bg-white border-slate-200 text-center font-black text-primary" value={form.quantity} onChange={handleChange} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-1">Initial Budget (₹)</label>
                                            <input readOnly tabIndex="-1" type="number" name="budget" className="input bg-emerald-50/30 border-emerald-100 font-black text-emerald-600 outline-none cursor-default" value={form.budget} onChange={handleChange} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Negotiation Amt (₹)</label>
                                            <input type="number" name="negotiationAmount" className="input bg-blue-50/30 border-blue-100 font-black text-blue-600" value={form.negotiationAmount} onChange={handleChange} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lead Priority</label>
                                            <select name="priority" className="input bg-white border-slate-200 font-bold" value={form.priority} onChange={handleChange}>
                                                <option value="LOW">Low</option>
                                                <option value="MEDIUM">Medium</option>
                                                <option value="HIGH">High</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Specialist</label>
                                            <select name="assignedTo" className="input bg-white border-slate-200 font-bold" value={form.assignedTo} onChange={handleChange}>
                                                <option value="">Unassigned</option>
                                                {users.map(u => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Follow-up Date <span className="text-red-500">*</span></label>
                                            <input required type="datetime-local" name="followUpDate" className="input bg-white border-slate-200 font-bold" value={form.followUpDate} onChange={handleChange} />
                                        </div>
                                    </div>

                                    {form.source === 'Referral' && (
                                        <div className="p-6 bg-purple-50 rounded-2xl border border-purple-100 animate-in slide-in-from-top duration-300">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg text-[10px] font-bold"><FiTrendingUp /></div>
                                                <h3 className="font-black text-slate-800 uppercase tracking-widest text-[9px]">Referral Commission Logic</h3>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                                                <div className="space-y-1.5">
                                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Referred By</label>
                                                    <select name="referredById" className="input bg-white border-purple-100 font-bold" value={form.referredById} onChange={handleChange}>
                                                        <option value="">Select Referrer</option>
                                                        {users.filter(u => !form.branchId || u.branchId.toString() === form.branchId).map(u => (
                                                            <option key={u.id} value={u.id}>{u.name || u.username}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-1 space-y-1.5">
                                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Comm %</label>
                                                        <input type="number" name="commissionPercentage" className="input bg-white border-purple-100 font-black text-purple-600 pr-8" value={form.commissionPercentage} onChange={handleChange} />
                                                    </div>
                                                    <div className="flex-1 bg-white p-3 rounded-xl border border-purple-100 shadow-sm text-center">
                                                        <p className="text-[8px] font-black text-purple-400 uppercase tracking-widest leading-none">Total Est.</p>
                                                        <p className="text-sm font-black text-purple-600 mt-1">₹{commissionDisplay}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {currentStep === 3 && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-8">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-amber-50 text-amber-600 rounded-xl text-xs font-bold leading-none"><FiLayers /></div>
                                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-[10px]">Requirements & Final Notes</h3>
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Internal Notes / Requirements</label>
                                            <textarea name="notes" className="input bg-white border-slate-200 min-h-[150px] font-medium text-slate-700" value={form.notes} onChange={handleChange} placeholder="What does the customer actually need?"></textarea>
                                        </div>
                                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                                            <div className="mt-0.5"><FiInfo className="text-amber-500" /></div>
                                            <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
                                                Review all information before saving. Once created, the lead will appear in the "Contacted" stage of your CRM pipeline.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>
                </div>

                {/* Modal Footer */}
                <footer className="p-6 bg-slate-100/50 border-t border-slate-100 flex justify-between items-center flex-shrink-0">
                    <div>
                        <button type="button" onClick={() => router.push('/crm/leads')} className="px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">Discard Draft</button>
                    </div>
                    <div className="flex gap-3">
                        {currentStep > 1 && (
                            <button 
                                type="button" 
                                onClick={() => setCurrentStep(prev => prev - 1)}
                                className="px-8 pr-12 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border-2 border-slate-200 text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2"
                            >
                                <span className="text-lg">←</span> Back
                            </button>
                        )}
                        
                        {currentStep < 3 ? (
                            <button 
                                type="button" 
                                onClick={() => setCurrentStep(prev => prev + 1)}
                                className="bg-primary text-white px-12 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
                            >
                                Next <span className="text-lg">→</span>
                            </button>
                        ) : (
                            <button 
                                type="button" 
                                onClick={() => handleSubmit()}
                                disabled={loading} 
                                className="bg-slate-900 text-white px-12 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 ring-4 ring-slate-900/10"
                            >
                                {loading ? 'Processing...' : <><FiSave className="text-sm" /> Save Lead</>}
                            </button>
                        )}
                    </div>
                </footer>
            </div>
        </div>
    );
}
