import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import api from '@/lib/api';
import { 
  FiPlus, FiSearch, FiClock, FiCheckCircle, FiAlertCircle, FiUser, 
  FiArrowRight, FiMessageSquare, FiTrendingUp, FiFilter, FiActivity, FiRefreshCw,
  FiXCircle, FiLayers, FiFileText, FiSend, FiUserCheck, FiAlertTriangle,
  FiEdit3, FiTag, FiMapPin, FiCalendar, FiChevronDown
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

// ─── TIMELINE ICON & COLOR MAP ───
const TIMELINE_MAP = {
  Created:          { icon: <FiPlus />,          bg: 'bg-emerald-500', ring: 'ring-emerald-100',  text: 'text-emerald-700',  label: 'Created' },
  Assigned:         { icon: <FiUserCheck />,     bg: 'bg-blue-500',    ring: 'ring-blue-100',     text: 'text-blue-700',     label: 'Assigned' },
  StatusChanged:    { icon: <FiEdit3 />,         bg: 'bg-violet-500',  ring: 'ring-violet-100',   text: 'text-violet-700',   label: 'Status Update' },
  MessageAdded:     { icon: <FiMessageSquare />, bg: 'bg-slate-400',   ring: 'ring-slate-100',    text: 'text-slate-600',    label: 'Message' },
  ClosureRequested: { icon: <FiAlertTriangle />, bg: 'bg-amber-500',   ring: 'ring-amber-100',    text: 'text-amber-700',    label: 'Closure Requested' },
  StaffReleased:    { icon: <FiCheckCircle />,   bg: 'bg-green-500',   ring: 'ring-green-100',    text: 'text-green-700',    label: 'Staff Released' },
  Ignored:          { icon: <FiAlertCircle />,   bg: 'bg-red-600',     ring: 'ring-red-100',      text: 'text-red-700',      label: 'IGNORED' },
};
const getTimelineMeta = (action) => TIMELINE_MAP[action] || { icon: <FiActivity />, bg: 'bg-slate-300', ring: 'ring-slate-100', text: 'text-slate-500', label: action };

export default function Ticketing() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [staff, setStaff] = useState([]);
  const [categories, setCategories] = useState([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [branchAdmins, setBranchAdmins] = useState([]);

  // Form States
  const [newTicket, setNewTicket] = useState({ title: '', description: '', priority: 'Medium', categoryId: '', branchId: '', customerId: '', assignedToId: '', adminId: '', file: null });
  const [statusUpdate, setStatusUpdate] = useState({ status: '', message: '' });
  const [assignStaffId, setAssignStaffId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ name: '', phone: '', email: '' });
  const [reassignMode, setReassignMode] = useState('STAFF'); // STAFF | ADMIN
  const [reassignTargetStaffId, setReassignTargetStaffId] = useState('');
  const [nextStaffId, setNextStaffId] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [filters, setFilters] = useState({ status: '', priority: '', categoryId: '', search: '' });
  const [activeDetailTab, setActiveDetailTab] = useState('timeline'); // timeline | chat | actions

  const priorities = ['Low', 'Medium', 'High'];
  const statuses = ['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'];

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    if (!storedUser) { router.push('/login'); return; }
    const permissions = storedUser.allowedModules || [];
    const isCustomer = storedUser.role === 'customer';
    const isSuperAdmin = storedUser.role === 'admin' && !storedUser.branchId;
    if (!isCustomer && !isSuperAdmin && !permissions.includes('SUPPORT') && !permissions.includes('SUPPORT:Ticketing System')) {
      toast.error('Access Denied'); router.push('/'); return;
    }
    setUser(storedUser);
    fetchTickets(); fetchCategories(); fetchBranches();
    if (storedUser.role === 'customer') {
      fetchBranchAdmins(storedUser.branchId || '');
    }
    if (storedUser.role === 'admin' || storedUser.role === 'superadmin') {
      if (storedUser.branchId) {
        fetchStaff(storedUser.branchId);
        fetchBranchCustomers(storedUser.branchId);
      } else if (storedUser.role === 'superadmin') {
        fetchStaff();
        fetchBranchCustomers();
      }
    }
  }, []);

  useEffect(() => { if (user) fetchTickets(); }, [filters]);

  // Deep Link
  useEffect(() => {
    if (router.query.id && tickets.length > 0) {
      const ticket = tickets.find(t => t.id === router.query.id || t.id.toString() === router.query.id);
      if (ticket && !selectedTicket) { setSelectedTicket(ticket); setShowDetailModal(true); }
    }
  }, [router.query.id, tickets]);

  const closeDetailAndClearUrl = () => {
    setShowDetailModal(false); setSelectedTicket(null); setActiveDetailTab('timeline');
    if (router.query.id) { const { id, ...rest } = router.query; router.push({ pathname: router.pathname, query: rest }, undefined, { shallow: true }); }
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    if (router.query.openCreate) {
      const { openCreate, ...rest } = router.query;
      router.push({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
    }
  };

  useEffect(() => {
    if (router.query.openCreate === 'true') {
      const savedTicket = sessionStorage.getItem('draftTicket');
      if (savedTicket) {
        try { setNewTicket(JSON.parse(savedTicket)); } catch {}
        sessionStorage.removeItem('draftTicket');
      }
      setShowCreateModal(true);
    }
  }, [router.query.openCreate]);

  // ─── API CALLS ───
  const fetchTickets = async () => {
    try { setLoading(true); const q = new URLSearchParams(filters).toString(); const { data } = await api.get(`/tickets?${q}`); setTickets(Array.isArray(data) ? data : []); }
    catch { toast.error('Failed to sync ticket pool'); } finally { setLoading(false); }
  };
  const fetchCategories = async () => { try { const { data } = await api.get('/tickets/categories'); setCategories(data); } catch {} };
  const fetchBranches = async () => { try { const { data } = await api.get('/branches'); setBranches(data); } catch {} };
  const fetchStaff = async (branchId) => { try { const { data } = await api.get(`/users/staff${branchId ? `?branchId=${branchId}` : ''}`); setStaff(data); } catch {} };
  const fetchBranchCustomers = async (branchId) => {
    try {
      const { data } = await api.get(`/tickets/branch-customers${branchId ? `?branchId=${branchId}` : ''}`);
      if (Array.isArray(data) && data.length > 0) {
        setCustomers(data);
      } else {
        // Fallback: load all customers if branch-specific returns empty
        const { data: allCustomers } = await api.get('/customers');
        setCustomers(Array.isArray(allCustomers) ? allCustomers : []);
      }
    } catch {
      // Fallback: if endpoint fails (e.g. 400 on old server), use general customers list
      try {
        const { data: allCustomers } = await api.get('/customers');
        setCustomers(Array.isArray(allCustomers) ? allCustomers : []);
      } catch {}
    }
  };
  const fetchBranchAdmins = async (branchId) => { try { const { data } = await api.get(`/tickets/branch-admins${branchId ? `?branchId=${branchId}` : ''}`); setBranchAdmins(data); } catch {} };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    Object.keys(newTicket).forEach(key => {
        if (key === 'file') { if (newTicket.file) formData.append('file', newTicket.file); }
        else { formData.append(key, newTicket[key]); }
    });

    try {
      await api.post('/tickets', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Ticket submitted successfully');
      closeCreateModal();
      setNewTicket({ title: '', description: '', priority: 'Medium', categoryId: '', branchId: '', customerId: '', assignedToId: '', adminId: '', file: null });
      fetchTickets();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    }
  };

  const handleMessage = async (e) => {
    e.preventDefault(); if (!messageText.trim()) return;
    try {
      await api.post('/tickets/message', { ticketId: selectedTicket.id, message: messageText });
      setMessageText('');
      const { data } = await api.get('/tickets');
      const updated = data.find(t => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated); setTickets(data);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { toast.error('Failed to send'); }
  };

  const handleAssign = async (ticketId) => {
    if (!assignStaffId) return toast.error('Please select staff');
    
    // If it's a reassignment, require a reason via modal
    if (selectedTicket.assignedToId && selectedTicket.assignedToId !== parseInt(assignStaffId)) {
        setReassignMode('ADMIN');
        setReassignTargetStaffId(assignStaffId);
        setShowReassignModal(true);
        return;
    }

    try {
      await api.put('/tickets/assign', { ticketId, staffId: assignStaffId });
      toast.success('Agent assigned/reassigned');
      fetchTickets(); closeDetailAndClearUrl();
    } catch { toast.error('Failed to assign'); }
  };

  const handleStatusUpdate = async (ticketId) => {
    try { await api.put('/tickets/status', { ticketId, status: statusUpdate.status, message: statusUpdate.message }); toast.success('Status updated'); setStatusUpdate({ status: '', message: '' }); fetchTickets(); closeDetailAndClearUrl(); }
    catch { toast.error('Failed'); }
  };

  const handleAccept = async (ticketId) => {
    try { await api.post('/tickets/accept', { ticketId }); toast.success('Ticket accepted'); fetchTickets(); closeDetailAndClearUrl(); }
    catch { toast.error('Failed to accept ticket'); }
  };

  const handleReassign = async (e) => {
    e.preventDefault();
    if (!reassignReason.trim()) return toast.error('Reason is required');
    try { 
      if (reassignMode === 'STAFF') {
        await api.post('/tickets/reassign', { ticketId: selectedTicket.id, reason: reassignReason, nextStaffId }); 
        toast.warning('Reassign request sent');
      } else {
        await api.put('/tickets/assign', { ticketId: selectedTicket.id, staffId: reassignTargetStaffId, reason: reassignReason });
        toast.success('Agent reassigned with reason');
      }
      setReassignReason(''); setNextStaffId(''); setShowReassignModal(false); fetchTickets(); closeDetailAndClearUrl(); 
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to reassign'); }
  };

  const handleComplete = async (ticketId) => {
    try { await api.post('/tickets/complete', { ticketId }); toast.success('Ticket completed'); fetchTickets(); closeDetailAndClearUrl(); }
    catch { toast.error('Failed to complete ticket'); }
  };

  const handleClosureRequest = async (ticketId) => {
    const reason = prompt('Reason for closure request:'); if (!reason) return;
    try { await api.post('/tickets/closure-request', { ticketId, reason }); toast.info('Closure requested'); fetchTickets(); closeDetailAndClearUrl(); }
    catch { toast.error('Failed'); }
  };

  const handleClosureApproval = async (requestId, status) => {
    const adminComment = status === 'Rejected' ? prompt('Rejection reason:') : '';
    if (status === 'Rejected' && !adminComment) return;
    try { await api.put('/tickets/closure-approve', { requestId, status, adminComment }); toast.success(`Closure ${status}`); fetchTickets(); closeDetailAndClearUrl(); }
    catch { toast.error('Failed'); }
  };

  const handleMarkAsIgnored = async (ticketId) => {
    const reason = prompt('Why is this ticket being flagged as ignored? (e.g., No response from staff for 24h)');
    if (!reason) return;
    try {
      await api.put('/tickets/mark-ignored', { ticketId, reason });
      toast.warning('Ticket flagged as Ignored');
      fetchTickets(); closeDetailAndClearUrl();
    } catch { toast.error('Failed to flag ticket'); }
  };

  const handleTicketDecision = async (ticketId, action, staffId = null) => {
    const reason = action === 'REJECT' ? prompt('Reason for rejection:') : null;
    if (action === 'REJECT' && !reason) return;
    
    try {
      await api.put('/tickets/decision', { ticketId, action, reason, staffId });
      toast.success(`Ticket ${action === 'ACCEPT' ? 'Accepted' : 'Rejected'}`);
      fetchTickets(); closeDetailAndClearUrl();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return toast.error('Category name is required');
    try {
      await api.post('/tickets/categories', { name: newCategoryName.trim() });
      toast.success('Category created');
      setNewCategoryName('');
      setShowCategoryModal(false);
      fetchCategories();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create category'); }
  };


  // ─── STYLE HELPERS ───
  const getStatusColor = (s) => ({ CREATED: 'bg-emerald-50 text-emerald-600', ASSIGNED: 'bg-blue-50 text-blue-600', IN_PROGRESS: 'bg-violet-50 text-violet-600', CLOSED: 'bg-slate-100 text-slate-600', REJECTED: 'bg-red-50 text-red-600' }[s] || 'bg-slate-50 text-slate-400');
  const getPriorityColor = (p) => ({ High: 'bg-red-500/10 text-red-600 border-red-200', Medium: 'bg-amber-500/10 text-amber-600 border-amber-200', Low: 'bg-blue-500/10 text-blue-600 border-blue-200' }[p] || 'bg-slate-100 text-slate-400');

  if (loading && tickets.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Syncing Support Hub</p>
      </div>
    );
  }

  const t = selectedTicket; // shorthand for modal

  return (
    <div className="relative min-h-screen bg-[#f8fafc] overflow-hidden">
      {/* Background Orbs for Depth */}
      <div className="fixed -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed -bottom-24 -left-24 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20 pt-12 relative px-4 lg:px-8">
        
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FiActivity className="text-primary" />
              Support Hub
            </h1>
            <p className="text-slate-500 text-sm mt-1">Manage and track support requests</p>
          </div>
          
          <div className="flex items-center gap-4">
            {user?.role !== 'staff' && (
              <button 
                onClick={() => { setNewTicket({ ...newTicket, branchId: user?.branchId || '' }); setShowCreateModal(true); }}
                className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-black transition-all shadow-sm hover:shadow-lg">
                <FiPlus size={18} />
                <span>{user?.role === 'admin' ? 'New Ticket' : 'Create Ticket'}</span>
              </button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Total Tickets', value: tickets.length, icon: <FiActivity />, color: 'text-slate-400', bg: 'bg-white', shadow: 'shadow-sm' },
            { label: 'Unassigned', value: tickets.filter(t => t.status === 'CREATED').length, icon: <FiClock />, color: 'text-amber-500', bg: 'bg-white', shadow: 'shadow-sm' },
            { label: 'In Progress', value: tickets.filter(t => t.status === 'IN_PROGRESS').length, icon: <FiRefreshCw />, color: 'text-blue-500', bg: 'bg-white', shadow: 'shadow-sm' },
            { label: 'Done', value: tickets.filter(t => t.status === 'CLOSED').length, icon: <FiCheckCircle />, color: 'text-emerald-500', bg: 'bg-white', shadow: 'shadow-sm' },
          ].map((s, i) => (
            <div key={i} className={`p-6 rounded-2xl ${s.bg} border border-slate-200 shadow-sm flex flex-col gap-4 hover:shadow-md transition-all duration-300`}>
              <div className={`w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-xl ${s.color}`}>{s.icon}</div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-slate-800 tracking-tight">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
          {/* Dashboard Toolbar */}
          <div className="p-6 border-b border-slate-100 bg-white flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
            <div>
              <h3 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                Ticket Management
              </h3>
              <p className="text-xs text-slate-500 mt-1">Real-time support monitoring</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
              <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 shadow-inner">
                {['status', 'priority'].map(key => (
                  <div key={key} className="relative">
                    <select value={filters[key]} onChange={e => setFilters({...filters, [key]: e.target.value})}
                      className="bg-transparent pl-4 pr-10 py-2.5 text-xs font-bold uppercase tracking-wider focus:text-primary outline-none appearance-none cursor-pointer border-r border-slate-200 last:border-0 min-w-[140px] transition-colors">
                      <option value="">{key}: ALL</option>
                      {(key === 'status' ? statuses : priorities).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                  </div>
                ))}
              </div>
              
              <div className="relative flex-1 xl:flex-none xl:w-[350px]">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <FiSearch className="text-slate-300" size={18} />
                </div>
                <input type="text" placeholder="Filter by subject, ID..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm font-medium outline-none focus:border-primary focus:bg-white transition-all placeholder:text-slate-400" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50">
                  {['Ticket ID', 'Ticket Title', 'Requested By', 'Priority', 'Status', 'Actions'].map((h, i) => (
                    <th key={i} className={`px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider ${i === 0 ? 'text-left' : h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map(ticket => (
                  <tr key={ticket.id} className="group cursor-pointer hover:bg-slate-50 transition-all duration-200" onClick={() => { setSelectedTicket(ticket); setShowDetailModal(true); }}>
                    <td className="px-6 py-4">
                       <div className="flex flex-col">
                          <span className="text-xs font-bold text-primary bg-primary/5 px-3 py-1 rounded-lg border border-primary/10 inline-block w-fit">{ticket.ticketId}</span>
                          <span className="text-[10px] text-slate-400 font-medium mt-1">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="space-y-0.5">
                          <div className="font-bold text-slate-800 text-sm">{ticket.title}</div>
                          <span className="text-xs text-slate-400 font-medium">{ticket.category?.name || 'General'}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 font-bold text-xs uppercase">
                             {ticket.customer?.name?.charAt(0) || <FiUser />}
                          </div>
                          <span className="text-sm font-bold text-slate-800">{ticket.customer?.name || 'Internal'}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${ticket.status === 'IN_PROGRESS' ? 'bg-blue-500 animate-pulse' : ticket.status === 'CLOSED' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                           <span className={`text-xs font-bold ${getStatusColor(ticket.status)} bg-transparent p-0`}>{ticket.status}</span>
                        </div>
                     </td>
                    <td className="px-6 py-4 text-right">
                       <button className="h-10 w-10 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all ml-auto">
                          <FiArrowRight size={18} />
                       </button>
                    </td>
                  </tr>
                ))}
                {tickets.length === 0 && (
                  <tr><td colSpan="6" className="py-20 text-center text-slate-400">
                    <FiMessageSquare size={32} className="mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-bold uppercase tracking-wider">No tickets found</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Create New Ticket</h2>
                    <p className="text-xs text-slate-500 mt-1">Submit a new support request</p>
                </div>
                <button type="button" onClick={closeCreateModal} className="text-slate-400 hover:text-slate-600 transition-colors"><FiXCircle size={24} /></button>
              </div>

              <form onSubmit={handleCreateTicket} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {user?.role !== 'customer' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Branch / Location</label>
                      <div className="relative">
                          <select 
                            required 
                            disabled={user?.role === 'admin' && user?.branchId}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm font-medium outline-none appearance-none disabled:opacity-70" 
                            value={newTicket.branchId}
                            onChange={e => { setNewTicket({...newTicket, branchId: e.target.value}); if (e.target.value) { fetchStaff(e.target.value); fetchBranchCustomers(e.target.value); fetchBranchAdmins(e.target.value); } }}>
                          <option value="">Select Branch</option>
                          {branches.map(b => <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>)}
                          </select>
                          <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 flex justify-between">
                      Category
                      <button type="button" onClick={() => setShowCategoryModal(true)} className="text-primary hover:underline font-bold text-[9px]">Add New</button>
                    </label>
                    <div className="relative">
                        <select required className="w-full bg-slate-50 border border-slate-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm font-medium outline-none appearance-none" value={newTicket.categoryId}
                        onChange={e => setNewTicket({...newTicket, categoryId: e.target.value})}>
                        <option value="">Select Category</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
                        </select>
                        <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {user?.role === 'admin' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 flex justify-between">
                      Link to Customer
                      <button type="button" onClick={() => {
                        sessionStorage.setItem('draftTicket', JSON.stringify(newTicket));
                        closeCreateModal();
                        router.push({ pathname: '/customers', query: { returnTo: '/ticketing?openCreate=true', autoOpenAdd: 'true' } });
                      }} className="text-primary hover:underline font-bold text-[9px]">Add New</button>
                    </label>
                    <div className="relative">
                        <select required className="w-full bg-slate-50 border border-slate-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm font-medium outline-none appearance-none" value={newTicket.customerId}
                        onChange={e => setNewTicket({...newTicket, customerId: e.target.value})}>
                        <option value="">Select Customer</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                        </select>
                        <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Subject</label>
                  <input type="text" required placeholder="What is this regarding?" className="w-full bg-slate-50 border border-slate-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-all"
                    value={newTicket.title} onChange={e => setNewTicket({...newTicket, title: e.target.value})} />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Detailed Description</label>
                  <textarea required placeholder="Describe the issue in detail..." className="w-full bg-slate-50 border border-slate-200 focus:border-primary rounded-xl px-4 py-3 text-sm font-medium outline-none min-h-[120px] resize-none transition-all"
                    value={newTicket.description} onChange={e => setNewTicket({...newTicket, description: e.target.value})} />
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Priority Level</label>
                   <div className="flex gap-2 p-1 bg-slate-50 rounded-xl border border-slate-100">
                     {priorities.map(p => (
                       <button key={p} type="button" onClick={() => setNewTicket({...newTicket, priority: p})}
                         className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all ${newTicket.priority === p ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{p}</button>
                     ))}
                   </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Attachments</label>
                  <div className="relative group">
                    <input type="file" onChange={e => setNewTicket({...newTicket, file: e.target.files[0]})} 
                      className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    <div className="w-full border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5 transition-all bg-slate-50/50">
                       <FiLayers size={20} className="text-slate-300 group-hover:text-primary transition-colors" />
                       <div className="text-center">
                           <span className="text-[11px] font-bold text-slate-500 block truncate max-w-[300px]">{newTicket.file ? newTicket.file.name : 'Choose a file or drag and drop'}</span>
                           <span className="text-[9px] text-slate-400 uppercase tracking-wider mt-1 block">Images or Documents (Doc, PDF)</span>
                       </div>
                    </div>
                  </div>
                </div>

                <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-black transition-all active:scale-[0.98] mt-4 shadow-lg shadow-slate-200">
                   Create Support Ticket
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── DETAIL MODAL ─── */}
      {/* (rest of the file stays same) */}
      <AnimatePresence>
        {showDetailModal && t && (
          <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-6xl h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col lg:flex-row overflow-hidden border border-slate-200">
              
              {/* LEFT: Ticket Content */}
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className="px-8 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 rounded bg-slate-900 text-white text-[10px] font-bold tracking-wider">#{t.ticketId}</span>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${getStatusColor(t.status)}`}>{t.status}</span>
                  </div>
                  <button onClick={closeDetailAndClearUrl} className="text-slate-400 hover:text-slate-600 transition-colors"><FiXCircle size={22} /></button>
                </div>

                <div className="px-8 py-6 border-b border-slate-100 shrink-0 bg-white">
                   <h2 className="text-xl font-bold text-slate-800 tracking-tight">{t.title}</h2>
                   <div className="flex flex-wrap items-center gap-4 mt-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getPriorityColor(t.priority)}`}>{t.priority}</span>
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><FiTag size={14} className="text-primary" /> {t.category?.name || 'General'}</span>
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><FiMapPin size={14} className="text-blue-500" /> {t.branch?.name || 'Branch'}</span>
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><FiCalendar size={14} /> {new Date(t.createdAt).toLocaleDateString()}</span>
                   </div>
                </div>

                {/* Tab Switcher */}
                <div className="px-8 mt-4 shrink-0 bg-white">
                  <div className="flex gap-1 p-1 bg-slate-50 rounded-xl w-fit border border-slate-100">
                    {[
                      { key: 'timeline', label: 'History', icon: <FiActivity size={14} /> },
                      { key: 'chat', label: `Messages (${t.messages?.length || 0})`, icon: <FiMessageSquare size={14} /> },
                    ].map(tab => (
                      <button key={tab.key} onClick={() => setActiveDetailTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeDetailTab === tab.key ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                        {tab.icon} {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-white">
                   {activeDetailTab === 'timeline' ? (
                      <div className="space-y-8">
                         {/* Description Card */}
                         <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                               <div className="w-1 h-1 rounded-full bg-primary" />
                               Description
                            </h4>
                            <p className="text-slate-700 text-sm font-medium leading-relaxed">{t.description}</p>
                            
                            {t.fileUrl && (
                               <div className="mt-4 pt-4 border-t border-slate-200">
                                  <button type="button" onClick={() => setPreviewFile(t.fileUrl)} 
                                     className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:border-primary hover:text-primary transition-all shadow-sm">
                                     <FiFileText className="text-primary" />
                                     View Attachment
                                  </button>
                               </div>
                            )}
                         </div>

                         {/* Timeline */}
                         <div className="space-y-6">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                               <div className="w-1 h-1 rounded-full bg-primary" />
                               Activity Log
                            </h4>
                            <div className="relative pl-4 space-y-8">
                               <div className="absolute left-[1.125rem] top-2 bottom-2 w-0.5 bg-slate-100" />
                               {t.history?.map((entry, i) => {
                                  const meta = getTimelineMeta(entry.action);
                                  return (
                                     <div key={i} className="relative pl-10">
                                        <div className={`absolute left-0 top-0 w-6 h-6 rounded-lg ${meta.bg} flex items-center justify-center text-white text-[10px] z-10 shadow-sm`}>
                                           {meta.icon}
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                           <div className="flex justify-between items-center mb-1">
                                              <span className={`text-[9px] font-bold uppercase tracking-wider ${meta.text}`}>{meta.label}</span>
                                              <span className="text-[9px] text-slate-400 font-medium">{new Date(entry.createdAt).toLocaleString()}</span>
                                           </div>
                                           <p className="text-xs font-bold text-slate-800 leading-normal">{entry.message}</p>
                                           {entry.reason && (
                                              <div className="mt-2 bg-amber-50 p-2 rounded-lg border border-amber-100 text-[10px] text-amber-700 font-medium">
                                                 <span className="font-bold mr-1">Reason:</span> {entry.reason}
                                              </div>
                                           )}
                                           <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-50">
                                              <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                                 {entry.doneBy?.name?.charAt(0) || entry.doneBy?.username?.charAt(0)}
                                              </div>
                                              <span className="text-[10px] font-bold text-slate-500">{entry.doneBy?.name || 'System'}</span>
                                              <span className="text-[10px] text-slate-300 font-medium">• {entry.role}</span>
                                           </div>
                                        </div>
                                     </div>
                                  );
                               })}
                            </div>
                         </div>
                      </div>
                   ) : (
                      <div className="flex flex-col h-full">
                         <div className="flex-1 space-y-6 mb-24">
                            {t.messages?.map((msg, i) => (
                               <div key={i} className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                                  <div className="max-w-[85%]">
                                     <div className={`flex items-center gap-2 mb-1 ${msg.senderId === user?.id ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{msg.role}</span>
                                        <span className="text-[9px] text-slate-300 font-medium">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                                     </div>
                                     <div className={`p-4 rounded-2xl text-xs font-medium leading-relaxed border shadow-sm ${msg.senderId === user?.id ? 'bg-slate-900 text-white border-slate-800 rounded-tr-none' : 'bg-slate-50 text-slate-700 border-slate-200 rounded-tl-none'}`}>
                                        {msg.message}
                                     </div>
                                  </div>
                               </div>
                            ))}
                            <div ref={chatEndRef} />
                         </div>
                         
                         <div className="sticky bottom-0 bg-white pt-4 pb-2 flex gap-2">
                            <input type="text" placeholder="Type a message..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-primary transition-all"
                              value={messageText} onChange={e => setMessageText(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleMessage(e)} />
                            <button onClick={handleMessage} className="bg-slate-900 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-black transition-all shadow-md">
                               <FiSend size={18} />
                            </button>
                         </div>
                      </div>
                   )}
                </div>
              </div>

              {/* Sidebar: Actions */}
              <div className="w-full lg:w-[320px] bg-slate-50 border-l border-slate-100 flex flex-col shrink-0 relative">
                <div className="p-6 border-b border-slate-200 bg-white">
                  <h3 className="text-lg font-bold text-slate-800">Actions</h3>
                  <p className="text-xs text-slate-500 mt-1">Ticket management</p>
                </div>

                <div className="p-6 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                   {/* Entities */}
                   <div className="space-y-4">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                         <div className="w-1 h-1 rounded-full bg-primary" />
                         Participants
                      </h4>
                      <div className="space-y-3">
                         <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-[10px] font-bold text-primary uppercase mb-1">Customer</p>
                            <p className="text-sm font-bold text-slate-900">{t.customer?.name || 'User'}</p>
                            <p className="text-[11px] text-slate-400 font-medium">{t.customer?.phone || 'No Phone'}</p>
                         </div>
                         {t.assignedTo ? (
                            <div className="bg-slate-900 p-4 rounded-xl shadow-lg border border-slate-800 text-white">
                               <p className="text-[10px] font-bold text-primary uppercase mb-1">Assigned Agent</p>
                               <p className="text-sm font-bold">{t.assignedTo.name}</p>
                               <p className="text-[11px] text-slate-500 font-medium">@{t.assignedTo.username}</p>
                            </div>
                         ) : (
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-center gap-3">
                               <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-amber-500 shadow-sm"><FiUserCheck /></div>
                               <span className="text-xs font-bold text-amber-700">Waiting for Agent</span>
                            </div>
                         )}
                      </div>
                   </div>

                   {/* Admin controls */}
                   {user?.role === 'admin' && (
                      <div className="space-y-4 pt-6 border-t border-slate-200">
                         <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assignment Control</h4>
                         <div className="relative">
                            <select className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider outline-none appearance-none"
                               value={assignStaffId} onChange={e => setAssignStaffId(e.target.value)}>
                               <option value="">Choose Agent</option>
                               {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                         </div>
                         <div className="space-y-2">
                            <button disabled={t.status === 'CLOSED'} onClick={() => handleAssign(t.id)} className="w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-blue-700 transition-all shadow-md disabled:opacity-50">
                               {t.assignedTo ? 'Re-assign Agent' : 'Assign Agent'}
                            </button>
                            {t.status !== 'CLOSED' && (
                              <button onClick={() => handleMarkAsIgnored(t.id)} className="w-full py-2.5 text-red-500 text-[10px] font-bold uppercase hover:bg-red-50 rounded-lg transition-all">Flag as Ignored</button>
                            )}
                         </div>
                      </div>
                    )}

                    {/* Staff Actions */}
                    {user?.role === 'staff' && t.assignedToId === user.id && t.status !== 'CLOSED' && (
                       <div className="space-y-3 pt-6 border-t border-slate-200">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ticket Management</h4>
                          
                          {t.status === 'ASSIGNED' && (
                             <button onClick={() => handleAccept(t.id)} className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-emerald-700 transition-all shadow-md flex items-center justify-center gap-2">
                                <FiCheckCircle /> Accept Ticket
                             </button>
                          )}

                          {t.status === 'IN_PROGRESS' && (
                             <>
                                <button onClick={() => handleComplete(t.id)} className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-black transition-all shadow-md flex items-center justify-center gap-2">
                                   <FiCheckCircle /> Complete Ticket
                                </button>
                                <button onClick={() => { setReassignMode('STAFF'); setShowReassignModal(true); }} className="w-full py-3 bg-white border border-red-200 text-red-600 rounded-xl text-[10px] font-bold uppercase hover:bg-red-50 transition-all flex items-center justify-center gap-2">
                                   <FiRefreshCw /> Reassign Ticket
                                </button>
                             </>
                          )}
                       </div>
                    )}

                   {/* Staff status update */}
                   {(user?.role === 'admin' || (user?.role === 'staff' && t.assignedToId === user.id)) && t.status !== 'CLOSED' && t.status !== 'CREATED' && (
                      <div className="space-y-4 pt-6 border-t border-slate-200">
                         <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Update Progress</h4>
                         <div className="grid grid-cols-2 gap-2">
                            {statuses.filter(s => s !== 'CLOSED' && s !== 'CREATED' && s !== 'REJECTED').map(s => (
                               <button key={s} onClick={() => setStatusUpdate({...statusUpdate, status: s})}
                                  className={`py-2 rounded-lg text-[10px] font-bold uppercase border transition-all ${statusUpdate.status === s ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}>{s}</button>
                            ))}
                         </div>
                         <textarea placeholder="Write update..." className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium outline-none focus:border-primary min-h-[100px] resize-none"
                            value={statusUpdate.message} onChange={e => setStatusUpdate({...statusUpdate, message: e.target.value})} />
                         <button disabled={!statusUpdate.status} onClick={() => handleStatusUpdate(t.id)}
                            className="w-full py-3 bg-slate-900 text-white rounded-xl text-[11px] font-bold uppercase transition-all disabled:opacity-50 shadow-md">Update Status</button>
                      </div>
                   )}

                   {/* Closure Request Approval (Admin) */}
                   {user?.role === 'admin' && t.status === 'ClosureRequested' && (
                      <div className="space-y-4 pt-6 border-t border-amber-200 bg-amber-50 rounded-xl p-4">
                         <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-2">
                            <FiAlertTriangle /> Closure Auth
                         </h4>
                         <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => handleClosureApproval(t.closureRequests?.[0]?.id, 'Approved')} className="py-2.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase shadow-sm">Approve</button>
                            <button onClick={() => handleClosureApproval(t.closureRequests?.[0]?.id, 'Rejected')} className="py-2.5 bg-red-600 text-white rounded-lg text-[10px] font-bold uppercase shadow-sm">Reject</button>
                         </div>
                      </div>
                   )}

                   {/* Metadata card */}
                   <div className="pt-6 border-t border-slate-200">
                      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg border border-slate-800">
                         <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-4">Ticket Metadata</h4>
                         <div className="space-y-3">
                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                               <span className="text-[9px] font-bold uppercase text-white/30 truncate">Created</span>
                               <span className="text-[10px] font-bold">{new Date(t.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                               <span className="text-[9px] font-bold uppercase text-white/30 truncate">Last Update</span>
                               <span className="text-[10px] font-bold">{new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="flex justify-between items-center">
                               <span className="text-[9px] font-bold uppercase text-white/30 truncate">Category</span>
                               <span className="text-[10px] font-bold text-primary">{t.category?.name || 'General'}</span>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── REASSIGN MODAL ─── */}
      <AnimatePresence>
        {showReassignModal && (
          <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/20 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200">
              <form onSubmit={handleReassign} className="space-y-4">
                {reassignMode === 'STAFF' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Select Successor (Optional)</label>
                    <div className="relative">
                      <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider outline-none appearance-none"
                        value={nextStaffId} onChange={e => setNextStaffId(e.target.value)}>
                        <option value="">Leave Unassigned (Admin Action)</option>
                        {staff.filter(s => s.id !== user?.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Reason for Reassignment</label>
                  <textarea required placeholder="Reason for reassignment..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none min-h-[100px]"
                    value={reassignReason} onChange={e => setReassignReason(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowReassignModal(false)} className="flex-1 py-2.5 text-slate-500 font-bold text-xs uppercase hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button type="submit" className="flex-1 py-2.5 bg-red-600 text-white font-bold text-xs uppercase rounded-lg hover:bg-red-700">Confirm Reassign</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── FULLSCREEN ATTACHMENT VIEWER ─── */}
      <AnimatePresence>
        {previewFile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10005] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 md:p-8">
            <button onClick={() => setPreviewFile(null)} className="absolute top-6 right-6 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-all">
              <FiXCircle size={28} />
            </button>
            <div className="text-center mb-4 text-white font-bold tracking-widest uppercase text-xs">Attachment Preview</div>
            {previewFile.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) ? (
              <img src={`http://localhost:5000${previewFile}`} alt="Attachment" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl drop-shadow-2xl" />
            ) : (
              <iframe src={`http://localhost:5000${previewFile}`} title="Attachment Viewer" className="w-full max-w-6xl h-[85vh] bg-white rounded-xl shadow-2xl drop-shadow-2xl" />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── ADD CATEGORY MODAL ─── */}
      <AnimatePresence>
        {showCategoryModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Add New Category</h2>
                  <p className="text-xs text-slate-500 mt-1">Create a category for tickets</p>
                </div>
                <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><FiXCircle size={24} /></button>
              </div>
              <form onSubmit={handleCreateCategory} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Category Name</label>
                  <input type="text" required placeholder="e.g. Hardware Issue" className="w-full bg-slate-50 border border-slate-200 focus:border-primary rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-all"
                    value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} autoFocus />
                </div>
                <button type="submit" className="w-full py-3 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-primary-dark transition-all shadow-md">
                   Save Category
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

