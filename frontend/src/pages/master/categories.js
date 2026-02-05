import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiGrid } from 'react-icons/fi';
import { toast } from 'react-toastify';

export default function CategoryMaster() {
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
        try {
            const { data } = await api.get('/categories');
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
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingCategory) {
                await api.put(`/categories/${editingCategory.id}`, formData);
                toast.success('Category updated successfully');
            } else {
                await api.post('/categories', formData);
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
        try {
            await api.delete(`/categories/${id}`);
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
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Category Master</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage product categories</p>
                </div>
                <button onClick={() => openModal()} className="btn btn-primary">
                    <FiPlus className="text-lg" /> Add Category
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
                            <th>Unit Type</th>
                            <th>Products Linked</th>
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
                                    <td>
                                        {category.unitType ? (
                                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium uppercase">
                                                {category.unitType}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-xs">-</span>
                                        )}
                                    </td>
                                    <td>
                                        <span className="badge badge-info">
                                            {category._count?.products || 0} Products
                                        </span>
                                    </td>
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
                            <h3 className="font-bold text-lg text-slate-800">
                                {editingCategory ? 'Edit Category' : 'Add New Category'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-5">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Category Name <span className="text-red-500">*</span></label>
                                <input
                                    autoFocus
                                    required
                                    type="text"
                                    className="input w-full"
                                    placeholder="e.g. Electronics, Clothing"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

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
