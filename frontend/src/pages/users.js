import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import api from '@/lib/api';
import { MENU_STRUCTURE } from '@/lib/menuStructure';
import { FiPlus, FiTrash2, FiUser, FiKey, FiEdit2 } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
    username: '', name: '', password: '', role: 'staff', branchId: '', allowedModules: [], incentivePercentage: 0,
    designation: '', department: '', joiningDate: '', basicSalary: 0, labourRule: '', nationalId: '',
    employeeCode: '', bankName: '', accountNumber: '', ifscCode: '', branchName: '',
    autoCode: true
  });
  const [editingId, setEditingId] = useState(null);
  const [branches, setBranches] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [designations, setDesignations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [banks, setBanks] = useState([]);
  const [activeTab, setActiveTab] = useState('general');
  const router = useRouter();

  // const modules = ['DASHBOARD', 'MASTER', 'INVENTORY', 'SALES', 'ACCOUNTS']; // Deprecated

  useEffect(() => {
    fetchUsers();
    fetchBranches();
    fetchCompanyProfile();
    fetchDesignations();
    fetchDepartments();
    fetchBankMaster();
  }, []);

  const fetchCompanyProfile = async () => {
    try {
      const { data } = await api.get('/company');
      setCompanyProfile(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBranches = async () => {
    try {
      const { data } = await api.get('/branches');
      setBranches(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDesignations = async () => {
    try {
      const { data } = await api.get('/hrms/designations');
      setDesignations(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data } = await api.get('/hrms/departments');
      setDepartments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBankMaster = async () => {
    try {
      const { data } = await api.get('/banks');
      setBanks(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/users/${editingId}`, formData);
        toast.success('User updated successfully');
      } else {
        await api.post('/users', formData);
        toast.success('User created successfully');
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ 
        username: '', name: '', password: '', role: 'staff', branchId: '', allowedModules: [], incentivePercentage: 0,
        designation: '', department: '', joiningDate: '', basicSalary: 0, labourRule: '', nationalId: '',
        employeeCode: '', bankName: '', accountNumber: '', ifscCode: '', branchName: '',
        autoCode: true
      });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save user');
    }
  };


  const openEditModal = (user) => {
    setEditingId(user.id);
    setFormData({
      username: user.username || '',
      name: user.name || '',
      password: '', // Password not editable here
      role: user.role,
      branchId: user.branchId || '',
      allowedModules: user.allowedModules || [],
      incentivePercentage: user.incentivePercentage || 0,
      designation: user.employeeProfile?.designationId || '',
      department: user.employeeProfile?.departmentId || '',
      joiningDate: user.employeeProfile?.joiningDate ? user.employeeProfile.joiningDate.split('T')[0] : '',
      basicSalary: user.employeeProfile?.basicSalary || 0,
      labourRule: user.employeeProfile?.labourRule || '',
      nationalId: user.employeeProfile?.nationalId || '',
      employeeCode: user.employeeProfile?.employeeCode || '',
      bankName: user.employeeProfile?.bankName || '',
      accountNumber: user.employeeProfile?.accountNumber || '',
      ifscCode: user.employeeProfile?.ifscCode || '',
      branchName: user.employeeProfile?.branchName || '',
      autoCode: !user.employeeProfile?.employeeCode
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success('User deleted');
      fetchUsers();
    } catch (err) {
      toast.error('Failed to delete user');
    }
  };

  const toggleModule = (module) => {
    setFormData(prev => {
      const current = prev.allowedModules || [];
      // Handle Parent Category Toggle
      if (!module.includes(':') && module !== 'DASHBOARD') {
         // Logic for parent toggle if needed, currently implicit
      }
      
      if (current.includes(module)) {
        return { ...prev, allowedModules: current.filter(m => m !== module) };
      } else {
        return { ...prev, allowedModules: [...current, module] };
      }
    });
  };

  const dashboardModule = 'DASHBOARD';

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Users</h1>
          <p className="text-slate-500 text-sm mt-1">Manage system access and roles</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus className="text-lg" /> Add User
        </button>
      </div>

      <div className="card border-0 shadow-lg">
        <div className="table-container">
          <table className="table-modern">
            <thead>
              <tr>
                <th>User</th>
                <th>EMP CODE</th>
                <th>Branch</th>
                <th>Role</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Access</th>
                <th>Joined Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td className="font-medium text-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <FiUser />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{user.name || 'No Name'}</div>
                        <div className="text-[10px] text-slate-400 font-mono tracking-tighter">@{user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                      {user.employeeProfile?.employeeCode || '-'}
                    </span>
                  </td>
                  <td>
                    <span className="text-sm text-slate-600">
                      {branches.find(b => b.id === user.branchId)?.name || 'Global'}
                    </span>
                  </td>
                  <td>
                    <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${user.role === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-600'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="text-slate-600">
                    {user.employeeProfile?.designation?.name ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {user.employeeProfile.designation.name}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="text-slate-600">
                    {user.employeeProfile?.department?.name ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                        {user.employeeProfile.department.name}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>
                  <td>
                     <div className="flex flex-wrap gap-1">
                       {user.allowedModules && user.allowedModules.map(m => (
                         <span key={m} className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] rounded border border-emerald-100">{m}</span>
                       ))}
                       {(!user.allowedModules || user.allowedModules.length === 0) && <span className="text-slate-400 text-xs">-</span>}
                     </div>
                  </td>
                  <td className="text-slate-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => openEditModal(user)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Edit User"
                      >
                        <FiEdit2 />
                      </button>
                      <button 
                        onClick={() => handleDelete(user.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete User"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr><td colSpan="5" className="text-center py-8 text-slate-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 text-left">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30 flex-shrink-0">
               <div>
                 <h2 className="text-xl font-bold text-slate-800 tracking-tight">{editingId ? 'Edit User' : 'Add New User'}</h2>
                 <p className="text-slate-500 text-[11px] font-medium mt-0.5 uppercase tracking-wider">{editingId ? 'Modify existing account' : 'Setup system access for staff'}</p>
               </div>
               <button onClick={() => { setShowModal(false); setEditingId(null); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-100 text-slate-400 hover:text-red-500 hover:border-red-100 transition-all">
                  <FiPlus className="rotate-45 text-xl" />
               </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex flex-col h-full">
              {/* Tabs */}
              <div className="flex gap-6 border-b border-slate-100 mb-6 sticky top-0 bg-white z-10">
                  <button 
                    type="button"
                    onClick={() => setActiveTab('general')}
                    className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'general' ? 'text-emerald-600 border-emerald-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                  >
                    General Info
                  </button>
                  <button 
                    type="button"
                    onClick={() => setActiveTab('access')}
                    className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'access' ? 'text-emerald-600 border-emerald-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                  >
                    User Access
                  </button>
                  <button 
                    type="button"
                    onClick={() => setActiveTab('salary')}
                    className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'salary' ? 'text-emerald-600 border-emerald-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                  >
                    Salary & Info
                  </button>
                  <button 
                    type="button"
                    onClick={() => setActiveTab('bank')}
                    className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'bank' ? 'text-emerald-600 border-emerald-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                  >
                    Bank Details
                  </button>
              </div>

              {/* General Tab */}
              <div className={activeTab === 'general' ? 'block' : 'hidden'}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
                        <input 
                          required 
                          className="input w-full bg-slate-50 border-slate-100 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all font-normal py-2.5 text-sm" 
                          placeholder="e.g. John Doe" 
                          value={formData.name} 
                          onChange={e => setFormData({...formData, name: e.target.value})} 
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Username</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
                          <input 
                            required 
                            className="input w-full bg-slate-50 border-slate-100 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all font-normal py-2.5 text-sm pl-8" 
                            placeholder="johndoe" 
                            value={formData.username} 
                            onChange={e => setFormData({...formData, username: e.target.value})} 
                          />
                        </div>
                      </div>
                      
                      {!editingId && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Initial Password</label>
                          <input 
                            required 
                            type="password"
                            className="input w-full bg-slate-50 border-slate-100 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all font-normal py-2.5 text-sm" 
                            placeholder="••••••••" 
                            value={formData.password} 
                            onChange={e => setFormData({...formData, password: e.target.value})} 
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Assigned Branch</label>
                        <select 
                          className="input w-full bg-slate-50 border-slate-100 focus:bg-white transition-all font-normal py-2.5 text-sm" 
                          value={formData.branchId} 
                          onChange={e => setFormData({...formData, branchId: e.target.value})}
                        >
                          <option value="">Global / No Branch</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Incentive (%)</label>
                        <input 
                          type="number"
                          max="100"
                          step="0.1"
                          className="input w-full bg-slate-50 border-slate-100 focus:bg-white transition-all font-normal py-2.5 text-sm" 
                          placeholder="e.g. 5" 
                          value={formData.incentivePercentage} 
                          onChange={e => setFormData({...formData, incentivePercentage: e.target.value})} 
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">System Role</label>
                        <div className="flex gap-2">
                          {['staff', 'admin'].map(r => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setFormData({...formData, role: r})}
                              className={`flex-1 py-2 px-3 rounded-lg border transition-all font-bold uppercase text-[9px] tracking-widest ${formData.role === r ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
              </div>

              {/* Access Tab */}
              <div className={activeTab === 'access' ? 'block' : 'hidden'}>
                   <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <div className="w-1 h-3 bg-emerald-500 rounded-full"></div>
                        Module Permissions
                      </label>
                      
                      {/* Dashboard separate */}
                      <div className="mb-3">
                          <label className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border transition-all ${formData.allowedModules?.includes(dashboardModule) ? 'bg-white border-emerald-200 shadow-sm' : 'bg-transparent border-transparent hover:bg-white hover:border-slate-200'}`}>
                            <input 
                              type="checkbox" 
                              checked={formData.allowedModules?.includes(dashboardModule)} 
                              onChange={() => toggleModule(dashboardModule)}
                              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300 transition-all cursor-pointer"
                            />
                            <span className={`text-[10px] font-bold tracking-tight uppercase ${formData.allowedModules?.includes(dashboardModule) ? 'text-emerald-700' : 'text-slate-500'}`}>DASHBOARD</span>
                          </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {MENU_STRUCTURE.map(group => (
                            <div key={group.title} className="bg-white p-2.5 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-slate-100">
                                    <input 
                                        type="checkbox"
                                        checked={formData.allowedModules?.includes(group.title)}
                                        onChange={() => toggleModule(group.title)}
                                        className="w-3.5 h-3.5 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300 transition-all cursor-pointer"
                                    />
                                    <span className="font-bold text-slate-700 text-[10px] uppercase tracking-wide">{group.title}</span>
                                </div>
                                
                                <div className="space-y-0.5">
                                    {group.items.map(item => {
                                        const permissionKey = `${group.title}:${item.name}`;
                                        const isParentSelected = formData.allowedModules?.includes(group.title);
                                        const isSelected = formData.allowedModules?.includes(permissionKey);
                                        
                                        return (
                                            <label key={permissionKey} className={`flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-slate-50 transition-colors ${isParentSelected ? 'opacity-50' : ''}`}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected || isParentSelected}
                                                    onChange={() => toggleModule(permissionKey)}
                                                    disabled={isParentSelected}
                                                    className="w-3 h-3 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300"
                                                />
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
              
              {/* Salary & Labour Tab */}
              <div className={activeTab === 'salary' ? 'block' : 'hidden'}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex justify-between">
                          Employee Code
                          <div className="flex items-center gap-1 cursor-pointer select-none" onClick={() => setFormData({...formData, autoCode: !formData.autoCode, employeeCode: !formData.autoCode ? '' : formData.employeeCode})}>
                            <div className={`w-3 h-3 rounded-full border-2 ${formData.autoCode ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}></div>
                            <span className="text-[9px]">AUTO</span>
                          </div>
                        </label>
                        <input 
                          disabled={formData.autoCode}
                          className={`input w-full transition-all font-normal text-sm py-2.5 ${formData.autoCode ? 'bg-slate-100 text-slate-400 italic' : 'bg-slate-50 border-slate-100'}`} 
                          placeholder={formData.autoCode ? "Auto-generated" : "Custom Code"} 
                          value={formData.employeeCode} 
                          onChange={e => setFormData({...formData, employeeCode: e.target.value})} 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Designation</label>
                        <select 
                          className="input w-full bg-slate-50 border-slate-100 focus:bg-white transition-all font-normal text-sm py-2.5" 
                          value={formData.designation} 
                          onChange={e => setFormData({...formData, designation: e.target.value})}
                        >
                          <option value="">Select Designation</option>
                          {designations.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Department</label>
                        <select 
                          className="input w-full bg-slate-50 border-slate-100 focus:bg-white transition-all font-normal text-sm py-2.5" 
                          value={formData.department} 
                          onChange={e => setFormData({...formData, department: e.target.value})}
                        >
                          <option value="">Select Department</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Joining Date</label>
                        <input 
                          type="date"
                          className="input w-full bg-slate-50 border-slate-100 focus:bg-white transition-all font-normal text-sm py-2.5" 
                          value={formData.joiningDate} 
                          onChange={e => setFormData({...formData, joiningDate: e.target.value})} 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Basic Salary ({companyProfile?.currencySymbol || '₹'})</label>
                        <input 
                          type="number"
                          className="input w-full bg-slate-50 border-slate-100 focus:bg-white transition-all font-normal text-sm py-2.5" 
                          value={formData.basicSalary} 
                          onChange={e => setFormData({...formData, basicSalary: e.target.value})} 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                           {companyProfile?.country === 'India' ? 'Labour Rule (ESI/PF)' : 
                            companyProfile?.country === 'UAE' ? 'Labour Rule (WPS/MOL)' : 'Labour Rule'}
                        </label>
                        <input 
                          className="input w-full bg-slate-50 border-slate-100 focus:bg-white transition-all font-normal text-sm py-2.5" 
                          placeholder="e.g. Category A" 
                          value={formData.labourRule} 
                          onChange={e => setFormData({...formData, labourRule: e.target.value})} 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                           {companyProfile?.country === 'India' ? 'Aadhar / PAN' : 
                            companyProfile?.country === 'UAE' ? 'Emirates ID / Labor Card' : 'National ID'}
                        </label>
                        <input 
                          className="input w-full bg-slate-50 border-slate-100 focus:bg-white transition-all font-normal text-sm py-2.5" 
                          placeholder="ID Number" 
                          value={formData.nationalId} 
                          onChange={e => setFormData({...formData, nationalId: e.target.value})} 
                        />
                      </div>
                  </div>
              </div>

              {/* Bank Details Tab */}
              <div className={activeTab === 'bank' ? 'block' : 'hidden'}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                      <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Bank Name</label>
            <input 
              type="text"
              className="input w-full bg-slate-50 border-slate-100 focus:bg-white transition-all font-normal text-sm py-2.5" 
              value={formData.bankName} 
              onChange={e => setFormData({ ...formData, bankName: e.target.value })}
              placeholder="e.g. HDFC Bank"
            />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Account Number</label>
                        <input 
                          className="input w-full bg-slate-50 border-slate-100 focus:bg-white transition-all font-normal text-sm py-2.5 font-mono" 
                          placeholder="1234567890" 
                          value={formData.accountNumber} 
                          onChange={e => setFormData({...formData, accountNumber: e.target.value})} 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">IFSC / Routing Code</label>
                        <input 
                          className="input w-full bg-slate-50 border-slate-100 focus:bg-white transition-all font-normal text-sm py-2.5 uppercase font-mono" 
                          placeholder="HDFC0001234" 
                          value={formData.ifscCode} 
                          onChange={e => setFormData({...formData, ifscCode: e.target.value})} 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Bank Branch</label>
                        <input 
                          className="input w-full bg-slate-50 border-slate-100 focus:bg-white transition-all font-normal text-sm py-2.5" 
                          placeholder="Branch Name" 
                          value={formData.branchName} 
                          onChange={e => setFormData({...formData, branchName: e.target.value})} 
                        />
                      </div>
                  </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button type="button" className="px-4 py-2 font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase text-[10px]" onClick={() => { setShowModal(false); setEditingId(null); }}>Cancel</button>
                <button type="submit" className="bg-slate-900 text-white font-bold px-8 py-2.5 rounded-lg hover:bg-black hover:shadow-lg transition-all active:scale-95 text-xs uppercase tracking-widest">
                  {editingId ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
