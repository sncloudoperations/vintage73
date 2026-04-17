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
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import moment from 'moment';
import SearchableSelect from '@/components/SearchableSelect';
import { motion, AnimatePresence } from 'framer-motion';

// Register ChartJS
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
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
    limit: 10
  });
  const [peopleOptions, setPeopleOptions] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [filters.role, filters.personId, filters.startDate, filters.endDate, filters.page]);

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
      } else if (filters.role === 'staff' || filters.role === 'admin') {
        endpoint = '/tickets/branch-agents';
      }

      if (endpoint) {
        const res = await api.get(endpoint);
        // Map based on response structure
        const options = res.data
          .filter(item => {
            if (filters.role === 'staff') return item.role?.toLowerCase() === 'staff';
            if (filters.role === 'admin') return item.role?.toLowerCase() === 'admin' || item.role?.toLowerCase() === 'branch-admin';
            return true;
          })
          .map(item => ({
            value: item.id,
            label: `${item.name} (${item.username || item.phone || ''})`
          }));
        setPeopleOptions(options);
      }
    } catch (err) {
      console.error('Failed to fetch people options', err);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      ...(key !== 'page' ? { page: 1 } : {}),
      ...(key === 'role' ? { personId: 'all' } : {})
    }));
  };

  const openTicketDetails = (ticket) => {
    setSelectedTicket(ticket);
    setShowModal(true);
  };

  // Chart Data
  const trendData = {
    labels: stats?.graphData?.map(d => moment(d.date).format('MMM DD')) || [],
    datasets: [
      {
        label: 'Created',
        data: stats?.graphData?.map(d => d.created) || [],
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Resolved',
        data: stats?.graphData?.map(d => d.resolved) || [],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const statusPieData = {
    labels: stats ? Object.keys(stats.statusDistribution) : [],
    datasets: [
      {
        data: stats ? Object.values(stats.statusDistribution) : [],
        backgroundColor: [
          '#6366f1', // Created
          '#3b82f6', // Assigned
          '#f59e0b', // InProgress
          '#10b981', // Closed
          '#f43f5e', // Overdue/Other
          '#94a3b8', // Waiting
        ],
        borderWidth: 0,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10, weight: '600' } } },
      tooltip: { 
        backgroundColor: '#1e293b',
        padding: 12,
        titleFont: { size: 14 },
        bodyFont: { size: 13 },
        usePointStyle: true
      }
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
      x: { grid: { display: false }, ticks: { font: { size: 10 } } }
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 lg:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Support Analytics</h1>
          <p className="text-slate-500 text-sm font-medium flex items-center gap-2">
            <FiActivity className="text-indigo-500" /> 
            Real-time performance monitoring and ticket tracking
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
           <FiCalendar className="text-slate-400" />
           <span className="text-xs font-semibold text-slate-700">{moment().format('MMMM Do, YYYY')}</span>
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
              <option value="">Full Company</option>
              <option value="customer">Customer Perspective</option>
              <option value="staff">Staff Performance</option>
              <option value="admin">Admin Oversight</option>
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
          onClick={() => setFilters({ ...filters, role: '', personId: 'all', startDate: moment().subtract(30, 'days').format('YYYY-MM-DD'), endDate: moment().format('YYYY-MM-DD'), page: 1 })}
          className="h-11 bg-slate-800 text-white rounded-xl px-6 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-900 transition-all shadow-md shadow-slate-200"
        >
          Reset Filters
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard title="Total Tickets" value={stats?.summary.total} icon={<FiTag />} color="bg-slate-900" trend="+12% from last month" />
        <StatCard title="Open" value={stats?.summary.open} icon={<FiClock />} color="bg-indigo-600" />
        <StatCard title="In Progress" value={stats?.summary.inProgress} icon={<FiActivity />} color="bg-blue-500" />
        <StatCard title="Closed" value={stats?.summary.closed} icon={<FiCheckCircle />} color="bg-emerald-600" />
        <StatCard title="Overdue" value={stats?.summary.overdue} icon={<FiAlertCircle />} color="bg-rose-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Trend Graph */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">Ticket Trends</h3>
            <div className="flex gap-6">
              <span className="flex items-center gap-2 text-[10px] font-bold text-indigo-500 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-indigo-500" /> Created</span>
              <span className="flex items-center gap-2 text-[10px] font-bold text-emerald-500 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Resolved</span>
            </div>
          </div>
          <div className="h-[350px] w-full">
            {loading ? <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl" /> : <Line data={trendData} options={chartOptions} />}
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white p-8 rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col">
           <h3 className="text-lg font-bold text-slate-800 tracking-tight mb-10">Status Distribution</h3>
           <div className="flex-1 flex flex-col items-center justify-center relative">
              <div className="h-[250px] w-full">
                 {loading ? <div className="h-full w-full bg-slate-50 animate-pulse rounded-full" /> : <Doughnut data={statusPieData} options={{...chartOptions, cutout: '70%'}} />}
              </div>
              {!loading && stats && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[-10px] text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Total</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.summary.total}</p>
                </div>
              )}
              <div className="w-full mt-10 grid grid-cols-2 gap-4">
                 {stats && Object.entries(stats.statusDistribution).map(([label, val], idx) => (
                   <div key={label} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: statusPieData.datasets[0].backgroundColor[idx] }} />
                      <div className="flex-1 flex justify-between items-center">
                        <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">{label}</span>
                        <span className="text-xs font-bold text-slate-700">{val}</span>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
          <div className="space-y-0.5">
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">Recent Activity</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Detail view of filtered tickets</p>
          </div>
          <div className="flex items-center gap-4">
             {loading && <div className="text-[10px] font-bold text-indigo-500 animate-pulse uppercase tracking-widest">Refreshing Feed...</div>}
          </div>
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
          <div className="flex items-center gap-2">
            <button 
              disabled={filters.page === 1}
              onClick={() => handleFilterChange('page', filters.page - 1)}
              className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:border-indigo-500 hover:text-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <FiChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1">
              {[...Array(stats?.pagination.pages || 0)].map((_, i) => {
                const p = i + 1;
                if (p === 1 || p === stats?.pagination.pages || (p >= filters.page - 1 && p <= filters.page + 1)) {
                  return (
                    <button 
                      key={p} 
                      onClick={() => handleFilterChange('page', p)}
                      className={`w-9 h-9 rounded-xl font-bold text-[11px] transition-all ${filters.page === p ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-500'}`}
                    >
                      {p}
                    </button>
                  );
                } else if (p === filters.page - 2 || p === filters.page + 2) {
                  return <FiMoreHorizontal key={p} className="text-slate-300 mx-1" />;
                }
                return null;
              })}
            </div>
            <button 
              disabled={filters.page === stats?.pagination.pages}
              onClick={() => handleFilterChange('page', filters.page + 1)}
              className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:border-indigo-500 hover:text-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <FiChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

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
    </div>
  );
}

function StatCard({ title, value, icon, color, trend }) {
  return (
    <div className={`${color} rounded-[1.25rem] p-6 text-white shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all duration-300`}>
      <div className="relative z-10 flex flex-col justify-between h-full min-h-[100px]">
        <div>
          <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-2">{title}</p>
          <h2 className="text-3xl font-bold tracking-tight">{value || 0}</h2>
        </div>
        {trend && (
           <div className="mt-4 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 border border-white/5 text-[9px] font-bold tracking-widest self-start">
             <FiTrendingUp className="text-emerald-400" />
             {trend}
           </div>
        )}
      </div>
      <div className="absolute top-4 right-4 w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl backdrop-blur-sm group-hover:bg-white/20 transition-all">
        {icon}
      </div>
      <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
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
