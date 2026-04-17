import { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  FiTag, FiClock, FiCheckCircle, FiXCircle, FiUser, FiCalendar, FiFilter, FiTrendingUp, FiAlertCircle,
  FiChevronLeft, FiChevronRight, FiMoreHorizontal, FiMessageSquare, FiInfo, FiActivity
} from 'react-icons/fi';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import moment from 'moment';
import SearchableSelect from '@/components/SearchableSelect';
import { motion, AnimatePresence } from 'framer-motion';

// Register ChartJS
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function TicketingDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    role: '',
    personId: 'all',
    startDate: moment().subtract(30, 'days').format('YYYY-MM-DD'),
    endDate: moment().format('YYYY-MM-DD'),
    page: 1,
    limit: 10,
    status: ''
  });
  const [peopleOptions, setPeopleOptions] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  // Activity Overview States
  const [viewMode, setViewMode] = useState('overview'); // 'overview' or 'detail'
  const [summaryUser, setSummaryUser] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryStats, setSummaryStats] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [filters.role, filters.personId, filters.startDate, filters.endDate, filters.page, filters.status]);

  useEffect(() => {
    if (filters.role) {
      fetchPeopleOptions();
    } else {
      setPeopleOptions([]);
    }
  }, [filters.role]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tickets/stats', { params: filters });
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch ticket stats', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPeopleOptions = async () => {
    try {
      let endpoint = '';
      if (filters.role === 'customer') {
        endpoint = '/tickets/branch-customers';
      } else if (filters.role === 'employee') {
        endpoint = '/tickets/branch-agents';
      }

      if (endpoint) {
        const res = await api.get(endpoint);
        const options = res.data.map(item => ({
          value: item.id,
          label: `${item.name} (${item.username || item.phone || ''})`,
          role: item.role?.toLowerCase(),
          original: item
        }));
        setPeopleOptions(options);
      }
    } catch (err) {
      console.error('Failed to fetch people options', err);
    }
  };

  const fetchUserSummary = async (userId) => {
    try {
      setLoadingSummary(true);
      const res = await api.get('/tickets/stats', { 
        params: { ...filters, personId: userId, page: 1, limit: 1 } 
      });
      setSummaryStats(res.data);
    } catch (err) {
      console.error('Failed to fetch user summary', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const newFilters = {
        ...prev,
        [key]: value,
        ...(key !== 'page' ? { page: 1 } : {}),
        ...(key === 'role' && value === '' ? { personId: 'all' } : {})
      };
      return newFilters;
    });
  };

  const openSummaryModal = (user) => {
    setSummaryUser(user);
    setShowSummaryModal(true);
    fetchUserSummary(user.id);
  };

  const navigateToDetail = (userId) => {
    handleFilterChange('personId', userId);
    setViewMode('detail');
    setShowSummaryModal(false);
  };

  const openTicketDetails = (ticket) => {
    setSelectedTicket(ticket);
    setShowModal(true);
  };

  // Chart 1: Status Summary Bar Chart
  const statusBarData = {
    labels: stats ? Object.keys(stats.statusDistribution).map(s => s.toUpperCase()) : [],
    datasets: [
      {
        label: 'Tickets',
        data: stats ? Object.values(stats.statusDistribution) : [],
        backgroundColor: [
          '#6366f1', // Created
          '#3b82f6', // Assigned
          '#f59e0b', // InProgress
          '#10b981', // Closed
          '#a855f7', // Reassigned
          '#f43f5e', // Overdue/Other
          '#94a3b8', // Waiting
        ],
        borderRadius: 6,
        barThickness: 32,
      }
    ]
  };

  // Chart 2: Distribution (e.g. by Category)
  const distributionData = {
    labels: stats?.tickets ? [...new Set(stats.tickets.map(t => t.category?.name || 'General'))] : [],
    datasets: [
      {
        label: 'Volume',
        data: stats?.tickets ? (function() {
          const counts = {};
          stats.tickets.forEach(t => {
            const cat = t.category?.name || 'General';
            counts[cat] = (counts[cat] || 0) + 1;
          });
          return Object.values(counts);
        })() : [],
        backgroundColor: '#cbd5e1',
        borderRadius: 6,
        barThickness: 24,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { 
        backgroundColor: '#1e293b',
        padding: 12,
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 12 },
        usePointStyle: true,
        cornerRadius: 8
      }
    },
    scales: {
      y: { 
        beginAtZero: true, 
        ticks: { stepSize: 1, font: { size: 10, weight: '500' }, color: '#94a3b8' }, 
        grid: { color: '#f1f5f9', drawBorder: false } 
      },
      x: { 
        grid: { display: false, drawBorder: false }, 
        ticks: { font: { size: 10, weight: '600' }, color: '#64748b' } 
      }
    }
  };

  const currentTier = !filters.role ? 'main' : (filters.personId === 'all' ? 'role-list' : 'detail');

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 lg:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1 space-y-1">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Ticketing Intelligence</h1>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              {viewMode === 'detail' ? 'Individual Performance Matrix' : 'Real-time System Activity'}
            </p>
          </div>
        </div>

        {currentTier === 'detail' && (
          <button 
            onClick={() => handleFilterChange('personId', 'all')}
            className="h-11 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl px-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-100 transition-all mr-4 shadow-sm"
          >
            <FiChevronLeft size={16} /> Back to Participant List
          </button>
        )}
        {currentTier === 'role-list' && (
          <button 
            onClick={() => handleFilterChange('role', '')}
            className="h-11 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl px-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-100 transition-all mr-4 shadow-sm"
          >
            <FiChevronLeft size={16} /> Back to Global Overview
          </button>
        )}
        <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-slate-100">
           <FiCalendar className="text-indigo-400" />
           <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest leading-none">{moment().format('MMMM Do, YYYY')}</span>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-6 items-end">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">View Role</label>
          <div className="relative">
            <FiFilter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            <select 
              className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none"
              value={filters.role}
              onChange={(e) => handleFilterChange('role', e.target.value)}
            >
              <option value="">Company Overview</option>
              <option value="customer">Customers</option>
              <option value="employee">Employees</option>
            </select>
          </div>
        </div>

        <div className={`space-y-2 ${!filters.role ? 'opacity-40 cursor-not-allowed' : ''}`}>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
            {filters.role ? `Filter by ${filters.role}` : 'Select Role First'}
          </label>
          <SearchableSelect
            options={[{ value: 'all', label: `All ${filters.role || 'Users'}s` }, ...peopleOptions]}
            value={filters.personId}
            onChange={(val) => handleFilterChange('personId', val)}
            placeholder="Search name..."
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">From Date</label>
          <div className="relative">
            <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="date"
              className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">To Date</label>
          <div className="relative">
            <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="date"
              className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
        </div>

        <button 
          onClick={() => setFilters({ role: '', personId: 'all', startDate: moment().subtract(30, 'days').format('YYYY-MM-DD'), endDate: moment().format('YYYY-MM-DD'), page: 1, limit: 10, status: '' })}
          className="h-11 bg-white border border-slate-200 text-slate-600 rounded-xl px-6 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all"
        >
          Reset
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
        <StatCard title="Total Volume" value={stats?.summary.total} icon={<FiTag />} color="text-indigo-600" />
        <StatCard title="Active Open" value={stats?.summary.open} icon={<FiClock />} color="text-blue-500" />
        <StatCard title="In Progress" value={stats?.summary.inProgress} icon={<FiActivity />} color="text-amber-500" />
        <StatCard title="Total Closed" value={stats?.summary.closed} icon={<FiCheckCircle />} color="text-emerald-500" />
        <StatCard title="Overdue Alert" value={stats?.summary.overdue} icon={<FiAlertCircle />} color="text-rose-500" />
      </div>

      {currentTier !== 'role-list' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 lg:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">Role Status Matrix</h3>
            <div className="h-[300px] w-full">
                {loading ? <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl" /> : <Bar data={statusBarData} options={chartOptions} />}
            </div>
          </div>

          <div className="bg-white p-6 lg:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">Category Distribution</h3>
            <div className="h-[300px] w-full">
                {loading ? <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl" /> : <Bar data={distributionData} options={chartOptions} />}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
           <div className="flex justify-between items-center mb-10">
              <div className="space-y-1">
                 <h3 className="text-xl font-bold text-slate-900 tracking-tight">System Activity Insights</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select {filters.role} to view detailed performance</p>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats?.tickets && (function() {
                const participantsNodes = stats.tickets.flatMap(t => {
                   const nodes = [];
                   if (t.customer) nodes.push({ ...t.customer, role: 'customer', type: 'Customer' });
                   if (t.assignedTo) nodes.push({ ...t.assignedTo, role: 'employee', type: 'Assigned Agent' });
                   if (t.createdBy && t.createdBy.role !== 'customer') nodes.push({ ...t.createdBy, role: 'employee', type: 'Creator' });
                   if (t.reassignedTo) nodes.push({ ...t.reassignedTo, role: 'employee', type: 'Reassigned Agent' });
                   return nodes;
                });
                
                const uniqueParticipants = participantsNodes.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
                
                return uniqueParticipants
                  .filter(user => !filters.role || user.role === filters.role)
                  .map(user => {
                    const involvements = [...new Set(participantsNodes.filter(p => p.id === user.id).map(p => p.type))];
                    return (
                      <button 
                        key={user.id} 
                        onClick={() => openSummaryModal(user)}
                        className="p-6 bg-white border border-slate-100 rounded-3xl text-left hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all group flex items-start gap-5"
                      >
                         <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xl font-bold text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                           {user.name?.charAt(0)}
                         </div>
                         <div className="flex-1 min-w-0 space-y-2">
                            <p className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{user.name}</p>
                            <div className="flex flex-wrap gap-1.5">
                               {involvements.map(inv => (
                                 <span key={inv} className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-bold uppercase tracking-wider rounded-md border border-slate-200/50">
                                   {inv}
                                 </span>
                               ))}
                            </div>
                         </div>
                         <div className="flex flex-col items-center">
                            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                              <FiActivity size={18} />
                            </div>
                            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Action</span>
                         </div>
                      </button>
                    );
                  });
              })()}
           </div>
           
           {!loading && stats?.tickets.length === 0 && (
             <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                <FiActivity className="mx-auto text-4xl text-slate-200 mb-4" />
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">No active participants detected in this timeframe</p>
             </div>
           )}
        </div>
      )}

      {/* Detail/Main View Table Section */}
      {(currentTier === 'main' || currentTier === 'detail') && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
           <div className="lg:col-span-4 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
             <div className="px-8 py-6 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-0.5">
                  <h3 className="text-lg font-bold text-slate-800 tracking-tight">
                    {currentTier === 'detail' ? `Performance History for ${peopleOptions.find(p => p.value === filters.personId)?.label.split(' (')[0]}` : 'Global Ticket Lifecycle'}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Comprehensive entry log and status tracking</p>
                </div>
                
                {currentTier === 'detail' && (
                  <div className="flex flex-wrap items-center gap-2">
                     {['', 'created', 'assigned', 'reassigned', 'inprogress', 'closed'].map(s => (
                       <button
                         key={s}
                         onClick={() => handleFilterChange('status', s)}
                         className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
                           filters.status === s 
                           ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200' 
                           : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                         }`}
                       >
                         {s || 'All States'}
                       </button>
                     ))}
                  </div>
                )}
                {loading && <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
             </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-8 py-5">Ticket ID</th>
                <th className="px-8 py-5">Customer</th>
                <th className="px-8 py-5">Summary</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5">Priority</th>
                <th className="px-8 py-5 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stats?.tickets.map(t => (
                <tr key={t.id} className="hover:bg-indigo-50/20 transition-all cursor-pointer group" onClick={() => openTicketDetails(t)}>
                  <td className="px-8 py-5 font-bold text-indigo-600 text-sm group-hover:underline">{t.ticketId}</td>
                  <td className="px-8 py-5 text-sm font-medium text-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">{t.customer?.name?.charAt(0) || 'C'}</div>
                      <div>
                        <p className="font-bold text-slate-800">{t.customer?.name || 'Internal'}</p>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-tighter">{t.category?.name || 'General'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-bold text-slate-800 truncate max-w-[200px]">{t.title}</p>
                    <p className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">{t.description}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${getStatusStyles(t.status)} border border-slate-200/50`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${getPriorityStyles(t.priority)}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right font-semibold text-slate-400 text-xs text-nowrap">
                    {moment(t.createdAt).format('DD MMM, LT')}
                    <div className="text-[9px] font-bold uppercase text-slate-300 mt-1">{moment(t.createdAt).fromNow()}</div>
                  </td>
                </tr>
              ))}
              {!loading && stats?.tickets.length === 0 && (
                <tr>
                   <td colSpan="6" className="py-20 text-center text-slate-400 italic font-medium uppercase tracking-widest opacity-50">
                      <FiTag className="mx-auto mb-4 text-4xl opacity-10" />
                      No tickets match criteria
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-8 py-5 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing <span className="text-slate-800">{stats?.tickets.length || 0}</span> of <span className="text-indigo-600">{stats?.pagination.total || 0}</span> entries
          </p>
          <div className="flex items-center gap-3">
            <button 
              disabled={filters.page === 1}
              onClick={() => handleFilterChange('page', filters.page - 1)}
              className="h-10 px-5 rounded-2xl bg-white border border-slate-200 flex items-center gap-2 text-[10px] font-bold text-slate-600 hover:border-indigo-500 hover:text-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-widest"
            >
              <FiChevronLeft size={16} /> Prev
            </button>
            
            <button 
              disabled={filters.page === stats?.pagination.pages}
              onClick={() => handleFilterChange('page', filters.page + 1)}
              className="h-10 px-5 rounded-2xl bg-white border border-slate-200 flex items-center gap-2 text-[10px] font-bold text-slate-600 hover:border-indigo-500 hover:text-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-widest"
            >
              Next <FiChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

      {/* Ticket Details Modal */}
      <AnimatePresence>
        {showModal && selectedTicket && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl overflow-hidden">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[1.5rem] shadow-2xl flex flex-col md:flex-row overflow-hidden border border-slate-100"
            >
              {/* Left Side: Detail & Timeline */}
              <div className="flex-1 flex flex-col min-h-0 bg-white">
                <div className="p-8 border-b border-slate-50 flex justify-between items-start shrink-0">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">{selectedTicket.ticketId}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${getStatusStyles(selectedTicket.status)} shadow-sm`}>{selectedTicket.status}</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 leading-tight">{selectedTicket.title}</h2>
                  </div>
                  <button onClick={() => setShowModal(false)} className="w-9 h-9 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all">
                    <FiXCircle size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
                   {/* Description */}
                   <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-3 bg-indigo-600 rounded-full"></div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Initial Request Description</h4>
                      </div>
                      <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 text-sm font-medium text-slate-700 leading-relaxed">
                        {selectedTicket.description}
                      </div>
                   </div>

                   {/* History Timeline */}
                   <div className="space-y-6">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-3 bg-indigo-600 rounded-full"></div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Processing History & Log</h4>
                      </div>
                      <div className="relative pl-6 space-y-8 ml-2">
                         <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-slate-100" />
                         {selectedTicket.history?.map((entry, idx) => (
                           <div key={idx} className="relative group">
                              <div className="absolute left-[-29px] top-0 w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-indigo-500 shadow-sm z-10 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                {idx + 1}
                              </div>
                              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                 <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{entry.action}</span>
                                    <span className="text-[9px] font-semibold text-slate-300">{moment(entry.createdAt).format('DD MMM, LT')}</span>
                                 </div>
                                 <p className="text-xs font-semibold text-slate-700 leading-snug">{entry.message}</p>
                                 <div className="mt-3 flex items-center justify-between opacity-80">
                                    <div className="flex items-center gap-1.5">
                                       <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold">{entry.doneBy?.name?.charAt(0)}</div>
                                       <span className="text-[10px] font-semibold text-slate-500 uppercase">{entry.doneBy?.name || 'User'}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-300 font-semibold uppercase tracking-widest">{entry.role}</span>
                                 </div>
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>
              </div>

              {/* Right Side: Meta Info */}
              <div className="w-full md:w-[320px] bg-slate-50 border-l border-slate-100 flex flex-col shrink-0 p-8 space-y-8 overflow-y-auto custom-scrollbar">
                <div className="space-y-6">
                   <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Technical Overview</h4>
                   
                   <MetaItem label="Priority" value={selectedTicket.priority} icon={<FiTag />} style={getPriorityStyles(selectedTicket.priority)} />
                   <MetaItem label="Ticket Category" value={selectedTicket.category?.name || 'General'} icon={<FiFilter />} />
                   <MetaItem label="SLA Compliance" value={selectedTicket.slaStatus || 'On Time'} icon={<FiClock />} style={selectedTicket.slaStatus === 'Delayed' ? 'text-rose-500' : 'text-emerald-500'} />
                </div>

                <div className="space-y-6">
                   <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Assigned Personnel</h4>
                   <div className="space-y-4">
                      <PersonCard role="Assigned Agent" name={selectedTicket.assignedTo?.name} username={selectedTicket.assignedTo?.username} />
                      <PersonCard role="Requester (Customer)" name={selectedTicket.customer?.name} phone={selectedTicket.customer?.phone} />
                      <PersonCard role="Account Manager" name={selectedTicket.createdBy?.name} isStaff={selectedTicket.createdBy?.role !== 'customer'} />
                   </div>
                </div>

                <div className="flex-1" />

                <div className="pt-6 border-t border-slate-200">
                  <div className="bg-indigo-600 rounded-[1.25rem] p-5 text-white shadow-lg shadow-indigo-100 relative overflow-hidden group">
                     <div className="relative z-10">
                        <p className="text-white/70 text-[9px] font-bold uppercase tracking-widest mb-1">Messages</p>
                        <h5 className="text-lg font-bold">{selectedTicket.messages?.length || 0} Interactions</h5>
                     </div>
                     <FiMessageSquare className="absolute -right-2 -bottom-2 text-6xl text-white/10 rotate-12 group-hover:scale-110 transition-transform" />
                  </div>
                  <p className="text-[9px] text-center text-slate-400 font-semibold uppercase tracking-widest mt-4">Last Updated {moment(selectedTicket.updatedAt).fromNow()}</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Stats Modal */}
      <AnimatePresence>
        {showSummaryModal && summaryUser && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
             >
                <div className="p-8 text-center space-y-6">
                   <div className="w-20 h-20 rounded-[2rem] bg-indigo-600 text-white flex items-center justify-center text-3xl font-extrabold mx-auto shadow-xl shadow-indigo-200">
                      {summaryUser.name?.charAt(0)}
                   </div>
                   <div className="space-y-1">
                      <h3 className="text-xl font-bold text-slate-900">{summaryUser.name}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{summaryUser.role} Performance Snapshot</p>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                         <p className="text-xs font-bold text-slate-800">{summaryStats?.summary.total || 0}</p>
                         <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                      </div>
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                         <p className="text-xs font-bold text-indigo-600">{summaryStats?.summary.inProgress || 0}</p>
                         <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">In Progress</p>
                      </div>
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                         <p className="text-xs font-bold text-emerald-600">{summaryStats?.summary.closed || 0}</p>
                         <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Closed</p>
                      </div>
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                         <p className="text-xs font-bold text-rose-500">{summaryStats?.summary.overdue || 0}</p>
                         <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Overdue</p>
                      </div>
                   </div>

                   <div className="flex gap-4 pt-4">
                      <button 
                        onClick={() => setShowSummaryModal(false)}
                        className="flex-1 h-12 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                      >
                        Dismiss
                      </button>
                      <button 
                        onClick={() => navigateToDetail(summaryUser.id)}
                        className="flex-[2] h-12 bg-indigo-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-indigo-100"
                      >
                        View Full Details
                      </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-all duration-300">
      <div className="relative z-10 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-xl ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-0.5">{title}</p>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{value || 0}</h2>
        </div>
      </div>
    </div>
  );
}

function MetaItem({ label, value, icon, style = 'text-slate-700' }) {
  return (
    <div className="flex items-start gap-3">
       <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 text-sm">{icon}</div>
       <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
          <p className={`text-xs font-bold uppercase tracking-widest ${style}`}>{value}</p>
       </div>
    </div>
  );
}

function PersonCard({ role, name, username, phone, isStaff }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2">
       <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{role}</p>
       <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold ${isStaff ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-50 text-slate-400'}`}>
            {name?.charAt(0) || <FiUser />}
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-700 leading-none">{name || 'Unassigned'}</p>
            {(username || phone) && <p className="text-[9px] text-slate-400 font-semibold mt-1 uppercase tracking-widest">@{username || phone}</p>}
          </div>
       </div>
    </div>
  );
}

function getStatusStyles(status) {
  const s = status?.toLowerCase();
  if (['created', 'new'].includes(s)) return 'bg-emerald-50 text-emerald-600 border-emerald-100';
  if (['assigned', 'linked'].includes(s)) return 'bg-blue-50 text-blue-600 border-blue-100';
  if (['inprogress', 'active', 'in_progress'].includes(s)) return 'bg-indigo-50 text-indigo-600 border-indigo-100';
  if (['reassigned'].includes(s)) return 'bg-purple-50 text-purple-600 border-purple-100';
  if (['closed', 'completed', 'resolved'].includes(s)) return 'bg-slate-100 text-slate-500 border-slate-200';
  if (s === 'waiting') return 'bg-amber-50 text-amber-600 border-amber-100';
  if (['overdue', 'rejected', 'ignored'].includes(s)) return 'bg-rose-50 text-rose-500 border-rose-100';
  return 'bg-slate-50 text-slate-400';
}

function getPriorityStyles(p) {
  const v = p?.toLowerCase();
  if (v === 'high') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (v === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (v === 'low') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  return 'bg-slate-50 text-slate-400 border-slate-200';
}
