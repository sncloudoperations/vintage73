import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiGrid } from 'react-icons/fi';
import { toast } from 'react-toastify';

export default function CategoryMaster() {
    const [activeTab, setActiveTab] = useState('product'); // 'product' or 'ticket'
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({ name: '', unitType: '' });

    const UNIT_TYPES = [
        // Mass
        { value: 'kg', label: 'Kilogram (kg)' },
        { value: 'g', label: 'Gram (g)' },
        { value: 'mg', label: 'Milligram (mg)' },
        // Volume
        { value: 'l', label: 'Litre (l)' },
        { value: 'ml', label: 'Millilitre (ml)' },
        // Length
        { value: 'm', label: 'Meter (m)' },
        { value: 'cm', label: 'Centimeter (cm)' },
        { value: 'mm', label: 'Millimeter (mm)' },
        { value: 'ft', label: 'Feet (ft)' },
        // Quantity
        { value: 'pcs', label: 'Pieces (pcs)' },
        { value: 'box', label: 'Box' },
        { value: 'doz', label: 'Dozen (doz)' },
        { value: 'set', label: 'Set' },
        { value: 'pair', label: 'Pair' },
        { value: 'pkt', label: 'Packet (pkt)' },
        { value: 'bag', label: 'Bag' },
        { value: 'roll', label: 'Roll' },
        { value: 'bundle', label: 'Bundle' }
    ];

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const url = activeTab === 'product' ? '/categories' : '/tickets/categories';
            const { data } = await api.get(url);
            setCategories(data);
        } catch (error) {
            toast.error('Failed to fetch categories');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, [activeTab]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const baseUrl = activeTab === 'product' ? '/categories' : '/tickets/categories';
        try {
            if (editingCategory) {
                await api.put(`${baseUrl}/${editingCategory.id}`, formData);
                toast.success('Category updated successfully');
            } else {
                await api.post(baseUrl, formData);
                toast.success('Category created successfully');
            }
            setShowModal(false);
            setFormData({ name: '', unitType: '' });
            setEditingCategory(null);
            fetchCategories();
        } catch (error) {
            const msg = error.response?.data?.message || error.response?.data?.error || 'Operation failed';
            toast.error(msg);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this category?')) return;
        const baseUrl = activeTab === 'product' ? '/categories' : '/tickets/categories';
        try {
            await api.delete(`${baseUrl}/${id}`);
            toast.success('Category deleted successfully');
            fetchCategories();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete category');
        }
    };

    const openModal = (category = null) => {
        if (category) {
            setEditingCategory(category);
            setFormData({ name: category.name, unitType: category.unitType || '' });
        } else {
            setEditingCategory(null);
            setFormData({ name: '', unitType: '' });
        }
        setShowModal(true);
    };

    const filteredCategories = categories.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Category Master</h1>
                    <p className="text-slate-500 text-sm font-medium">Centralized management for system classification</p>
                </div>
                <div className="flex p-1.5 bg-slate-100/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-inner">
                    <button 
                        onClick={() => setActiveTab('product')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all duration-300 ${activeTab === 'product' ? 'bg-white text-primary shadow-md scale-100' : 'text-slate-400 hover:text-slate-600 scale-95 hover:scale-100'}`}
                    >
                        Product Inventory
                    </button>
                    <button 
                        onClick={() => setActiveTab('ticket')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all duration-300 ${activeTab === 'ticket' ? 'bg-white text-primary shadow-md scale-100' : 'text-slate-400 hover:text-slate-600 scale-95 hover:scale-100'}`}
                    >
                        Ticketing system
                    </button>
                </div>
                <button onClick={() => openModal()} className="btn btn-primary shadow-primary/20 shadow-lg px-8 py-3 rounded-2xl text-[10px] uppercase font-medium tracking-widest">
                    <FiPlus className="text-lg" /> New {activeTab === 'product' ? 'Product' : 'Ticket'} Category
                </button>
            </div>

            <div className="card mb-6">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                    <FiSearch className="text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search categories..."
                        className="flex-1 bg-transparent text-sm focus:outline-none text-slate-700"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="card overflow-hidden">
                <table className="table-modern">
                    <thead>
                        <tr>
                            <th>Category Name</th>
                            {activeTab === 'product' && <th>Unit Type</th>}
                            {activeTab === 'product' && <th>Products Linked</th>}
                            {activeTab === 'ticket' && <th>Usage</th>}
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="3" className="text-center py-8">Loading...</td></tr>
                        ) : filteredCategories.length === 0 ? (
                            <tr><td colSpan="3" className="text-center py-8 text-slate-500">No categories found.</td></tr>
                        ) : (
                            filteredCategories.map((category) => (
                                <tr key={category.id}>
                                    <td className="font-medium text-slate-700">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-primary-light/20 flex items-center justify-center text-primary">
                                                <FiGrid />
                                            </div>
                                            {category.name}
                                        </div>
                                    </td>
                                    {activeTab === 'product' && (
                                        <td>
                                            {category.unitType ? (
                                                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium uppercase">
                                                    {category.unitType}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-xs">-</span>
                                            )}
                                        </td>
                                    )}
                                    {activeTab === 'product' && (
                                        <td>
                                            <span className="badge badge-info">
                                                {category._count?.products || 0} Products
                                            </span>
                                        </td>
                                    )}
                                    {activeTab === 'ticket' && (
                                        <td>
                                            <span className="badge badge-primary">
                                                {category._count?.tickets || 0} Tickets Linked
                                            </span>
                                        </td>
                                    )}
                                    <td className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => openModal(category)} className="p-2 hover:bg-slate-100 rounded text-slate-600 transition-colors">
                                                <FiEdit />
                                            </button>
                                            <button onClick={() => handleDelete(category.id)} className="p-2 hover:bg-red-50 rounded text-red-500 transition-colors">
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-medium text-lg text-slate-800">
                                {editingCategory ? 'Edit Category' : 'Add New Category'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-5">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">{activeTab === 'product' ? 'Product' : 'Ticket'} Category Name <span className="text-red-500">*</span></label>
                                <input
                                    autoFocus
                                    required
                                    type="text"
                                    className="input w-full"
                                    placeholder={activeTab === 'product' ? "e.g. Electronics, Clothing" : "e.g. Software, Hardware"}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            {activeTab === 'product' && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Default Unit Type</label>
                                    <select
                                        className="input w-full"
                                        value={formData.unitType}
                                        onChange={(e) => setFormData({ ...formData, unitType: e.target.value })}
                                    >
                                        <option value="">Select Unit</option>
                                        {UNIT_TYPES.map(unit => (
                                            <option key={unit.value} value={unit.value}>{unit.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingCategory ? 'Update' : 'Create'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
