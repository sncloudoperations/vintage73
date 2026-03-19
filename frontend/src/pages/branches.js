import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { FiPlus, FiEdit2, FiTrash2, FiMapPin, FiPhone, FiMail } from 'react-icons/fi';
import { toast } from 'react-toastify';

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', address: '', phone: '', email: '', isActive: true, stockIncluded: true });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const { data } = await api.get('/branches');
      setBranches(data);
    } catch (err) {
      toast.error('Failed to fetch branches');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/branches/${editingId}`, formData);
        toast.success('Branch updated');
      } else {
        await api.post('/branches', formData);
        toast.success('Branch created');
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', address: '', phone: '', email: '', isActive: true, stockIncluded: true });
      fetchBranches();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save branch');
    }
  };

  const openEditModal = (branch) => {
    setEditingId(branch.id);
    setFormData({
      name: branch.name,
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || '',
      isActive: branch.isActive,
      stockIncluded: branch.stockIncluded !== undefined ? branch.stockIncluded : true
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure? This will fail if users are assigned to this branch.')) return;
    try {
      await api.delete(`/branches/${id}`);
      toast.success('Branch deleted');
      fetchBranches();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete branch');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Branches</h1>
          <p className="text-slate-500 text-sm mt-1">Manage multiple business locations</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus className="text-lg" /> Add Branch
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map(branch => (
          <div key={branch.id} className="card p-6 border-0 shadow-lg hover:shadow-xl transition-shadow relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full transition-colors ${branch.isActive ? 'bg-primary-light/10' : 'bg-slate-50'} group-hover:scale-110`}></div>

            <div className="relative">
              <div className="flex justify-between items-start mb-4">
                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${branch.isActive ? 'bg-primary-light/10 text-primary border border-primary/20' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                  {branch.isActive ? 'Active' : 'Inactive'}
                </div>
                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${branch.stockIncluded ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                  Stock: {branch.stockIncluded ? 'Enabled' : 'Disabled'}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEditModal(branch)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary-light/10 rounded-lg transition-colors">
                    <FiEdit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(branch.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-800 mb-4">{branch.name}</h3>

              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex items-center gap-3">
                  <FiMapPin className="text-slate-400" />
                  <span>{branch.address || 'No address'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <FiPhone className="text-slate-400" />
                  <span>{branch.phone || 'No phone'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <FiMail className="text-slate-400" />
                  <span>{branch.email || 'No email'}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">ID: BR-{branch.id.toString().padStart(3, '0')}</span>
                <span className="text-xs text-slate-400">Created {new Date(branch.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        ))}
        {branches.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <p className="text-slate-400">No branches added yet. Click 'Add Branch' to get started.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Branch' : 'Add New Branch'}</h2>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Branch Name</label>
                <input
                  required
                  className="input"
                  placeholder="e.g. Downtown Branch"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea
                  className="input min-h-[80px]"
                  placeholder="Full address of the branch"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    className="input"
                    placeholder="+91..."
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="branch@example.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 py-2 mt-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm peer-checked:bg-primary"></div>
                  <span className="ml-3 text-sm font-medium text-slate-700">Active Status</span>
                </label>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="stockIncluded"
                    checked={formData.stockIncluded}
                    onChange={e => setFormData({ ...formData, stockIncluded: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm peer-checked:bg-orange-500"></div>
                  <span className="ml-3 text-sm font-medium text-slate-700">Stock Included (Strict Validation)</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setEditingId(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Update Branch' : 'Create Branch'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
