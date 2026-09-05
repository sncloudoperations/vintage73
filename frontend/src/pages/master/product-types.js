import { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
    FiPlus, FiEdit, FiTrash2, FiSearch, FiLayers, FiTag, FiX, FiCheck,
    FiChevronRight, FiChevronLeft, FiAlertTriangle
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import SearchableSelect from '@/components/SearchableSelect';

const GENDER_OPTIONS = ['Men', 'Women', 'Boy', 'Girl', 'Unisex'];

const SIZE_PRESETS = [
    { label: 'Alpha (S–3XL)', sizes: ['S', 'M', 'L', 'XL', 'XXL', '3XL'] },
    { label: 'Words', sizes: ['Small', 'Medium', 'Large', 'XL', 'XXL'] },
    { label: 'Numeric (28–40)', sizes: ['28', '30', '32', '34', '36', '38', '40'] },
    { label: 'Kids', sizes: ['2-3Y', '3-4Y', '4-5Y', '5-6Y', '6-7Y', '7-8Y'] },
    { label: 'Free Size', sizes: ['Free Size'] }
];

const STEPS = [
    { id: 1, label: 'Basic Info' },
    { id: 2, label: 'Gender' },
    { id: 3, label: 'Attributes' },
    { id: 4, label: 'Sizes' },
    { id: 5, label: 'Review' },
];

export default function ProductTypesMaster() {
    const [productTypes, setProductTypes] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingType, setEditingType] = useState(null);
    const [currentStep, setCurrentStep] = useState(1);

    const [formData, setFormData] = useState({
        name: '',
        categoryId: '',
        genders: [],
        attributes: [],
        sizes: [],
        isActive: true
    });

    const [newAttributeName, setNewAttributeName] = useState('');
    const [newOptionInputs, setNewOptionInputs] = useState({});
    const [newSizeInput, setNewSizeInput] = useState('');

    // ─── Data Fetch ───────────────────────────────────────────────────────────
    const fetchData = async () => {
        setLoading(true);
        try {
            const [ptRes, catRes] = await Promise.all([
                api.get('/product-types'),
                api.get('/categories')
            ]);
            setProductTypes(ptRes.data);
            setCategories(catRes.data);
        } catch (error) {
            toast.error('Failed to fetch product types');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // ─── Category Attribute Inheritance ──────────────────────────────────────
    // Fetches attributes directly configured for the category from the API
    const fetchCategoryAttributes = async (catId) => {
        if (!catId) return [];
        try {
            const { data } = await api.get(`/categories/${catId}/attributes`);
            const rawAttrs = Array.isArray(data) ? data : (Array.isArray(data?.attributes) ? data.attributes : []);
            return rawAttrs.map(a => ({
                name: typeof a === 'string' ? a : a.name,
                options: Array.isArray(a?.options) ? [...a.options] : [],
                inherited: true
            }));
        } catch (error) {
            console.error('Failed to fetch category attributes', error);
            const foundCat = categories.find(c => c.id.toString() === catId.toString());
            const fallbackAttrs = Array.isArray(foundCat?.attributes) ? foundCat.attributes : [];
            return fallbackAttrs.map(a => ({
                name: typeof a === 'string' ? a : a.name,
                options: Array.isArray(a?.options) ? [...a.options] : [],
                inherited: true
            }));
        }
    };

    // ─── Modal Open ──────────────────────────────────────────────────────────
    const openModal = async (pt = null) => {
        setCurrentStep(1);
        setNewAttributeName('');
        setNewOptionInputs({});
        setNewSizeInput('');

        if (pt) {
            // EDIT: load existing data exactly
            setEditingType(pt);
            const savedAttrs = Array.isArray(pt.attributes) ? JSON.parse(JSON.stringify(pt.attributes)) : [];
            setFormData({
                name: pt.name,
                categoryId: pt.categoryId.toString(),
                genders: Array.isArray(pt.genders) ? pt.genders : [],
                attributes: savedAttrs,
                sizes: Array.isArray(pt.sizes) ? [...pt.sizes] : [],
                isActive: pt.isActive !== undefined ? pt.isActive : true
            });
            setShowModal(true);

            // Fetch category attributes to correctly tag inherited vs custom attributes
            if (pt.categoryId) {
                try {
                    const catAttrs = await fetchCategoryAttributes(pt.categoryId);
                    const catAttrMap = new Map(catAttrs.map(a => [a.name.toLowerCase(), a]));
                    setFormData(prev => {
                        if (prev.categoryId !== pt.categoryId.toString()) return prev;
                        const merged = (prev.attributes || []).map(attr => {
                            const isInherited = catAttrMap.has(attr.name.toLowerCase());
                            const catAttr = catAttrMap.get(attr.name.toLowerCase());
                            return {
                                ...attr,
                                inherited: isInherited,
                                options: Array.isArray(attr.options) && attr.options.length > 0
                                    ? attr.options
                                    : (catAttr ? catAttr.options : [])
                            };
                        });
                        // Include any category attributes not yet present in saved attributes
                        const existingNames = new Set(merged.map(a => a.name.toLowerCase()));
                        const missingCatAttrs = catAttrs.filter(ca => !existingNames.has(ca.name.toLowerCase()));
                        return {
                            ...prev,
                            attributes: [...merged, ...missingCatAttrs]
                        };
                    });
                } catch (err) {
                    console.error('Error fetching category attributes for edit', err);
                }
            }
        } else {
            // NEW: start completely EMPTY – no category preselected, no genders, no attributes, no sizes
            setEditingType(null);
            setFormData({
                name: '',
                categoryId: '',
                genders: [],
                attributes: [],
                sizes: [],
                isActive: true
            });
            setShowModal(true);
        }
    };

    // ─── Category Change ──────────────────────────────────────────────────────
    const handleCategorySelect = async (newCatId) => {
        const newCatIdStr = (newCatId || '').toString();
        if (newCatIdStr === formData.categoryId) return;
        await applyCategoryChange(newCatIdStr);
    };

    const applyCategoryChange = async (catId) => {
        if (!catId) {
            setFormData(prev => ({
                ...prev,
                categoryId: '',
                attributes: prev.attributes.filter(a => !a.inherited)
            }));
            return;
        }

        const inherited = await fetchCategoryAttributes(catId);
        setFormData(prev => {
            // Remove previous category's inherited attributes, keep only custom
            const customAttrs = prev.attributes.filter(a => !a.inherited);
            const inheritedNames = new Set(inherited.map(a => a.name.toLowerCase()));
            const nonCollidingCustom = customAttrs.filter(a => !inheritedNames.has(a.name.toLowerCase()));
            return {
                ...prev,
                categoryId: catId,
                attributes: [...inherited, ...nonCollidingCustom]
            };
        });
    };

    // ─── Gender ──────────────────────────────────────────────────────────────
    const handleGenderToggle = (gender) => {
        setFormData(prev => {
            const exists = prev.genders.includes(gender);
            return {
                ...prev,
                genders: exists ? prev.genders.filter(g => g !== gender) : [...prev.genders, gender]
            };
        });
    };

    // ─── Attributes ──────────────────────────────────────────────────────────
    const handleAddAttribute = () => {
        const trimmed = (newAttributeName || '').trim();
        if (!trimmed) return;
        if (formData.attributes.some(a => a.name.toLowerCase() === trimmed.toLowerCase())) {
            toast.warning(`Attribute "${trimmed}" already added`);
            return;
        }
        setFormData(prev => ({
            ...prev,
            attributes: [...prev.attributes, { name: trimmed, options: [], inherited: false }]
        }));
        setNewAttributeName('');
    };

    const handleRemoveAttribute = (index) => {
        setFormData(prev => ({
            ...prev,
            attributes: prev.attributes.filter((_, idx) => idx !== index)
        }));
    };

    const handleAddOptionToAttribute = (attrIndex) => {
        const optText = (newOptionInputs[attrIndex] || '').trim();
        if (!optText) return;
        setFormData(prev => {
            const updated = [...prev.attributes];
            const currentOptions = updated[attrIndex].options || [];
            if (!currentOptions.includes(optText)) {
                updated[attrIndex] = { ...updated[attrIndex], options: [...currentOptions, optText] };
            }
            return { ...prev, attributes: updated };
        });
        setNewOptionInputs(prev => ({ ...prev, [attrIndex]: '' }));
    };

    const handleRemoveOptionFromAttribute = (attrIndex, optIndex) => {
        setFormData(prev => {
            const updated = [...prev.attributes];
            updated[attrIndex] = {
                ...updated[attrIndex],
                options: updated[attrIndex].options.filter((_, idx) => idx !== optIndex)
            };
            return { ...prev, attributes: updated };
        });
    };

    // ─── Sizes ───────────────────────────────────────────────────────────────
    const handleAddSize = () => {
        const trimmed = (newSizeInput || '').trim();
        if (!trimmed) return;
        if (formData.sizes.includes(trimmed)) {
            toast.warning(`Size "${trimmed}" is already in the list`);
            return;
        }
        setFormData(prev => ({ ...prev, sizes: [...prev.sizes, trimmed] }));
        setNewSizeInput('');
    };

    const handleRemoveSize = (sizeToRemove) => {
        setFormData(prev => ({ ...prev, sizes: prev.sizes.filter(s => s !== sizeToRemove) }));
    };

    const handleApplySizePreset = (presetSizes) => {
        setFormData(prev => ({ ...prev, sizes: [...presetSizes] }));
    };

    // ─── Step Navigation ──────────────────────────────────────────────────────
    const validateStep = (step) => {
        if (step === 1) {
            if (!formData.name.trim()) { toast.error('Product Type name is required'); return false; }
            if (!formData.categoryId) { toast.error('Please select a category'); return false; }
        }
        return true;
    };

    const handleNext = () => {
        if (!validateStep(currentStep)) return;
        setCurrentStep(prev => Math.min(prev + 1, 5));
    };

    const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));

    // ─── Submit ───────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!formData.name.trim()) { toast.error('Product Type name is required'); return; }
        if (!formData.categoryId) { toast.error('Please select a category'); return; }

        try {
            // Strip the frontend-only `inherited` flag before sending to API
            const cleanAttributes = formData.attributes.map(({ inherited, ...rest }) => rest);

            const payload = {
                name: formData.name.trim(),
                categoryId: parseInt(formData.categoryId),
                genders: formData.genders,
                attributes: cleanAttributes,
                sizes: formData.sizes,
                isActive: formData.isActive
            };

            if (editingType) {
                await api.put(`/product-types/${editingType.id}`, payload);
                toast.success('Product Type updated successfully');
            } else {
                await api.post('/product-types', payload);
                toast.success('Product Type created successfully');
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            const msg = error.response?.data?.message || error.response?.data?.error || 'Operation failed';
            toast.error(msg);
        }
    };

    // ─── Delete / Status ──────────────────────────────────────────────────────
    const handleDelete = async (pt) => {
        if (pt._count?.products > 0) {
            toast.error(`Cannot delete "${pt.name}" because it has ${pt._count.products} products linked.`);
            return;
        }
        if (!confirm(`Are you sure you want to delete Product Type "${pt.name}"?`)) return;
        try {
            await api.delete(`/product-types/${pt.id}`);
            toast.success('Product Type deleted successfully');
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete product type');
        }
    };

    const handleToggleStatus = async (pt) => {
        try {
            await api.put(`/product-types/${pt.id}`, { isActive: !pt.isActive });
            toast.success(`Product Type ${pt.isActive ? 'deactivated' : 'activated'} successfully`);
            fetchData();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    // ─── Derived ──────────────────────────────────────────────────────────────
    const filteredTypes = productTypes.filter(pt => {
        const matchesSearch = pt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (pt.category?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === '' || pt.categoryId.toString() === filterCategory.toString();
        return matchesSearch && matchesCategory;
    });

    const selectedCategory = categories.find(c => c.id.toString() === formData.categoryId?.toString());

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div>
            {/* ── Page Header ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Product Type Master</h1>
                    <p className="text-slate-500 text-sm font-medium">Configure category-dependent product types, gender groups, attributes and sizes</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <button
                        onClick={() => openModal()}
                        className="btn btn-primary shadow-primary/20 shadow-lg px-8 py-3 rounded-2xl text-[10px] uppercase font-medium tracking-widest w-full sm:w-auto whitespace-nowrap"
                    >
                        <FiPlus className="text-lg" /> Add Product Type
                    </button>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="card mb-6 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
                        <FiSearch className="text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search product types..."
                            className="bg-transparent text-sm focus:outline-none text-slate-700 w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div>
                        <SearchableSelect
                            options={[{ label: 'All Categories', value: '' }, ...categories.map(c => ({ label: c.name, value: c.id }))]}
                            value={filterCategory}
                            onChange={setFilterCategory}
                            placeholder="Filter by Category..."
                        />
                    </div>
                    <div className="text-right flex items-center justify-end text-xs text-slate-500 font-medium">
                        Showing {filteredTypes.length} of {productTypes.length} Product Types
                    </div>
                </div>
            </div>

            {/* ── Product Types Table ── */}
            <div className="card overflow-hidden">
                <div className="table-container lg:no-scrollbar overflow-x-auto">
                    <table className="table-modern">
                        <thead>
                            <tr className="whitespace-nowrap">
                                <th>Product Type Name</th>
                                <th>Category</th>
                                <th>Gender / Group</th>
                                <th>Attributes</th>
                                <th>Sizes Configured</th>
                                <th>Products</th>
                                <th>Status</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="8" className="text-center py-8 text-slate-400">Loading Product Types...</td></tr>
                            ) : filteredTypes.length === 0 ? (
                                <tr><td colSpan="8" className="text-center py-8 text-slate-400">No product types found.</td></tr>
                            ) : (
                                filteredTypes.map((pt) => {
                                    const attrs = Array.isArray(pt.attributes) ? pt.attributes : [];
                                    const sizes = Array.isArray(pt.sizes) ? pt.sizes : [];
                                    const genders = Array.isArray(pt.genders) ? pt.genders : [];
                                    return (
                                        <tr key={pt.id} className="whitespace-nowrap">
                                            <td className="font-semibold text-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded bg-primary-light/20 flex items-center justify-center text-primary">
                                                        <FiLayers />
                                                    </div>
                                                    {pt.name}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium border border-slate-200">
                                                    {pt.category?.name || 'Unassigned'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="flex flex-wrap gap-1 max-w-[180px]">
                                                    {genders.length > 0 ? genders.map((g, i) => (
                                                        <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[10px] font-medium">{g}</span>
                                                    )) : <span className="text-slate-400 text-xs">-</span>}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex flex-wrap gap-1 max-w-[220px]">
                                                    {attrs.length > 0 ? attrs.map((attr, idx) => (
                                                        <span key={idx} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[10px] font-medium" title={attr.options?.join(', ')}>
                                                            {attr.name} ({attr.options?.length || 0})
                                                        </span>
                                                    )) : <span className="text-slate-400 text-xs">No attributes</span>}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex flex-wrap gap-1 max-w-[180px]">
                                                    {sizes.length > 0 ? (
                                                        <>
                                                            {sizes.slice(0, 4).map((s, idx) => (
                                                                <span key={idx} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[10px] font-semibold">{s}</span>
                                                            ))}
                                                            {sizes.length > 4 && (
                                                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">+{sizes.length - 4} more</span>
                                                            )}
                                                        </>
                                                    ) : <span className="text-slate-400 text-xs">No sizes</span>}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="badge badge-info">{pt._count?.products || 0} Products</span>
                                            </td>
                                            <td>
                                                <button onClick={() => handleToggleStatus(pt)} className="focus:outline-none" title={pt.isActive ? 'Click to deactivate' : 'Click to activate'}>
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase ${pt.isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                                        {pt.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </button>
                                            </td>
                                            <td className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => openModal(pt)} className="p-2 hover:bg-slate-100 rounded text-slate-600 transition-colors" title="Edit Product Type">
                                                        <FiEdit />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(pt)}
                                                        className={`p-2 rounded transition-colors ${pt._count?.products > 0 ? 'opacity-30 cursor-not-allowed text-slate-400' : 'hover:bg-red-50 text-red-500'}`}
                                                        title={pt._count?.products > 0 ? 'Cannot delete: products attached' : 'Delete Product Type'}
                                                        disabled={pt._count?.products > 0}
                                                    >
                                                        <FiTrash2 />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════
                STEPPER MODAL
            ═══════════════════════════════════════════════════ */}
            {showModal && (
                <div className="fixed inset-0 z-[100000] flex items-start justify-center bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 mx-4 flex flex-col overflow-hidden"
                        style={{ maxHeight: '85vh' }}
                    >

                        {/* ── Sticky Header ── */}
                        <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-slate-100 bg-white">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">
                                        {editingType ? 'Edit Product Type' : 'Create Product Type'}
                                    </h2>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Step {currentStep} of {STEPS.length} — <span className="font-semibold text-slate-500">{STEPS[currentStep - 1].label}</span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                    <FiX size={17} />
                                </button>
                            </div>

                            {/* Stepper Progress Bar */}
                            <div className="flex items-center">
                                {STEPS.map((step, idx) => {
                                    const isCompleted = currentStep > step.id;
                                    const isActive = currentStep === step.id;
                                    return (
                                        <div key={step.id} className="flex items-center flex-1 last:flex-none">
                                            <div className="flex flex-col items-center">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-200 ${
                                                    isCompleted
                                                        ? 'bg-primary border-primary text-white'
                                                        : isActive
                                                        ? 'bg-white border-primary text-primary'
                                                        : 'bg-white border-slate-200 text-slate-400'
                                                }`}>
                                                    {isCompleted ? <FiCheck size={12} /> : step.id}
                                                </div>
                                                <span className={`text-[10px] font-semibold mt-1 whitespace-nowrap transition-colors ${
                                                    isActive ? 'text-primary' : isCompleted ? 'text-slate-500' : 'text-slate-300'
                                                }`}>
                                                    {step.label}
                                                </span>
                                            </div>
                                            {idx < STEPS.length - 1 && (
                                                <div className={`flex-1 h-[2px] mx-1.5 mb-4 rounded-full transition-all duration-300 ${isCompleted ? 'bg-primary' : 'bg-slate-100'}`} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Scrollable Body ── */}
                        <div className="flex-1 overflow-y-auto">
                            <div className="p-6 space-y-5">

                                {/* ════════════════════════════════════════
                                    STEP 1 — BASIC INFORMATION
                                ════════════════════════════════════════ */}
                                {currentStep === 1 && (
                                    <div className="space-y-5">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                                Product Type Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                autoFocus
                                                className="input w-full"
                                                placeholder="e.g. T-Shirt, Shirt, Trouser, Jeans, Frock"
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleNext(); } }}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                                Parent Category <span className="text-red-500">*</span>
                                            </label>
                                            {/* Native select used here to avoid SearchableSelect portal z-index conflict inside modal */}
                                            <select
                                                className="input w-full"
                                                value={formData.categoryId}
                                                onChange={e => handleCategorySelect(e.target.value)}
                                            >
                                                <option value="">Select Category...</option>
                                                {categories.map(c => (
                                                    <option key={c.id} value={c.id.toString()}>{c.name}</option>
                                                ))}
                                            </select>
                                            {selectedCategory && (
                                                <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                                                    <FiCheck size={11} className="text-green-500" />
                                                    Category: <span className="font-semibold text-slate-600 ml-0.5">{selectedCategory.name}</span>
                                                </p>
                                            )}
                                        </div>

                                        <div className="pt-1 border-t border-slate-100">
                                            <label className="relative inline-flex items-center cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={formData.isActive}
                                                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                                />
                                                <div className="w-10 h-[22px] bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all after:shadow-sm peer-checked:bg-primary"></div>
                                                <span className="ml-3 text-sm font-medium text-slate-700">Product Type is Active</span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* ════════════════════════════════════════
                                    STEP 2 — GENDER / GROUP
                                ════════════════════════════════════════ */}
                                {currentStep === 2 && (
                                    <div className="space-y-5">
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-700">Supported Gender / Group Options</h3>
                                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                Select which gender or customer groups apply to this product type. Multiple selections are supported.
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-3">
                                            {GENDER_OPTIONS.map(gender => {
                                                const isChecked = formData.genders.includes(gender);
                                                return (
                                                    <button
                                                        type="button"
                                                        key={gender}
                                                        onClick={() => handleGenderToggle(gender)}
                                                        className={`px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all flex items-center gap-2 ${
                                                            isChecked
                                                                ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        {isChecked && <FiCheck size={14} />}
                                                        {gender}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {formData.genders.length === 0 ? (
                                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2">
                                                <span>No gender/group selected (optional). Click any option above to select.</span>
                                            </div>
                                        ) : (
                                            <div className="pt-1 text-xs text-slate-400">
                                                Selected: <span className="font-semibold text-slate-700">{formData.genders.join(', ')}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ════════════════════════════════════════
                                    STEP 3 — PRODUCT ATTRIBUTES
                                ════════════════════════════════════════ */}
                                {currentStep === 3 && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h3 className="text-sm font-semibold text-slate-700">Product Attributes</h3>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {selectedCategory
                                                        ? `Attributes for "${selectedCategory.name}" product types`
                                                        : 'Configure which attributes apply to this product type'}
                                                </p>
                                            </div>
                                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                                                {formData.attributes.length} configured
                                            </span>
                                        </div>

                                        {/* Custom Attribute Input */}
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Add custom attribute (e.g. Fabric, Closure, Pocket...)"
                                                className="input flex-1 text-xs"
                                                value={newAttributeName}
                                                onChange={e => setNewAttributeName(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddAttribute(); } }}
                                            />
                                            <button type="button" onClick={handleAddAttribute} className="btn btn-secondary text-xs px-4 whitespace-nowrap">
                                                <FiPlus size={13} /> Add
                                            </button>
                                        </div>

                                        {/* Configured Attributes */}
                                        <div className="space-y-3">
                                            {formData.attributes.length === 0 ? (
                                                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                                    <FiTag size={26} className="mx-auto text-slate-300 mb-2" />
                                                    <p className="text-sm font-semibold text-slate-500">No attributes configured</p>
                                                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                                        {selectedCategory
                                                            ? 'Selected category has no predefined attributes. You can add custom attributes below.'
                                                            : 'Select a category in Step 1 to inherit its attributes, or add custom attributes below.'}
                                                    </p>
                                                </div>
                                            ) : (
                                                formData.attributes.map((attr, attrIdx) => (
                                                    <div key={attrIdx} className={`p-3 rounded-xl border ${attr.inherited ? 'bg-indigo-50/40 border-indigo-100' : 'bg-slate-50 border-slate-200'}`}>
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                                                                <FiTag className={`text-xs ${attr.inherited ? 'text-indigo-500' : 'text-primary'}`} />
                                                                {attr.name}
                                                                {attr.inherited ? (
                                                                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-bold uppercase tracking-wide">
                                                                        Inherited from {selectedCategory?.name || 'Category'}
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-bold uppercase tracking-wide">
                                                                        Custom
                                                                    </span>
                                                                )}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveAttribute(attrIdx)}
                                                                className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                                                title="Remove attribute"
                                                            >
                                                                <FiX size={13} />
                                                            </button>
                                                        </div>

                                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                                            {(attr.options || []).map((opt, optIdx) => (
                                                                <span
                                                                    key={optIdx}
                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white text-slate-700 rounded-md text-[11px] border border-slate-200 shadow-sm font-medium"
                                                                >
                                                                    {opt}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveOptionFromAttribute(attrIdx, optIdx)}
                                                                        className="text-slate-400 hover:text-red-500 ml-0.5 leading-none"
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                </span>
                                                            ))}
                                                            {(attr.options || []).length === 0 && (
                                                                <span className="text-[10px] text-slate-400 italic">No options — add below</span>
                                                            )}
                                                        </div>

                                                        <div className="flex gap-1.5">
                                                            <input
                                                                type="text"
                                                                placeholder={`Add option to ${attr.name}...`}
                                                                className="input flex-1 !py-1 text-xs bg-white"
                                                                value={newOptionInputs[attrIdx] || ''}
                                                                onChange={e => setNewOptionInputs({ ...newOptionInputs, [attrIdx]: e.target.value })}
                                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddOptionToAttribute(attrIdx); } }}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAddOptionToAttribute(attrIdx)}
                                                                className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                                                            >
                                                                Add Option
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ════════════════════════════════════════
                                    STEP 4 — SIZES / VARIANTS
                                ════════════════════════════════════════ */}
                                {currentStep === 4 && (
                                    <div className="space-y-4">
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-700">Available Sizes / Variants</h3>
                                            <p className="text-xs text-slate-400 mt-0.5">Configure the sizes supported by this product type.</p>
                                        </div>

                                        {/* Preset Buttons */}
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Apply Preset</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {SIZE_PRESETS.map((preset, idx) => (
                                                    <button
                                                        type="button"
                                                        key={idx}
                                                        onClick={() => handleApplySizePreset(preset.sizes)}
                                                        className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-primary hover:text-white text-slate-600 text-xs border border-slate-200 transition-all font-medium"
                                                    >
                                                        {preset.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Current Sizes Display */}
                                        <div className="p-3 bg-white rounded-xl border border-slate-200 min-h-[56px] flex items-center">
                                            {formData.sizes.length > 0 ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {formData.sizes.map((s, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold"
                                                        >
                                                            {s}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveSize(s)}
                                                                className="text-emerald-500 hover:text-red-500 transition-colors leading-none"
                                                            >
                                                                &times;
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 mx-auto text-center w-full">
                                                    No sizes configured. Apply a preset above or add custom sizes below.
                                                </p>
                                            )}
                                        </div>

                                        {/* Custom Size Input */}
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Add custom size (e.g. S, M, 32, Free Size...)"
                                                className="input flex-1 text-xs"
                                                value={newSizeInput}
                                                onChange={e => setNewSizeInput(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSize(); } }}
                                            />
                                            <button type="button" onClick={handleAddSize} className="btn btn-secondary text-xs px-4 whitespace-nowrap">
                                                <FiPlus size={13} /> Add Size
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* ════════════════════════════════════════
                                    STEP 5 — REVIEW & SAVE
                                ════════════════════════════════════════ */}
                                {currentStep === 5 && (
                                    <div className="space-y-4">
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-700">Review Configuration</h3>
                                            <p className="text-xs text-slate-400 mt-0.5">Verify all settings before saving. Use Back to make changes.</p>
                                        </div>

                                        {/* Name & Category */}
                                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Product Type</p>
                                                <p className="text-sm font-bold text-slate-800">{formData.name || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Parent Category</p>
                                                <p className="text-sm font-bold text-slate-800">{selectedCategory?.name || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${formData.isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                                    {formData.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Gender */}
                                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Gender / Group</p>
                                            {formData.genders.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {formData.genders.map((g, i) => (
                                                        <span key={i} className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-xs font-semibold">{g}</span>
                                                    ))}
                                                </div>
                                            ) : <p className="text-xs text-slate-400 italic">No gender/group selected</p>}
                                        </div>

                                        {/* Attributes */}
                                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                                                Attributes <span className="normal-case font-normal">({formData.attributes.length})</span>
                                            </p>
                                            {formData.attributes.length > 0 ? (
                                                <div className="space-y-2">
                                                    {formData.attributes.map((attr, idx) => (
                                                        <div key={idx} className="flex items-start gap-2">
                                                            <div className="flex items-center gap-1.5 w-32 shrink-0 pt-0.5">
                                                                <span className="text-xs font-bold text-slate-700">{attr.name}</span>
                                                                {attr.inherited ? (
                                                                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[8px] font-bold uppercase tracking-wide shrink-0">
                                                                        Inherited
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[8px] font-bold uppercase tracking-wide shrink-0">
                                                                        Custom
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap gap-1 flex-1">
                                                                {(attr.options || []).slice(0, 5).map((opt, oi) => (
                                                                    <span key={oi} className="px-1.5 py-0.5 bg-white text-slate-600 border border-slate-200 rounded text-[10px] font-medium">{opt}</span>
                                                                ))}
                                                                {(attr.options || []).length > 5 && (
                                                                    <span className="text-[10px] text-slate-400">+{attr.options.length - 5} more</span>
                                                                )}
                                                                {(attr.options || []).length === 0 && (
                                                                    <span className="text-[10px] text-slate-400 italic">No options</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : <p className="text-xs text-slate-400 italic">No attributes configured</p>}
                                        </div>

                                        {/* Sizes */}
                                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                Sizes <span className="normal-case font-normal">({formData.sizes.length})</span>
                                            </p>
                                            {formData.sizes.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {formData.sizes.map((s, i) => (
                                                        <span key={i} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold">{s}</span>
                                                    ))}
                                                </div>
                                            ) : <p className="text-xs text-slate-400 italic">No sizes configured</p>}
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>

                        {/* ── Sticky Footer ── */}
                        <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-white flex justify-between items-center">
                            <button
                                type="button"
                                onClick={currentStep === 1 ? () => setShowModal(false) : handleBack}
                                className="btn btn-secondary text-sm flex items-center gap-1.5"
                            >
                                {currentStep === 1 ? 'Cancel' : <><FiChevronLeft size={15} /> Back</>}
                            </button>

                            {currentStep < 5 ? (
                                <button type="button" onClick={handleNext} className="btn btn-primary text-sm flex items-center gap-1.5">
                                    Next <FiChevronRight size={15} />
                                </button>
                            ) : (
                                <button type="button" onClick={handleSubmit} className="btn btn-primary text-sm px-6 flex items-center gap-2">
                                    <FiCheck size={15} />
                                    {editingType ? 'Update Product Type' : 'Save Product Type'}
                                </button>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
