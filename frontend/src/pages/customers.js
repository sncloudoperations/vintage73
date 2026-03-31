import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { MENU_STRUCTURE } from '@/lib/menuStructure';
import { FiPlus, FiTrash2, FiEdit2, FiUsers, FiMapPin, FiPhone, FiSearch, FiCheck, FiLoader, FiKey } from 'react-icons/fi';
import { toast } from 'react-toastify';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '', city: '', state: '', pincode: '', gstin: '', partyType: 'B2C', username: '', password: '', accessPermissions: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [verifyingGST, setVerifyingGST] = useState(false);
  const [gstVerified, setGstVerified] = useState(false);

  const toggleModule = (module) => {
    setFormData(prev => {
      const current = prev.accessPermissions || [];
      if (current.includes(module)) {
        return { ...prev, accessPermissions: current.filter(m => m !== module) };
      } else {
        return { ...prev, accessPermissions: [...current, module] };
      }
    });
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const { data } = await api.get('/customers');
      setCustomers(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await api.put(`/customers/${currentId}`, formData);
        toast.success('Customer updated');
      } else {
        await api.post('/customers', formData);
        toast.success('Customer added');
      }
      setShowModal(false);
      resetForm();
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this customer?')) return;
    try {
      await api.delete(`/customers/${id}`);
      toast.success('Customer deleted');
      fetchCustomers();
    } catch (err) {
      toast.error('Failed to delete customer');
    }
  };

  const openEdit = (customer) => {
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      pincode: customer.pincode || '',
      gstin: customer.gstin || '',
      partyType: customer.partyType || 'B2C',
      username: customer.username || '',
      password: '',
      accessPermissions: customer.accessPermissions || []
    });
    setCurrentId(customer.id);
    setIsEdit(true);
    setGstVerified(!!customer.gstin);
    setActiveTab('general');
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', email: '', address: '', city: '', state: '', pincode: '', gstin: '', partyType: 'B2C', username: '', password: '', accessPermissions: [] });
    setIsEdit(false);
    setCurrentId(null);
    setGstVerified(false);
    setActiveTab('general');
  };

  // Verify GSTIN and fetch details
  const verifyGSTIN = async () => {
    const gstin = formData.gstin.trim().toUpperCase();

    if (!gstin) {
      toast.error('Please enter a GSTIN number');
      return;
    }

    if (gstin.length !== 15) {
      toast.error('GSTIN must be 15 characters');
      return;
    }

    setVerifyingGST(true);
    try {
      const { data } = await api.get(`/gst/verify/${gstin}`);

      if (data.valid) {
        // Auto-fill form with fetched data
        setFormData(prev => ({
          ...prev,
          gstin: data.gstin,
          name: data.legalName || data.tradeName || prev.name,
          address: data.address || prev.address,
          city: data.city || prev.city,
          state: data.state || prev.state,
          pincode: data.pincode || prev.pincode,
          partyType: 'B2B'
        }));

        setGstVerified(true);

        if (data.manualEntry) {
          toast.success(`GSTIN verified! State: ${data.state}. Please enter other details manually.`);
        } else {
          toast.success(`GSTIN verified! ${data.legalName || data.tradeName}`);
        }
      } else {
        toast.error(data.error || 'Invalid GSTIN');
        setGstVerified(false);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to verify GSTIN');
      setGstVerified(false);
    } finally {
      setVerifyingGST(false);
    }
  };

  // Handle GSTIN change - reset verification status
  const handleGSTINChange = (value) => {
    setFormData({ ...formData, gstin: value.toUpperCase() });
    setGstVerified(false);
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone && c.phone.includes(searchQuery)) ||
    (c.gstin && c.gstin.includes(searchQuery.toUpperCase())) ||
    (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Customers</h1>
          <p className="text-slate-500 text-sm">Manage your directory and view customer history</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative group flex-1 sm:w-64">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search name, phone, GSTIN..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn btn-primary px-6 py-2.5 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95" onClick={() => { resetForm(); setShowModal(true); }}>
            <FiPlus className="text-lg" /> Add Customer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map(customer => (
          <div key={customer.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${customer.partyType === 'B2B' ? 'bg-blue-50 text-blue-600' : 'bg-primary-light text-primary'}`}>
                  <FiUsers />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{customer.name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <FiPhone className="text-[10px]" /> {customer.phone || 'N/A'}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <span className={`text-xs px-2 py-0.5 rounded ${customer.partyType === 'B2B' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                  {customer.partyType}
                </span>
                <button onClick={() => openEdit(customer)} className="p-1.5 text-slate-400 hover:text-primary rounded hover:bg-primary-light"><FiEdit2 /></button>
                <button onClick={() => handleDelete(customer.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"><FiTrash2 /></button>
              </div>
            </div>
            <div className="text-sm text-slate-600 space-y-1">
              {customer.gstin && (
                <p className="text-xs font-mono bg-slate-50 px-2 py-1 rounded">GSTIN: {customer.gstin}</p>
              )}
              {customer.address && <p className="flex items-start gap-2"><FiMapPin className="mt-0.5 text-slate-400" /> {customer.address}</p>}
              <div className="pt-3 mt-3 border-t border-slate-50 flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Sales</span>
                <span className="font-bold text-slate-700">{customer._count?.sales || 0} Orders</span>
              </div>
            </div>
          </div>
        ))}
        {filteredCustomers.length === 0 && !loading && (
          <div className="col-span-full text-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
            <FiSearch size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No customers found</p>
            <p className="text-sm">Try adjusting your search or add a new customer.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-800">{isEdit ? 'Edit Customer' : 'Add Customer'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Tabs */}
              <div className="flex gap-6 border-b border-slate-100 mb-4 bg-white z-10">
                <button
                  type="button"
                  onClick={() => setActiveTab('general')}
                  className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'general' ? 'text-primary border-primary' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                >
                  General Info
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('access')}
                  className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'access' ? 'text-primary border-primary' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                >
                  Customer Access
                </button>
              </div>

              {/* General Tab */}
              <div className={activeTab === 'general' ? 'block space-y-4' : 'hidden'}>
                {/* GSTIN Verification Section */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-blue-800 mb-2">
                    🔍 GST Number Lookup
                  </label>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1 font-mono uppercase"
                      placeholder="Enter 15-digit GSTIN"
                      value={formData.gstin}
                      onChange={e => handleGSTINChange(e.target.value)}
                      maxLength={15}
                    />
                    <button
                      type="button"
                      onClick={verifyGSTIN}
                      disabled={verifyingGST || formData.gstin.length !== 15}
                      className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${gstVerified
                        ? 'bg-green-500 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                    >
                      {verifyingGST ? (
                        <><FiLoader className="animate-spin" /> Verifying...</>
                      ) : gstVerified ? (
                        <><FiCheck /> Verified</>
                      ) : (
                        'Verify GST'
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-blue-600 mt-2">
                    Enter GSTIN to auto-fill business details from GST portal
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="label">Business / Customer Name <span className="text-red-500">*</span></label>
                    <input
                      required
                      className="input"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder={gstVerified ? 'Auto-filled from GST' : 'Enter name'}
                    />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input className="input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input type="email" className="input" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Address</label>
                    <textarea className="input" rows="2" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })}></textarea>
                  </div>
                  <div>
                    <label className="label">City</label>
                    <input className="input" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">State</label>
                    <input className="input" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Pincode</label>
                    <input className="input" value={formData.pincode} onChange={e => setFormData({ ...formData, pincode: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Party Type</label>
                    <select className="input" value={formData.partyType} onChange={e => setFormData({ ...formData, partyType: e.target.value })}>
                      <option value="B2C">B2C (Consumer)</option>
                      <option value="B2B">B2B (Business)</option>
                      <option value="Unregistered">Unregistered</option>
                    </select>
                  </div>
                  
                  <div className="col-span-2 pt-4 border-t border-slate-100 mt-2">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
                      <FiKey className="text-primary" /> Login Credentials
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Username</label>
                        <input className="input" placeholder="Optional" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">{isEdit ? 'Set New Password' : 'Password'}</label>
                        <input type="password" placeholder={isEdit ? 'Leave blank to keep current' : 'Optional'} className="input" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Access Tab */}
              <div className={activeTab === 'access' ? 'block space-y-4' : 'hidden'}>
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <div className="w-1 h-3 bg-primary rounded-full"></div>
                    Customer Module Permissions
                  </label>

                  {/* Dashboard separate */}
                  <div className="mb-3">
                    <label className="relative inline-flex items-center cursor-pointer p-2.5 rounded-lg border transition-all hover:bg-slate-50 border-slate-200">
                      <input
                        type="checkbox"
                        checked={formData.accessPermissions?.includes('DASHBOARD')}
                        onChange={() => toggleModule('DASHBOARD')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm peer-checked:bg-primary"></div>
                      <span className={`ml-3 text-[10px] font-bold tracking-tight uppercase ${formData.accessPermissions?.includes('DASHBOARD') ? 'text-primary-dark' : 'text-slate-500'}`}>DASHBOARD</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto pr-2">
                    {MENU_STRUCTURE.map(group => (
                      <div key={group.title} className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-slate-100">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.accessPermissions?.includes(group.title)}
                              onChange={() => toggleModule(group.title)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-sm peer-checked:bg-primary"></div>
                          </label>
                          <span className="font-bold text-slate-700 text-[10px] uppercase tracking-wide">{group.title}</span>
                        </div>

                        <div className="space-y-0.5">
                          {group.items.map(item => {
                            const permissionKey = `${group.title}:${item.name}`;
                            const isParentSelected = formData.accessPermissions?.includes(group.title);
                            const isSelected = formData.accessPermissions?.includes(permissionKey);

                            return (
                              <label key={permissionKey} className={`flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-slate-50 transition-colors ${isParentSelected ? 'opacity-50' : ''}`}>
                                <div className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isSelected || isParentSelected}
                                    onChange={() => toggleModule(permissionKey)}
                                    disabled={isParentSelected}
                                    className="sr-only peer"
                                  />
                                  <div className="w-7 h-4 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all after:shadow-sm peer-checked:bg-primary"></div>
                                </div>
                                <span className={`text-[11px] ${isSelected || isParentSelected ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>{item.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{isEdit ? 'Update' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
