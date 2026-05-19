import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiSave, FiUser, FiShoppingBag, FiLayers, FiInfo, FiTrendingUp, FiDollarSign, FiX } from 'react-icons/fi';
import Link from 'next/link';
import moment from 'moment';
import { useRouter } from 'next/router';
import SearchableSelect from '@/components/SearchableSelect';

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
    const [existingLeadWarning, setExistingLeadWarning] = useState(false);
    const router = useRouter();
    const { id } = router.query;
    const isEdit = !!id;

    useEffect(() => {
        fetchProducts();
        fetchUsers();
        fetchBranches();
    }, []);

    useEffect(() => {
        if (id) {
            fetchLeadDetails(id);
        }
    }, [id]);

    const fetchLeadDetails = async (leadId) => {
        setLoading(true);
        try {
            const res = await api.get(`/crm/leads/${leadId}`);
            const lead = res.data;
            setForm({
                name: lead.name || '',
                email: lead.email || '',
                phone: lead.phone || '',
                address: lead.address || '',
                source: lead.source || 'Walk-in',
                productId: lead.productId?.toString() || '',
                quantity: lead.quantity?.toString() || '1',
                budget: lead.budget?.toString() || '',
                negotiationAmount: lead.negotiationAmount?.toString() || '',
                priority: lead.priority || 'MEDIUM',
                assignedTo: lead.assignedTo?.toString() || '',
                branchId: lead.branchId?.toString() || '',
                referredById: lead.referredById?.toString() || '',
                commissionPercentage: lead.commissionPercentage?.toString() || '5',
                notes: lead.notes || '',
                followUpDate: lead.followUpDate ? moment(lead.followUpDate).format('YYYY-MM-DDTHH:mm') : ''
            });
        } catch (err) {
            toast.error("Failed to fetch lead details");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

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

    const checkExistingPhone = async (phone) => {
        if (!phone || phone.length < 5) {
            setExistingLeadWarning(false);
            return;
        }
        try {
            const res = await api.get(`/crm/leads?search=${phone}`);
            const exists = res.data.some(l => l.phone === phone);
            setExistingLeadWarning(exists);
        } catch (err) {
            console.error('Failed to check existing phone');
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        try {
            if (isEdit) {
                await api.put(`/crm/leads/${id}`, form);
                toast.success("Lead updated successfully");
            } else {
                await api.post('/crm/leads', form);
                toast.success("Lead created successfully");
            }
            router.push('/crm/leads');
        } catch (err) {
            toast.error(err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} lead`);
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
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
            <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl w-full max-w-4xl flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] mx-auto animate-in fade-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <header className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 bg-white flex justify-between items-center flex-shrink-0 rounded-t-[1.5rem] sm:rounded-t-[2rem]">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight">{isEdit ? 'Edit Lead' : 'Create New Lead'}</h1>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">{isEdit ? 'Update lead information' : 'Initialize a new sales opportunity'}</p>
                    </div>
                    <button 
                        onClick={() => router.push('/crm/leads')}
                        className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all duration-300"
                    >
                        <FiX className="text-xl" />
                    </button>
                </header>

                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                    {/* Progress Pipeline */}
                    <div className="px-5 py-3 sm:px-6 sm:py-5 bg-slate-50/50 border-b border-slate-100 flex-shrink-0">
                        <div className="flex items-center justify-between relative max-w-2xl mx-auto">
                            {/* Connector Line */}
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-full bg-slate-200 -z-0">
                                <div 
                                    className="h-full bg-primary transition-all duration-500 shadow-[0_0_10px_2px_rgba(var(--primary-rgb),0.2)]" 
                                    style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                                ></div>
                            </div>

                            {steps.map((s) => (
                                <div key={s.id} className="relative z-10 flex flex-col items-center gap-1 group">
                                    <div 
                                        className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-xs md:text-sm transition-all duration-300 border-2 md:border-4 ${
                                            currentStep >= s.id 
                                            ? 'bg-primary border-primary/20 text-white shadow-lg shadow-primary/20' 
                                            : 'bg-white border-slate-100 text-slate-400'
                                        }`}
                                    >
                                        {currentStep > s.id ? '✓' : s.id}
                                    </div>
                                    <span className={`text-[8px] md:text-[10px] uppercase tracking-widest font-black transition-colors ${currentStep >= s.id ? 'text-slate-800' : 'text-slate-400'}`}>
                                        {s.title.split(' ')[0]}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar min-h-0">
                        <form onSubmit={(e) => { e.preventDefault(); if(currentStep === 3) handleSubmit(); }} className="space-y-8 max-w-2xl mx-auto">
                            {currentStep === 1 && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4 sm:space-y-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-medium leading-none"><FiUser /></div>
                                        <h3 className="font-medium text-slate-800 uppercase tracking-widest text-[10px]">Customer Information</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 p-4 sm:p-6 bg-slate-50 rounded-[1.25rem] border border-slate-100 shadow-sm">
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Customer Name <span className="text-red-500">*</span></label>
                                            <input required name="name" className="input min-h-[46px] bg-white border-slate-200 focus:ring-4 focus:ring-primary/5 transition-all font-semibold text-sm" value={form.name} onChange={handleChange} placeholder="Full Name" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Phone Number <span className="text-red-500">*</span></label>
                                            <input required name="phone" className="input min-h-[46px] text-sm bg-white border-slate-200 focus:ring-4 focus:ring-primary/5 transition-all font-semibold uppercase" value={form.phone} onChange={handleChange} onBlur={(e) => checkExistingPhone(e.target.value)} placeholder="+91..." />
                                            {existingLeadWarning && (
                                                <p className="text-[10px] text-amber-500 font-medium ml-1 flex items-center gap-1">
                                                    <FiInfo /> This customer already has previous leads.
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                            <input type="email" name="email" className="input min-h-[46px] text-sm bg-white border-slate-200 focus:ring-4 focus:ring-primary/5 transition-all font-semibold" value={form.email} onChange={handleChange} placeholder="example@mail.com" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Branch Location <span className="text-red-500">*</span></label>
                                            <SearchableSelect 
                                                options={branches.map(b => ({ label: b.name, value: b.id.toString() }))}
                                                value={form.branchId}
                                                onChange={(val) => setForm(prev => ({ ...prev, branchId: val }))}
                                                placeholder="Select Branch"
                                                triggerClassName="input min-h-[46px] text-sm bg-white border-slate-200 font-semibold text-slate-800"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {currentStep === 2 && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4 sm:space-y-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-medium leading-none"><FiShoppingBag /></div>
                                        <h3 className="font-medium text-slate-800 uppercase tracking-widest text-[10px]">Lead & Interest Details</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 p-4 sm:p-6 bg-slate-50 rounded-[1.25rem] border border-slate-100 shadow-sm">
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Lead Source</label>
                                            <SearchableSelect 
                                                options={[
                                                    { label: 'Walk-in', value: 'Walk-in' },
                                                    { label: 'Website', value: 'Website' },
                                                    { label: 'Phone Call', value: 'Call' },
                                                    { label: 'WhatsApp', value: 'WhatsApp' },
                                                    { label: 'Social Media', value: 'Social Media' },
                                                    { label: 'Referral', value: 'Referral' }
                                                ]}
                                                value={form.source}
                                                onChange={(val) => setForm(prev => ({ ...prev, source: val }))}
                                                placeholder="Select Source"
                                                direction="down"
                                                triggerClassName="input min-h-[46px] text-sm bg-white border-slate-200 font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Product Interested</label>
                                            <SearchableSelect 
                                                options={products.map(p => ({ label: `${p.name} - ₹${p.price}`, value: p.id.toString() }))}
                                                value={form.productId}
                                                onChange={(val) => setForm(prev => ({ ...prev, productId: val }))}
                                                placeholder="Select a Product"
                                                triggerClassName="input min-h-[46px] text-sm bg-white border-slate-200 font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Quantity</label>
                                            <input type="number" name="quantity" className="input min-h-[46px] text-sm bg-white border-slate-200 text-center font-medium text-primary" value={form.quantity} onChange={handleChange} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-medium text-emerald-500 uppercase tracking-widest ml-1">Initial Budget (₹)</label>
                                            <input type="number" name="budget" className="input min-h-[46px] text-sm bg-emerald-50/30 border-emerald-100 font-medium text-emerald-600 outline-none" value={form.budget} onChange={handleChange} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-medium text-blue-500 uppercase tracking-widest ml-1">Negotiation Amt (₹)</label>
                                            <input type="number" name="negotiationAmount" className="input min-h-[46px] text-sm bg-blue-50/30 border-blue-100 font-medium text-blue-600" value={form.negotiationAmount} onChange={handleChange} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Lead Priority</label>
                                            <SearchableSelect 
                                                options={[
                                                    { label: 'Low', value: 'LOW' },
                                                    { label: 'Medium', value: 'MEDIUM' },
                                                    { label: 'High', value: 'HIGH' }
                                                ]}
                                                value={form.priority}
                                                onChange={(val) => setForm(prev => ({ ...prev, priority: val }))}
                                                placeholder="Select Priority"
                                                direction="down"
                                                triggerClassName="input min-h-[46px] text-sm bg-white border-slate-200 font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Assigned Specialist</label>
                                            <SearchableSelect 
                                                options={users.map(u => ({ label: u.name || u.username, value: u.id.toString() }))}
                                                value={form.assignedTo}
                                                onChange={(val) => setForm(prev => ({ ...prev, assignedTo: val }))}
                                                placeholder="Unassigned"
                                                triggerClassName="input min-h-[46px] text-sm bg-white border-slate-200 font-semibold text-slate-800"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Follow-up Date <span className="text-red-500">*</span></label>
                                            <input required type="datetime-local" name="followUpDate" className="input min-h-[46px] text-sm bg-white border-slate-200 font-medium" value={form.followUpDate} onChange={handleChange} />
                                        </div>
                                    </div>

                                    {form.source && /referral|refferal/i.test(form.source) && (
                                        <div className="p-4 sm:p-6 bg-purple-50 rounded-[1.25rem] border border-purple-100 animate-in slide-in-from-top duration-300">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg text-[10px] font-medium"><FiTrendingUp /></div>
                                                <h3 className="font-medium text-slate-800 uppercase tracking-widest text-[9px]">Referral Commission Logic</h3>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-end">
                                                <div className="space-y-1.5">
                                                    <label className="block text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1">Referred By</label>
                                                    <SearchableSelect 
                                                        options={users.filter(u => !form.branchId || u.branchId?.toString() === form.branchId).map(u => ({ label: u.name || u.username, value: u.id.toString() }))}
                                                        value={form.referredById}
                                                        onChange={(val) => setForm(prev => ({ ...prev, referredById: val }))}
                                                        placeholder="Select Referrer"
                                                        triggerClassName="input min-h-[46px] text-[11px] bg-white border-purple-100 font-semibold text-slate-800"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-1 space-y-1.5">
                                                        <label className="block text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1">Comm %</label>
                                                        <input type="number" name="commissionPercentage" className="input min-h-[46px] text-sm bg-white border-purple-100 font-medium text-purple-600 pr-8" value={form.commissionPercentage} onChange={handleChange} />
                                                    </div>
                                                    <div className="flex-1 bg-white p-3 rounded-xl border border-purple-100 shadow-sm text-center">
                                                        <p className="text-[8px] font-extrabold text-purple-400 uppercase tracking-widest leading-none">Total Est.</p>
                                                        <p className="text-sm font-medium text-purple-600 mt-1">₹{commissionDisplay}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {currentStep === 3 && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4 sm:space-y-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-amber-50 text-amber-600 rounded-xl text-xs font-medium leading-none"><FiLayers /></div>
                                        <h3 className="font-medium text-slate-800 uppercase tracking-widest text-[10px]">Requirements & Final Notes</h3>
                                    </div>
                                    <div className="p-4 sm:p-6 bg-slate-50 rounded-[1.25rem] border border-slate-100 shadow-sm space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Internal Notes / Requirements</label>
                                            <textarea name="notes" className="input min-h-[46px] text-sm bg-white border-slate-200 min-h-[150px] font-medium text-slate-700" value={form.notes} onChange={handleChange} placeholder="What does the customer actually need?"></textarea>
                                        </div>
                                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                                            <div className="mt-0.5"><FiInfo className="text-amber-500" /></div>
                                            <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
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
                <footer className="px-4 py-4 sm:px-6 sm:py-5 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-3 flex-shrink-0 rounded-b-[1.5rem] sm:rounded-b-[2rem]">
                    <button type="button" onClick={() => router.push('/crm/leads')} className="px-3 sm:px-6 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all flex-shrink-0">Discard</button>
                    <div className="flex gap-2 sm:gap-3">
                        {currentStep > 1 && (
                            <button 
                                type="button" 
                                onClick={() => setCurrentStep(prev => prev - 1)}
                                className="px-5 sm:px-8 py-3 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-xs uppercase tracking-widest border-2 border-slate-200 text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-1 sm:gap-2 active:scale-95"
                            >
                                <span className="text-sm sm:text-lg">←</span> Back
                            </button>
                        )}
                        
                        {currentStep < 3 ? (
                            <button 
                                type="button" 
                                onClick={() => setCurrentStep(prev => prev + 1)}
                                className="bg-slate-900 text-white px-8 sm:px-12 py-3 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-xs uppercase tracking-widest shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all flex items-center gap-1 sm:gap-2 active:scale-95"
                            >
                                Next <span className="text-sm sm:text-lg">→</span>
                            </button>
                        ) : (
                            <button 
                                type="button" 
                                onClick={() => handleSubmit()}
                                disabled={loading} 
                                className="bg-primary text-white px-6 sm:px-12 py-3 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary-dark transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 sm:gap-2"
                            >
                                {loading ? 'Saving...' : <><FiSave className="text-sm" /> {isEdit ? 'Update' : 'Save'}</>}
                            </button>
                        )}
                    </div>
                </footer>
            </div>
        </div>
    );
}
