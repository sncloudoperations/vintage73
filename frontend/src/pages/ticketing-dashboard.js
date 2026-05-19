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
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Doughnut, Line, Pie } from 'react-chartjs-2';
import moment from 'moment';
import SearchableSelect from '@/components/SearchableSelect';
import { motion, AnimatePresence } from 'framer-motion';

// Helper to shade colors for 3D effect
function shadeColor(color, percent) {
  if (!color || !color.startsWith('#')) return color;
  let R = parseInt(color.substring(1, 3), 16);
  let G = parseInt(color.substring(3, 5), 16);
  let B = parseInt(color.substring(5, 7), 16);
  R = Math.min(255, Math.max(0, Math.round((R * (100 + percent)) / 100)));
  G = Math.min(255, Math.max(0, Math.round((G * (100 + percent)) / 100)));
  B = Math.min(255, Math.max(0, Math.round((B * (100 + percent)) / 100)));
  return '#' + [R, G, B].map(v => v.toString(16).padStart(2, '0')).join('');
}

// 3D Pie/Donut depth extrusion plugin
// Key: outer loop = depth levels, inner loop = slices
// This ensures all slices at depth j are drawn before moving to j-1,
// preventing slices from covering each other's depth layers.
const threeDPiePlugin = {
  id: 'threeDPiePlugin',
  beforeDatasetsDraw(chart) {
    const { ctx } = chart;
    const depth = 10;
    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.type !== 'pie' && meta.type !== 'doughnut') return;
      // Draw from bottom layer (j=depth) up to top layer (j=1)
      for (let j = depth; j >= 1; j--) {
        const shadePct = -40 + ((depth - j) / depth) * 20; // gets slightly lighter as we go up
        meta.data.forEach((element, index) => {
          const { startAngle, endAngle, outerRadius, innerRadius, x, y } = element;
          const color = Array.isArray(dataset.backgroundColor)
            ? dataset.backgroundColor[index]
            : dataset.backgroundColor;
          if (!color || !color.startsWith('#')) return;
          ctx.save();
          ctx.fillStyle = shadeColor(color, shadePct);
          ctx.beginPath();
          ctx.arc(x, y + j, outerRadius, startAngle, endAngle);
          if (innerRadius > 0) {
            ctx.arc(x, y + j, innerRadius, endAngle, startAngle, true);
          } else {
            ctx.lineTo(x, y + j);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });
      }
    });
  },
};

// 3D Bar plugin - draws top and right faces AFTER the bar front face
// using afterDatasetsDraw so the 3D faces sit on top of the bar.
const threeDBarPlugin = {
  id: 'threeDBarPlugin',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const depth = 8;
    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.type !== 'bar') return;
      meta.data.forEach((bar, index) => {
        const { x, y, base, width } = bar;
        const color = Array.isArray(dataset.backgroundColor)
          ? dataset.backgroundColor[index]
          : dataset.backgroundColor;
        if (!color || !color.startsWith('#')) return;
        ctx.save();
        // Right face (dark side shadow)
        ctx.fillStyle = shadeColor(color, -30);
        ctx.beginPath();
        ctx.moveTo(x + width / 2, y);
        ctx.lineTo(x + width / 2 + depth, y - depth);
        ctx.lineTo(x + width / 2 + depth, base - depth);
        ctx.lineTo(x + width / 2, base);
        ctx.closePath();
        ctx.fill();
        // Top face (light highlight)
        ctx.fillStyle = shadeColor(color, 30);
        ctx.beginPath();
        ctx.moveTo(x - width / 2, y);
        ctx.lineTo(x - width / 2 + depth, y - depth);
        ctx.lineTo(x + width / 2 + depth, y - depth);
        ctx.lineTo(x + width / 2, y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
    });
  },
};

// Register ChartJS with clean 3D plugins
const pluginsToRegister = [CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler, threeDPiePlugin, threeDBarPlugin];
ChartJS.register(...pluginsToRegister);

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
  
  // Quick View States
  const [quickUser, setQuickUser] = useState(null);
  const [quickTickets, setQuickTickets] = useState([]);
  const [loadingQuick, setLoadingQuick] = useState(false);
  const [showQuickModal, setShowQuickModal] = useState(false);
  
  // Summary/Overview Modal States
  const [summaryUser, setSummaryUser] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryStats, setSummaryStats] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Reassignment Workflow States
  const [allAgents, setAllAgents] = useState([]);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignTicketId, setReassignTicketId] = useState(null);
  const [reassignAgentId, setReassignAgentId] = useState('');

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

  const fetchAllPotentialAgents = async () => {
    try {
       const [agentsRes, adminsRes] = await Promise.all([
          api.get('/tickets/branch-agents'),
          api.get('/tickets/branch-admins')
       ]);
       const combined = [
          ...agentsRes.data.map(i => ({ value: i.id, label: `AGENT: ${i.name}`, original: i })),
          ...adminsRes.data.map(i => ({ value: i.id, label: `ADMIN: ${i.name}`, original: i }))
       ];
       setAllAgents(combined);
    } catch (err) {
       console.error('Failed to fetch potential agents', err);
    }
  };

  useEffect(() => {
     fetchAllPotentialAgents();
  }, []);

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
    if (!user) return;
    setSummaryUser(user);
    setShowSummaryModal(true);
    fetchUserSummary(user.id);
  };

  const openQuickHighPriority = async (user) => {
    if (!user) return;
    setQuickUser(user);
    setShowQuickModal(true);
    setLoadingQuick(true);
    try {
       const res = await api.get('/tickets/stats', {
          params: { 
             role: filters.role, 
             personId: user.id, 
             priority: 'High',
             limit: 50 
          }
       });
       setQuickTickets(res.data.tickets || []);
    } catch (err) {
       console.error('Failed to fetch quick high priority tickets', err);
    } finally {
       setLoadingQuick(false);
    }
  };

  const handleResolveTicket = async (ticketId) => {
    try {
      await api.put('/tickets/status', { ticketId, status: 'Resolved', message: 'Resolved via Analytics Dashboard' });
      const res = await api.get('/tickets/stats', {
        params: { 
           role: filters.role, 
           personId: quickUser.id, 
           priority: 'High',
           limit: 50 
        }
      });
      setQuickTickets(res.data.tickets || []);
      fetchStats();
    } catch (err) {
      console.error('Failed to resolve ticket', err);
    }
  };

  const handleReassignTicket = async (ticketId, staffId) => {
    try {
      await api.put('/tickets/assign', { ticketId, staffId });
      setShowReassignModal(false);
      setReassignAgentId('');
      setReassignTicketId(null);
      
      // Refresh current context
      if (showQuickModal && quickUser) {
         const res = await api.get('/tickets/stats', {
            params: { 
               role: filters.role, 
               personId: quickUser.id, 
               priority: 'High',
               limit: 50 
            }
         });
         setQuickTickets(res.data.tickets || []);
      }
      fetchStats();
    } catch (err) {
      console.error('Failed to reassign ticket', err);
    }
  };

  const navigateToDetail = (userId) => {
    handleFilterChange('personId', userId);
    setShowSummaryModal(false);
  };

  const openTicketDetails = (ticket) => {
    setSelectedTicket(ticket);
    setShowModal(true);
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        display: true, 
        position: 'right', 
        labels: { boxWidth: 12, font: { size: 11, weight: 'bold' }, usePointStyle: true, padding: 25, color: '#475569' } 
      },
      tooltip: { 
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        padding: 16,
        titleFont: { size: 12, weight: '900' },
        bodyFont: { size: 11, weight: '500' },
        usePointStyle: true,
        cornerRadius: 16,
        boxPadding: 8,
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    },
    cutout: '70%',
    layout: {
      padding: { top: 10, bottom: 40, left: 20, right: 20 }
    },
    elements: {
      arc: {
        borderWidth: 0,
        hoverOffset: 30
      },
      bar: {
        borderRadius: 12
      }
    }
  };

  const pieOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      legend: { display: false } // We'll use custom legend
    },
    cutout: 0
  };

  const horizontalBarOptions = {
    ...chartOptions,
    indexAxis: 'y',
    plugins: {
      ...chartOptions.plugins,
      legend: { display: false }
    },
    scales: {
      x: { 
        beginAtZero: true, 
        ticks: { stepSize: 1, font: { size: 9, weight: '500' }, color: '#94a3b8' }, 
        grid: { color: '#f1f5f9', drawBorder: false } 
      },
      y: { 
        grid: { display: false, drawBorder: false }, 
        ticks: { font: { size: 9, weight: 'bold' }, color: '#64748b' } 
      }
    }
  };

  // Modern Soft Glossy Color Palette
  const glossyPalette = [
    '#f43f5e', // Coral (High)
    '#f59e0b', // Amber (Medium)
    '#10b981', // Mint (Low)
    '#a855f7', // Purple (Urgent)
    '#3b82f6', // Blue
    '#6366f1'  // Indigo
  ];

  // Premium Priority Pie Data
  const priorityPieData = {
    labels: stats?.priorityDistribution ? Object.keys(stats.priorityDistribution).map(p => p.toUpperCase()) : [],
    datasets: [
      {
        data: stats?.priorityDistribution ? Object.values(stats.priorityDistribution) : [],
        backgroundColor: glossyPalette,
        hoverOffset: 30,
        borderWidth: 0,
      }
    ]
  };

  // Premium Status Pie Data
  const statusPieData = {
    labels: stats?.statusDistribution ? Object.keys(stats.statusDistribution).map(s => s.toUpperCase()) : [],
    datasets: [
      {
        data: stats?.statusDistribution ? Object.values(stats.statusDistribution) : [],
        backgroundColor: [
          '#6366f1', '#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#f43f5e', '#94a3b8'
        ],
        hoverOffset: 20,
        borderWidth: 0,
      }
    ]
  };

  // Premium Team Load Donut
  const teamLoadData = {
    labels: stats?.topEmployees.map(e => e.name) || [],
    datasets: [
      {
        data: stats?.topEmployees.map(e => e.total) || [],
        backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'],
        hoverOffset: 15,
        borderWidth: 0,
      }
    ]
  };

  // Re-define for usage in other views
  const statusBarData = {
    labels: stats?.statusDistribution ? Object.keys(stats.statusDistribution).map(s => s.toUpperCase()) : [],
    datasets: [
      {
        label: 'Volume',
        data: stats?.statusDistribution ? Object.values(stats.statusDistribution) : [],
        backgroundColor: '#6366f1',
        borderRadius: 6,
        barThickness: 28,
      }
    ]
  };



  const currentTier = !filters.role ? 'main' : (filters.personId === 'all' ? 'role-list' : 'detail');

  return (
    <>
    <div className="min-h-screen bg-[#f8fafc] p-4 lg:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1 space-y-1">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Ticketing Intelligence</h1>
          <p className="text-xs text-slate-400 font-medium">Real-time Service Desk Analytics & Performance Matrix</p>
        </div>

        {currentTier === 'detail' && (
          <button 
            onClick={() => handleFilterChange('personId', 'all')}
            className="h-11 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl px-5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider hover:bg-slate-100 transition-all mr-4 shadow-sm"
          >
            <FiChevronLeft size={16} /> Back to Participant List
          </button>
        )}
        {currentTier === 'role-list' && (
          <button 
            onClick={() => handleFilterChange('role', '')}
            className="h-11 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl px-5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider hover:bg-slate-100 transition-all mr-4 shadow-sm"
          >
            <FiChevronLeft size={16} /> Back to Global Overview
          </button>
        )}
        <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-slate-100">
           <FiCalendar className="text-indigo-400" />
           <span className="text-[10px] font-medium text-slate-700 uppercase tracking-wider leading-none">{moment().format('MMMM Do, YYYY')}</span>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-6 items-end">
        <div className="space-y-2">
          <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-1">View Role</label>
          <div className="relative">
            <FiFilter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" size={14} />
            <SearchableSelect
              options={[
                { value: '', label: 'Company Overview' },
                { value: 'customer', label: 'Customers' },
                { value: 'employee', label: 'Employees' }
              ]}
              value={filters.role}
              onChange={(val) => handleFilterChange('role', val)}
              placeholder="Company Overview"
              direction="down"
              className="h-11"
              triggerClassName="w-full bg-slate-50 border-slate-100 rounded-xl pl-10 pr-4 flex items-center justify-between min-h-0 h-11 text-xs text-slate-700 font-medium"
            />
          </div>
        </div>

        <div className={`space-y-2 ${!filters.role ? 'opacity-40 cursor-not-allowed' : ''}`}>
          <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-1">
            {filters.role ? `Filter by ${filters.role}` : 'Select Role First'}
          </label>
          <SearchableSelect
            options={[{ value: 'all', label: `All ${filters.role || 'Users'}s` }, ...peopleOptions]}
            value={filters.personId}
            onChange={(val) => handleFilterChange('personId', val)}
            placeholder="Search name..."
            className="h-11"
            triggerClassName="w-full bg-slate-50 border-slate-100 rounded-xl px-4 flex items-center justify-between min-h-0 h-11 text-xs text-slate-700 font-medium"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-1">From Date</label>
          <div className="relative">
            <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="date"
              className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-1">To Date</label>
          <div className="relative">
            <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="date"
              className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
        </div>

        <button 
          onClick={() => setFilters({ role: '', personId: 'all', startDate: moment().subtract(30, 'days').format('YYYY-MM-DD'), endDate: moment().format('YYYY-MM-DD'), page: 1, limit: 10, status: '' })}
          className="h-11 bg-white border border-slate-200 text-slate-600 rounded-xl px-6 text-[10px] font-medium uppercase tracking-wider hover:bg-slate-50 transition-all"
        >
          Reset
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <StatCard title="Volume" value={stats?.summary.total} icon={<FiTag />} color="text-indigo-600" />
        <StatCard title="Open" value={stats?.summary.open} icon={<FiClock />} color="text-blue-500" />
        <StatCard title="Active" value={stats?.summary.inProgress} icon={<FiActivity />} color="text-amber-500" />
        <StatCard title="Closed" value={stats?.summary.closed} icon={<FiCheckCircle />} color="text-emerald-500" />
        <StatCard title="Urgent" value={stats?.summary.highPriority} icon={<FiAlertCircle />} color="text-rose-500" />
        <StatCard title="Delayed" value={stats?.summary.overdue} icon={<FiClock />} color="text-rose-600" />
        <StatCard title="Reassigned" value={stats?.summary.reassigned} icon={<FiTrendingUp />} color="text-purple-500" />
        <StatCard 
          title="Avg Resolution" 
          value={stats?.summary.avgResolutionTime ? `${stats.summary.avgResolutionTime.toFixed(1)}h` : 'N/A'} 
          icon={<FiClock />} 
          color="text-slate-600" 
        />
      </div>

      {currentTier === 'main' && (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
               {/* 1. Priority Analytics */}
               <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[480px]">
                  <div className="mb-8">
                     <h3 className="text-[10px] font-medium text-slate-400 uppercase tracking-wider leading-none">System Urgency Profile</h3>
                     <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Priority Analytics</h2>
                  </div>
                  <div className="flex-1 flex flex-col gap-8 justify-between">
                     <div className="h-[240px] w-full relative">
                        <Pie data={priorityPieData} options={pieOptions} />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        {priorityPieData.labels.map((label, i) => (
                           <div key={label} className="text-center">
                              <p className="text-xl font-semibold tracking-tight" style={{ color: priorityPieData.datasets[0].backgroundColor[i] }}>{priorityPieData.datasets[0].data[i]}</p>
                              <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider leading-none truncate">{label}</p>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>

               {/* 2. Status Distribution */}
               <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[480px]">
                  <div className="mb-8">
                     <h3 className="text-[10px] font-medium text-slate-400 uppercase tracking-wider leading-none">Lifecycle State</h3>
                     <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Status Distribution</h2>
                  </div>
                  <div className="flex-1 flex flex-col gap-8 justify-between">
                     <div className="h-[240px] w-full relative">
                        <Doughnut data={statusPieData} options={chartOptions} />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        {statusPieData.labels.slice(0, 4).map((label, i) => (
                           <div key={label} className="text-center">
                              <p className="text-xl font-semibold tracking-tight" style={{ color: statusPieData.datasets[0].backgroundColor[i] }}>{statusPieData.datasets[0].data[i]}</p>
                              <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider truncate">{label}</p>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>

               {/* 3. Interactive Filters (Bar) */}
               <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[480px]">
                  <div className="mb-8">
                     <h3 className="text-[10px] font-medium text-slate-400 uppercase tracking-wider leading-none">Interactive Filters</h3>
                     <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Volume Matrix</h2>
                  </div>
                  <div className="flex-1 w-full mt-4">
                     {loading ? <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl" /> : <Bar data={statusBarData} options={{...chartOptions, maintainAspectRatio: false}} />}
                  </div>
               </div>
            </div>

            {/* Performance Leaderboard Row */}
            <div className="bg-white p-10 rounded-2xl border border-slate-100 shadow-sm">
               <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-8">System Performance Leaderboard</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-4">
                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-2">Top Customers</p>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {stats?.topCustomers.map((c, idx) => (
                           <div key={c.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-indigo-200 transition-all group">
                              <div className="flex items-center gap-3 truncate">
                                 <span className="text-[10px] font-bold text-slate-300 w-5">{idx + 1}</span>
                                 <p className="text-xs font-semibold text-slate-700 truncate">{c.name}</p>
                              </div>
                              <span className="text-xs font-bold text-indigo-600 ml-2">{c.total}</span>
                           </div>
                        ))}
                     </div>
                  </div>
                  <div className="space-y-4">
                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-2">Top Agents</p>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {stats?.topEmployees.map((e, idx) => (
                           <div key={e.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-emerald-200 transition-all group">
                              <div className="flex items-center gap-3 truncate">
                                 <span className="text-[10px] font-bold text-slate-300 w-5">{idx + 1}</span>
                                 <p className="text-xs font-semibold text-slate-700 truncate">{e.name}</p>
                              </div>
                              <span className="text-xs font-bold text-emerald-600 ml-2">{e.total}</span>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
        </div>
      )}

      {currentTier === 'detail' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">
           {/* Individual Performance Header & Action Strip */}
           <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col xl:flex-row justify-between items-center gap-4">
               <div className="flex items-center gap-4 text-center md:text-left w-full xl:w-auto">
                   <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-center text-xl font-bold shadow-sm flex-shrink-0">
                    {(() => {
                       const selected = peopleOptions.find(p => p.value == filters.personId) || 
                                        stats?.participants?.find(p => p.id == filters.personId);
                       return (selected?.name || selected?.label || '?').charAt(0);
                    })()}
                 </div>
                   <div className="space-y-1 flex-1 min-w-0">
                     <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
                       {(() => {
                          const selected = peopleOptions.find(p => p.value == filters.personId) || 
                                           stats?.participants?.find(p => p.id == filters.personId);
                          return selected?.name || selected?.label?.split(' (')[0] || 'Unknown Participant';
                       })()}
                    </h2>
                     <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                       <span className="px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-semibold uppercase tracking-wider border border-indigo-100">
                          {filters.role.toUpperCase()}
                       </span>
                       <span className="flex items-center gap-2 text-slate-400 font-semibold text-xs">
                          <FiActivity size={14} className="text-emerald-400" /> 
                          Joined {moment(stats?.tickets[0]?.customer?.createdAt || stats?.tickets[0]?.assignedTo?.createdAt).fromNow()}
                       </span>
                    </div>
                 </div>
              </div>

                <div className="flex flex-wrap justify-center gap-2 w-full xl:w-auto">
                  {stats?.summary.highPriority > 0 && (
                    <div className="flex gap-2">
                       <button 
                          onClick={() => {
                              const user = stats?.participants?.[0] || 
                                           (filters.role === 'customer' ? stats?.tickets?.[0]?.customer : stats?.tickets?.[0]?.assignedTo) ||
                                           { id: filters.personId, name: peopleOptions.find(p => p.value === filters.personId)?.label?.split(' (')[0] || 'Participant' };
                              openQuickHighPriority(user);
                           }}
                           className={`${filters.role === 'employee' ? 'h-9 px-4' : 'h-9 px-4'} bg-rose-600 hover:bg-rose-700 text-white rounded-xl flex items-center gap-2 transition-all shadow-sm`}
                       >
                           <FiAlertCircle size={14} />
                           <span className="text-[10px] font-semibold uppercase tracking-wider">View {stats?.summary.highPriority} High</span>
                       </button>

                       {filters.role === 'employee' && (
                          <>
                             <button 
                               onClick={() => {
                                 const user = { id: filters.personId };
                                 openQuickHighPriority(user);
                               }}
                                className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-2 transition-all shadow-sm"
                                title="Quick Solve Priority Cases"
                              >
                                 <FiCheckCircle size={14} />
                                 <span className="text-[10px] font-semibold uppercase tracking-wider hidden sm:inline">Solve</span>
                             </button>

                             <button 
                               onClick={() => {
                                 const user = { id: filters.personId };
                                 openQuickHighPriority(user);
                               }}
                                className="h-9 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl flex items-center gap-2 transition-all shadow-sm"
                                title="Delegate Critical Tasks"
                              >
                                 <FiMoreHorizontal size={14} />
                                 <span className="text-[10px] font-semibold uppercase tracking-wider hidden sm:inline">Reassign</span>
                             </button>
                          </>
                       )}
                    </div>
                  )}
                  <div className="h-9 px-5 bg-slate-900 text-white rounded-xl flex items-center gap-4 shadow-sm">
                     <div className="text-center">
                        <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider leading-none">Total</p>
                        <p className="text-sm font-bold leading-tight">{stats?.summary.total}</p>
                     </div>
                     <div className="w-px h-5 bg-slate-700" />
                     <div className="text-center">
                        <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider leading-none">SLA</p>
                        <p className="text-sm font-bold leading-tight text-emerald-400">{stats?.summary.total > 0 ? Math.round(((stats?.summary.total - stats?.summary.overdue) / stats?.summary.total) * 100) : 100}%</p>
                     </div>
                  </div>
                </div>
           </div>

           {/* Core Analytics Suite */}
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* STATUS PERFORMANCE BAR CHART */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                 <div className="flex justify-between items-center mb-4">
                    <div className="space-y-1">
                       <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider leading-none">Lifecycle Matrix</p>
                       <h3 className="text-sm font-semibold text-slate-800 tracking-tight">Status Performance</h3>
                    </div>
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><FiTrendingUp size={14} /></div>
                 </div>
                  <div className="w-full relative" style={{height:'260px'}}>
                    {loading ? (
                       <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl" />
                    ) : (
                       <Bar 
                          data={{
                             labels: ['Created', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Reassigned', 'Overdue'],
                             datasets: [{
                                label: 'Counts',
                                data: [
                                   stats?.summary.total,
                                   stats?.participants[0]?.assigned || 0,
                                   stats?.summary.inProgress,
                                   stats?.participants[0]?.resolved || 0,
                                   stats?.summary.closed,
                                   stats?.participants[0]?.reassigned || 0,
                                   stats?.summary.overdue
                                ],
                                backgroundColor: ['#6366f1', '#8b5cf6', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#f43f5e'],
                                borderRadius: 12,
                                barThickness: 20,
                                maxBarThickness: 26
                             }]
                          }} 
                          options={{
                             ...chartOptions,
                             maintainAspectRatio: false,
                             plugins: { 
                                legend: { display: false },
                                tooltip: { 
                                   ...chartOptions.plugins.tooltip,
                                   callbacks: {
                                      label: (c) => `Volume: ${c.raw} (${((c.raw / (stats?.summary.total || 1)) * 100).toFixed(1)}%)`
                                   }
                                }
                             },
                             scales: {
                                y: { 
                                   ...chartOptions.scales?.y, 
                                   display: true, 
                                   beginAtZero: true, 
                                   grid: { display: true, color: '#f1f5f9', drawBorder: false },
                                   ticks: { padding: 10 }
                                },
                                x: { 
                                   ...chartOptions.scales?.x, 
                                   grid: { display: false },
                                   ticks: { padding: 5, font: { size: 9 }, maxRotation: 30, minRotation: 30 }
                                }
                             }
                          }} 
                       />
                    )}
                 </div>
              </div>

              {/* PIE CHART (Priority) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
                 <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider leading-none">Intensity Index</p>
                    <h3 className="text-sm font-semibold text-slate-800 tracking-tight">Priority Breakdown</h3>
                 </div>
                 <div className="flex flex-col gap-4 flex-1 justify-between">
                    <div className="w-full h-[200px] relative">
                       <Pie 
                          data={{
                             labels: ['Urgent', 'High', 'Medium', 'Low'],
                             datasets: [{
                                data: [
                                   stats?.participants[0]?.urgent || 0,
                                   stats?.summary.highPriority,
                                   stats?.participants[0]?.mediumPriority || 0,
                                   stats?.participants[0]?.lowPriority || 0
                                ],
                                backgroundColor: glossyPalette,
                                hoverOffset: 10,
                                borderWidth: 3,
                                borderColor: '#ffffff'
                             }]
                          }} 
                          options={{ ...pieOptions, plugins: { ...pieOptions.plugins, legend: { display: false } } }} 
                       />
                    </div>
                    <div className="w-full grid grid-cols-2 gap-3">
                       {['Urgent', 'High', 'Medium', 'Low'].map((label, i) => {
                          const counts = [
                             stats?.participants[0]?.urgent || 0,
                             stats?.summary.highPriority,
                             stats?.participants[0]?.mediumPriority || 0,
                             stats?.participants[0]?.lowPriority || 0
                          ];
                          const val = counts[i];
                          const total = counts.reduce((a, b) => a + b, 0);
                          const pct = Math.round((val / (total || 1)) * 100);
                          return (
                             <div key={label} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-center space-y-0.5 hover:border-indigo-200 transition-all">
                                <p className="text-sm font-bold tracking-tight" style={{ color: glossyPalette[i] }}>{pct}%</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none truncate">{label}</p>
                                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{val} Tickets</p>
                             </div>
                          );
                       })}
                    </div>
                 </div>
              </div>

              {/* DONUT CHART (Efficiency) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4 overflow-hidden relative">
                 <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-50 rounded-full blur-3xl opacity-50" />
                 <div className="space-y-1 relative z-10">
                    <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider leading-none">Outcome Ratio</p>
                    <h3 className="text-sm font-semibold text-slate-800 tracking-tight">Performance Insight</h3>
                 </div>
                 <div className="flex flex-col gap-4 flex-1 justify-between">
                    <div className="w-full h-[200px] relative mx-auto">
                       <Doughnut 
                          data={{
                             labels: ['Resolved', 'Pending'],
                             datasets: [{
                                data: [
                                   stats?.participants[0]?.resolved || 0,
                                   stats?.summary.total - (stats?.participants[0]?.resolved || 0)
                                ],
                                backgroundColor: ['#10b981', '#cbd5e1'],
                                borderWidth: 3,
                                borderColor: '#ffffff',
                                cutout: '75%'
                             }]
                          }} 
                          options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} 
                       />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       {['Resolved', 'Pending'].map((label, i) => {
                          const counts = [
                             stats?.participants[0]?.resolved || 0,
                             stats?.summary.total - (stats?.participants[0]?.resolved || 0)
                          ];
                          const val = counts[i];
                          const total = counts.reduce((a, b) => a + b, 0);
                          const pct = Math.round((val / (total || 1)) * 100);
                          return (
                             <div key={label} className="text-center space-y-0.5 p-2.5 bg-slate-50 border border-slate-100 rounded-xl hover:border-emerald-200 transition-all">
                                <p className="text-sm font-bold tracking-tight" style={{ color: i === 0 ? '#10b981' : '#94a3b8' }}>{pct}%</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none truncate">{label}</p>
                                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{val} Tickets</p>
                             </div>
                          );
                       })}
                    </div>
                 </div>
              </div>
           </div>

           {/* Participant Specific Insight Badges */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                 { label: 'Work Intensity', value: stats?.summary.total > 20 ? 'Extreme' : 'Optimal', icon: <FiTrendingUp />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                 { label: 'Avg Resolution', value: stats?.summary.avgResolutionTime ? `${stats.summary.avgResolutionTime.toFixed(1)}h` : 'N/A', icon: <FiClock />, color: 'text-amber-600', bg: 'bg-amber-50' },
                 { label: 'Closure Velocity', value: (stats?.participants[0]?.resolved / stats?.summary.total) > 0.8 ? 'Excellent' : 'Normal', icon: <FiCheckCircle />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                 { label: 'Critical Risk', value: stats?.summary.overdue > 0 ? 'Elevated' : 'Safe', icon: <FiInfo />, color: 'text-slate-600', bg: 'bg-slate-50' }
              ].map(badge => (
                 <div key={badge.label} className={`${badge.bg} p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between`}>
                    <div className="space-y-1">
                       <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">{badge.label}</p>
                       <p className={`text-sm font-semibold ${badge.color} tracking-tight`}>{badge.value}</p>
                    </div>
                    <div className={`${badge.color} opacity-30 ml-3 flex-shrink-0`}>{badge.icon}</div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {currentTier === 'role-list' && (
        <div className="space-y-6">
           {/* All 3 Charts in one line */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Priority Pie */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-5">
                 <div className="flex justify-between items-center">
                    <div>
                       <p className="text-[10px] font-medium text-indigo-500 uppercase tracking-wider">Priority Matrix</p>
                       <h3 className="text-base font-semibold text-slate-800 tracking-tight mt-0.5">Priority Distribution</h3>
                    </div>
                    <div className="bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 flex items-center gap-1.5">
                       <span className="text-[9px] font-semibold text-indigo-600 uppercase tracking-wider">Total:</span>
                       <span className="text-xs font-bold text-indigo-700">{stats?.summary.total}</span>
                    </div>
                 </div>
                 <div className="h-[200px] w-full relative">
                    <Pie data={priorityPieData} options={pieOptions} />
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                    {priorityPieData.labels.map((label, i) => {
                       const val = priorityPieData.datasets[0].data[i];
                       const total = priorityPieData.datasets[0].data.reduce((a, b) => a + b, 0);
                       const pct = Math.round((val / (total || 1)) * 100);
                       return (
                          <div key={label} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                             <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: priorityPieData.datasets[0].backgroundColor[i] }} />
                             <div className="min-w-0">
                                <p className="text-[10px] font-medium text-slate-500 uppercase truncate">{label}</p>
                                <p className="text-xs font-bold" style={{ color: priorityPieData.datasets[0].backgroundColor[i] }}>{pct}% <span className="text-[9px] font-medium text-slate-400">({val})</span></p>
                             </div>
                          </div>
                       );
                    })}
                 </div>
              </div>

              {/* Status Doughnut */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-5">
                 <div>
                    <p className="text-[10px] font-medium text-purple-500 uppercase tracking-wider">Lifecycle State</p>
                    <h3 className="text-base font-semibold text-slate-800 tracking-tight mt-0.5">Status Composition</h3>
                 </div>
                 <div className="h-[200px] w-full relative">
                    <Doughnut data={statusPieData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} />
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                    {statusPieData.labels.slice(0, 4).map((label, i) => {
                       const val = statusPieData.datasets[0].data[i];
                       const total = statusPieData.datasets[0].data.reduce((a, b) => a + b, 0);
                       const pct = Math.round((val / (total || 1)) * 100);
                       return (
                          <div key={label} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                             <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusPieData.datasets[0].backgroundColor[i] }} />
                             <div className="min-w-0">
                                <p className="text-[10px] font-medium text-slate-500 uppercase truncate">{label}</p>
                                <p className="text-xs font-bold" style={{ color: statusPieData.datasets[0].backgroundColor[i] }}>{pct}% <span className="text-[9px] font-medium text-slate-400">({val})</span></p>
                             </div>
                          </div>
                       );
                    })}
                 </div>
              </div>

              {/* Team Load Pie */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-5">
                 <div>
                    <p className="text-[10px] font-medium text-emerald-500 uppercase tracking-wider">Agent Workload</p>
                    <h3 className="text-base font-semibold text-slate-800 tracking-tight mt-0.5">Team Load Share</h3>
                 </div>
                 <div className="h-[200px] w-full relative">
                    <Pie data={teamLoadData} options={pieOptions} />
                 </div>
                 <div className="grid grid-cols-1 gap-2">
                    {teamLoadData.labels.slice(0, 3).map((label, i) => {
                       const val = teamLoadData.datasets[0].data[i];
                       const total = teamLoadData.datasets[0].data.reduce((a, b) => a + b, 0);
                       const pct = Math.round((val / (total || 1)) * 100);
                       return (
                          <div key={label} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                             <div className="flex items-center gap-2 min-w-0">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: teamLoadData.datasets[0].backgroundColor[i] }} />
                                <p className="text-[10px] font-medium text-slate-600 truncate">{label}</p>
                             </div>
                             <p className="text-xs font-bold flex-shrink-0 ml-2" style={{ color: teamLoadData.datasets[0].backgroundColor[i] }}>{pct}% <span className="text-[9px] font-medium text-slate-400">({val})</span></p>
                          </div>
                       );
                    })}
                 </div>
              </div>
           </div>

           {/* Participant List - full-width compact card grid */}
           <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                 <div>
                    <h3 className="text-sm font-semibold text-slate-800 capitalize">{filters.role} Participants</h3>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">{stats?.participants.length || 0} records found</p>
                 </div>
                 <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-semibold uppercase tracking-wider rounded-lg border border-indigo-100">{filters.role}</span>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                 {stats?.participants.map(user => {
                    const needsAttention = filters.role === 'customer'
                       ? (user.highPriority > 0 || user.open > 5)
                       : (user.overdue > 0 || user.pending > 5);
                    const closedPct = Math.round((user.closed / (user.total || 1)) * 100);
                    const urgencyPct = Math.round((user.highPriority / (user.total || 1)) * 100);
                    return (
                       <div key={user.id} className="relative p-4 bg-slate-50 border border-slate-100 rounded-xl hover:border-indigo-300 hover:bg-white hover:shadow-md transition-all group">
                          {needsAttention && (
                             <span className="absolute top-3 right-3 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                             </span>
                          )}
                          <div className="flex items-center gap-3 mb-3 cursor-pointer" onClick={() => openSummaryModal(user)}>
                             <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-base font-bold text-slate-500 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all flex-shrink-0">
                                {user.name?.charAt(0)}
                             </div>
                             <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">{user.name}</p>
                                <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider truncate">ID: {String(user.id).slice(-6).toUpperCase()}</p>
                             </div>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 mb-3">
                             <div className="text-center p-1.5 bg-white rounded-lg border border-slate-100">
                                <p className="text-sm font-bold text-slate-800">{user.total}</p>
                                <p className="text-[8px] font-medium text-slate-400 uppercase">Total</p>
                             </div>
                             <div className="text-center p-1.5 bg-white rounded-lg border border-slate-100">
                                <p className="text-sm font-bold text-emerald-600">{user.closed}</p>
                                <p className="text-[8px] font-medium text-slate-400 uppercase">Closed</p>
                             </div>
                             <div className="text-center p-1.5 bg-white rounded-lg border border-slate-100">
                                <p className="text-sm font-bold text-rose-500">{user.highPriority}</p>
                                <p className="text-[8px] font-medium text-slate-400 uppercase">High</p>
                             </div>
                          </div>
                          <div className="space-y-1.5 mb-3">
                             <div className="flex items-center gap-2">
                                <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                   <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${closedPct}%` }} />
                                </div>
                                <span className="text-[9px] font-medium text-indigo-600 w-6 text-right">{closedPct}%</span>
                             </div>
                             {user.highPriority > 0 && (
                                <div className="flex items-center gap-2">
                                   <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                      <div className="h-full bg-rose-400 rounded-full" style={{ width: `${urgencyPct}%` }} />
                                   </div>
                                   <span className="text-[9px] font-medium text-rose-500 w-6 text-right">{urgencyPct}%</span>
                                </div>
                             )}
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => openSummaryModal(user)} className="flex-1 h-8 bg-slate-800 text-white rounded-lg text-[9px] font-semibold uppercase tracking-wider hover:bg-indigo-600 transition-all">
                                Analytics
                             </button>
                              {user.highPriority > 0 && (
                                 <button onClick={() => openQuickHighPriority(user)} className="flex-1 h-8 bg-rose-500 text-white rounded-lg text-[9px] font-semibold uppercase tracking-wider hover:bg-rose-600 transition-all">
                                    {user.highPriority} High
                                 </button>
                              )}
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>
         </div>
      )}

       {/* Detail/Main View Table Section */}
       {(currentTier === 'main' || currentTier === 'detail') && (
        <div className="space-y-8">
           {/* Sectional Alerts */}
           <AlertCards stats={stats} role={filters.role} isDetail={currentTier === 'detail'} />

           <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-4 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                   <div className="space-y-0.5">
                     <h3 className="text-lg font-semibold text-slate-800 tracking-tight">
                       {currentTier === 'detail' ? `Operational Performance for ${peopleOptions.find(p => p.value === filters.personId)?.label.split(' (')[0]}` : 'Global Ticket Lifecycle'}
                     </h3>
                     <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Comprehensive logs and tracking</p>
                   </div>
                   
                   {loading && <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
                </div>

        <div className="table-container scroll-line lg:no-scrollbar overflow-x-auto">
          <table className="w-full text-left min-w-[850px]">
            <thead className="bg-white text-slate-400 text-[10px] uppercase font-semibold tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 whitespace-nowrap">Ticket ID</th>
                <th className="px-8 py-5 whitespace-nowrap">Customer</th>
                <th className="px-8 py-5 whitespace-nowrap">Summary</th>
                <th className="px-8 py-5 whitespace-nowrap">Status</th>
                <th className="px-8 py-5 whitespace-nowrap">Priority</th>
                <th className="px-8 py-5 text-right whitespace-nowrap">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stats?.tickets.map(t => (
                <tr key={t.id} className="hover:bg-indigo-50/20 transition-all cursor-pointer group" onClick={() => openTicketDetails(t)}>
                  <td className="px-8 py-5 font-semibold text-indigo-600 text-sm group-hover:underline whitespace-nowrap">{t.ticketId}</td>
                  <td className="px-8 py-5 text-sm font-medium text-slate-700 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-semibold text-slate-400 flex-shrink-0">{t.customer?.name?.charAt(0) || 'C'}</div>
                      <div>
                        <p className="font-semibold text-slate-800 truncate max-w-[150px]">{t.customer?.name || 'Internal'}</p>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-tight">{t.category?.name || 'General'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-semibold text-slate-800 truncate max-w-[200px]">{t.title}</p>
                    <p className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">{t.description}</p>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${getStatusStyles(t.status)} border border-slate-200/50`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider border ${getPriorityStyles(t.priority)}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right font-semibold text-slate-400 text-xs whitespace-nowrap">
                    {moment(t.createdAt).format('DD MMM, LT')}
                    <div className="text-[9px] font-semibold uppercase text-slate-300 mt-1">{moment(t.createdAt).fromNow()}</div>
                  </td>
                </tr>
              ))}
              {!loading && stats?.tickets.length === 0 && (
                <tr>
                   <td colSpan="6" className="py-20 text-center text-slate-400 italic font-medium uppercase tracking-wider opacity-50">
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
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Showing <span className="text-slate-800">{stats?.tickets.length || 0}</span> of <span className="text-indigo-600">{stats?.pagination.total || 0}</span> entries
          </p>
          <div className="flex items-center gap-3">
            <button 
              disabled={filters.page === 1}
              onClick={() => handleFilterChange('page', filters.page - 1)}
              className="h-10 px-5 rounded-2xl bg-white border border-slate-200 flex items-center gap-2 text-[10px] font-semibold text-slate-600 hover:border-indigo-500 hover:text-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-wider"
            >
              <FiChevronLeft size={16} /> Prev
            </button>
            
            <button 
              disabled={filters.page === stats?.pagination.pages}
              onClick={() => handleFilterChange('page', filters.page + 1)}
              className="h-10 px-5 rounded-2xl bg-white border border-slate-200 flex items-center gap-2 text-[10px] font-semibold text-slate-600 hover:border-indigo-500 hover:text-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-wider"
            >
              Next <FiChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  )}

      {/* Ticket Details Modal */}
      <AnimatePresence>
        {showModal && selectedTicket && (
          <div className="fixed inset-0 z-[20000] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[95vh] lg:max-h-[90vh] rounded-2xl shadow-2xl flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden border border-slate-100"
            >
              {/* Left Side: Detail & Timeline */}
              <div className="w-full lg:flex-1 flex flex-col flex-none lg:flex-1 bg-white">
                <div className="p-6 sm:p-8 border-b border-slate-50 flex justify-between items-start shrink-0">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider">{selectedTicket.ticketId}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${getStatusStyles(selectedTicket.status)} shadow-sm`}>{selectedTicket.status}</span>
                    </div>
                    <h2 className="text-2xl font-semibold text-slate-800 leading-tight">{selectedTicket.title}</h2>
                  </div>
                  <button onClick={() => setShowModal(false)} className="w-9 h-9 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all">
                    <FiXCircle size={20} />
                  </button>
                </div>

                <div className="w-full flex-none lg:flex-1 lg:overflow-y-auto overflow-y-visible p-6 sm:p-8 custom-scrollbar space-y-8 sm:space-y-10">
                   {/* Description */}
                   <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-3 bg-indigo-600 rounded-full"></div>
                        <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Initial Request Description</h4>
                      </div>
                      <div className="bg-slate-50/50 p-5 sm:p-6 rounded-2xl border border-slate-100 text-sm font-medium text-slate-700 leading-relaxed">
                        {selectedTicket.description}
                      </div>
                   </div>

                   {/* History Timeline */}
                   <div className="space-y-6">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-3 bg-indigo-600 rounded-full"></div>
                        <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Processing History & Log</h4>
                      </div>
                      <div className="relative pl-6 space-y-8 ml-2">
                         <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-slate-100" />
                         {selectedTicket.history?.map((entry, idx) => (
                           <div key={idx} className="relative group">
                              <div className="absolute left-[-29px] top-0 w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-semibold text-indigo-500 shadow-sm z-10 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                {idx + 1}
                              </div>
                              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm">
                                 <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{entry.action}</span>
                                    <span className="text-[9px] font-semibold text-slate-300">{moment(entry.createdAt).format('DD MMM, LT')}</span>
                                 </div>
                                 <p className="text-xs font-semibold text-slate-700 leading-snug">{entry.message}</p>
                                 <div className="mt-3 flex items-center justify-between opacity-80">
                                    <div className="flex items-center gap-1.5">
                                       <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-semibold">{entry.doneBy?.name?.charAt(0)}</div>
                                       <span className="text-[10px] font-semibold text-slate-500 uppercase">{entry.doneBy?.name || 'User'}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-300 font-semibold uppercase tracking-wider">{entry.role}</span>
                                 </div>
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>
              </div>

              {/* Right Side: Meta Info */}
              <div className="w-full lg:w-[320px] bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-100 flex flex-col flex-none lg:flex-initial p-6 sm:p-8 space-y-6 sm:space-y-8 lg:overflow-y-auto overflow-y-visible custom-scrollbar">
                <div className="space-y-6">
                   <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-2">Technical Overview</h4>
                   
                   <MetaItem label="Priority" value={selectedTicket.priority} icon={<FiTag />} style={getPriorityStyles(selectedTicket.priority)} />
                   <MetaItem label="Ticket Category" value={selectedTicket.category?.name || 'General'} icon={<FiFilter />} />
                   <MetaItem label="SLA Compliance" value={selectedTicket.slaStatus || 'On Time'} icon={<FiClock />} style={selectedTicket.slaStatus === 'Delayed' ? 'text-rose-500' : 'text-emerald-500'} />
                </div>

                <div className="space-y-6">
                   <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-2">Assigned Personnel</h4>
                   <div className="space-y-4">
                      <PersonCard role="Assigned Agent" name={selectedTicket.assignedTo?.name} username={selectedTicket.assignedTo?.username} />
                      <PersonCard role="Requester (Customer)" name={selectedTicket.customer?.name} phone={selectedTicket.customer?.phone} />
                      <PersonCard role="Account Manager" name={selectedTicket.createdBy?.name} isStaff={selectedTicket.createdBy?.role !== 'customer'} />
                   </div>
                </div>

                <div className="flex-1 min-h-4 lg:min-h-0" />

                <div className="pt-6 border-t border-slate-200">
                  <div className="bg-indigo-600 rounded-[1.25rem] p-5 text-white shadow-lg shadow-indigo-100 relative overflow-hidden group">
                     <div className="relative z-10">
                        <p className="text-white/70 text-[9px] font-semibold uppercase tracking-wider mb-1">Messages</p>
                        <h5 className="text-lg font-semibold">{selectedTicket.messages?.length || 0} Interactions</h5>
                     </div>
                     <FiMessageSquare className="absolute -right-2 -bottom-2 text-6xl text-white/10 rotate-12 group-hover:scale-110 transition-transform" />
                  </div>
                  <p className="text-[9px] text-center text-slate-400 font-semibold uppercase tracking-wider mt-4">Last Updated {moment(selectedTicket.updatedAt).fromNow()}</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Stats Modal */}
      <AnimatePresence>
        {showSummaryModal && summaryUser && (
          <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
             >
                <div className="p-8 text-center space-y-6">
                   <div className="w-20 h-20 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-3xl font-semibold mx-auto shadow-xl shadow-indigo-200">
                      {summaryUser.name?.charAt(0)}
                   </div>
                   <div className="space-y-1">
                      <h3 className="text-xl font-semibold text-slate-900">{summaryUser.name}</h3>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{summaryUser.role} Performance Snapshot</p>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                         <p className="text-xs font-semibold text-slate-800">{summaryStats?.summary.total || 0}</p>
                         <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">Total</p>
                      </div>
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                         <p className="text-xs font-semibold text-indigo-600">{summaryStats?.summary.inProgress || 0}</p>
                         <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">In Progress</p>
                      </div>
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                         <p className="text-xs font-semibold text-emerald-600">{summaryStats?.summary.closed || 0}</p>
                         <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">Closed</p>
                      </div>
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                         <p className="text-xs font-semibold text-rose-500">{summaryStats?.summary.overdue || 0}</p>
                         <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">Overdue</p>
                      </div>
                   </div>

                   <div className="flex gap-4 pt-4">
                      <button 
                        onClick={() => setShowSummaryModal(false)}
                        className="flex-1 h-12 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-all"
                      >
                        Dismiss
                      </button>
                      <button 
                        onClick={() => navigateToDetail(summaryUser.id)}
                        className="flex-[2] h-12 bg-indigo-600 text-white rounded-xl text-[10px] font-semibold uppercase tracking-wider hover:bg-slate-900 transition-all shadow-lg shadow-indigo-100"
                      >
                        View Full Details
                      </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DASHBOARD REASSIGN MODAL */}
      <AnimatePresence>
        {showReassignModal && (
          <div className="fixed inset-0 z-[20001] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
              <div className="p-8 border-b border-slate-50 bg-indigo-50/50">
                <h3 className="text-xl font-semibold text-slate-900 tracking-tight">Reassign Support Case</h3>
                <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider mt-1">Select new staff or admin agent</p>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">New Assignee</label>
                  <select 
                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={reassignAgentId}
                    onChange={(e) => setReassignAgentId(e.target.value)}
                  >
                    <option value="">Select Target Agent...</option>
                    {allAgents.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                   <button onClick={() => { setShowReassignModal(false); setReassignAgentId(''); }} className="flex-1 h-12 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-200 uppercase tracking-widest transition-all">Cancel</button>
                   <button 
                     disabled={!reassignAgentId}
                     onClick={() => handleReassignTicket(reassignTicketId, reassignAgentId)} 
                     className="flex-[2] h-12 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 uppercase tracking-widest transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                   >Confirm Reassign</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
       {/* Quick High Priority View Modal */}
       <AnimatePresence>
          {showQuickModal && quickUser && (
             <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                <motion.div
                   initial={{ opacity: 0, y: 100 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: 100 }}
                   className="bg-white w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-100"
                >
                   <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-rose-50/30">
                      <div className="flex items-center gap-4">
                         <div className="w-14 h-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center text-2xl font-semibold shadow-lg shadow-rose-200 animate-pulse">
                            <FiAlertCircle />
                         </div>
                         <div>
                            <h3 className="text-2xl font-semibold text-slate-900 leading-none">Critical Response Area</h3>
                            <p className="text-xs font-semibold text-rose-500 uppercase tracking-wider mt-1">Found {quickTickets.length} high priority tickets for {quickUser.name}</p>
                         </div>
                      </div>
                      <button onClick={() => setShowQuickModal(false)} className="w-12 h-12 rounded-full hover:bg-rose-100 flex items-center justify-center text-rose-500 transition-all">
                        <FiXCircle size={28} />
                      </button>
                   </div>

                   <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                      {loadingQuick ? (
                         <div className="py-20 flex flex-col items-center gap-4">
                            <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Acquiring Priority Data...</p>
                         </div>
                      ) : quickTickets.length === 0 ? (
                         <div className="py-20 text-center opacity-40">
                            <FiCheckCircle size={60} className="mx-auto mb-4 text-emerald-500" />
                            <p className="text-lg font-semibold text-slate-900 uppercase tracking-wider">All Clear</p>
                            <p className="text-xs font-medium text-slate-500 mt-2">No critical response items remaining for this participant.</p>
                         </div>
                      ) : (
                         <div className="grid grid-cols-1 gap-4">
                            {quickTickets.map(t => (
                               <div key={t.id} className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 hover:border-rose-300 hover:bg-white transition-all group flex items-center justify-between gap-6">
                                  <div className="flex-1 min-w-0 space-y-3">
                                     <div className="flex items-center gap-3">
                                        <span className="px-3 py-1 bg-rose-500 text-white rounded-lg text-[9px] font-semibold uppercase tracking-wider">{t.ticketId}</span>
                                        <span className={`px-3 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-wider ${getStatusStyles(t.status)}`}>{t.status}</span>
                                     </div>
                                     <h4 className="text-lg font-semibold text-slate-900 truncate">{t.title}</h4>
                                     <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2">
                                           <FiUser className="text-slate-400" size={14} />
                                           <span className="text-[10px] font-semibold text-slate-500 uppercase">{t.assignedTo?.name || 'Unassigned'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                           <FiCalendar className="text-slate-400" size={14} />
                                           <span className="text-[10px] font-semibold text-slate-500 uppercase">{moment(t.createdAt).format('DD MMM, LT')}</span>
                                        </div>
                                     </div>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                     <button 
                                       onClick={() => { setShowQuickModal(false); openTicketDetails(t); }}
                                       className="h-12 px-5 bg-slate-100 text-slate-800 rounded-xl text-[10px] font-semibold uppercase tracking-wider hover:bg-slate-200 transition-all shrink-0"
                                     >
                                       Inspect
                                     </button>

                                     {filters.role === 'employee' && (
                                        <>
                                           <button 
                                             onClick={() => handleResolveTicket(t.id)}
                                             className="h-12 px-5 bg-emerald-600 text-white rounded-xl text-[10px] font-semibold uppercase tracking-wider hover:bg-emerald-700 transition-all shrink-0"
                                           >
                                             Resolve
                                           </button>
                                           <button 
                                             onClick={() => {
                                                setReassignTicketId(t.id);
                                                setShowReassignModal(true);
                                             }}
                                             className="h-12 px-5 bg-indigo-600 text-white rounded-xl text-[10px] font-semibold uppercase tracking-wider hover:bg-indigo-700 transition-all shrink-0"
                                           >
                                             Reassign
                                           </button>
                                        </>
                                     )}
                                  </div>
                               </div>
                            ))}
                         </div>
                      )}
                   </div>

                   <div className="p-8 border-t border-slate-50 bg-slate-50/50 flex justify-between items-center">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">End of priority list</p>
                      <button 
                        onClick={() => setShowQuickModal(false)}
                        className="h-11 px-8 rounded-xl bg-white border border-slate-200 text-slate-800 text-[10px] font-semibold uppercase tracking-wider hover:border-slate-400 transition-all shadow-sm"
                      >
                        Close Portal
                      </button>
                   </div>
                </motion.div>
             </div>
          )}
       </AnimatePresence>
    </>
  );
}

function MiniDonut({ data, colors }) {
  const chartData = {
    datasets: [{
      data: data,
      backgroundColor: colors,
      borderWidth: 0,
      hoverOffset: 4
    }]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: { legend: { display: false }, tooltip: { enabled: false } }
  };
  return <div className="w-10 h-10"><Doughnut data={chartData} options={options} /></div>;
}

function AlertCards({ stats, role, isDetail }) {
   if (!stats) return null;
   const { urgent, highPriority, overdue, todayCreated, todayResolved, inProgress } = stats.summary;

   // Calculate page-level contextual messages
   let workloadMsg = "";
   if (isDetail && role === 'employee') {
      if (overdue > 0) workloadMsg = "Heavy Workload Warning";
      else if (inProgress > 5) workloadMsg = "Capacity Threshold Reached";
   } else if (isDetail && role === 'customer') {
      if (urgent > 0 || highPriority > 0) workloadMsg = "Needs Immediate Response";
   }

   return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
         {/* Red Alert: High/Urgent */}
         <div className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm relative overflow-hidden group">
            <div className={`absolute top-4 right-4 flex items-center gap-1.5 ${urgent + highPriority > 0 ? 'opacity-100' : 'opacity-30'}`}>
               <span className="flex h-2 w-2 relative">
                  <span className={`${urgent + highPriority > 0 ? 'animate-ping' : ''} absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75`}></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
               </span>
               <p className="text-[7px] font-semibold text-rose-500 uppercase tracking-wider">System Alert</p>
            </div>
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 shadow-sm border border-rose-100">
                  <FiAlertCircle size={20} />
               </div>
               <div>
                  <h4 className="text-xl font-semibold text-slate-900 tracking-tight">{urgent + highPriority}</h4>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Urgent / High Priority</p>
                  {workloadMsg && <p className="text-[8px] font-semibold text-rose-500 uppercase tracking-tight mt-1">{workloadMsg}</p>}
               </div>
            </div>
         </div>

         {/* Orange Warning: Overdue */}
         <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow-sm relative overflow-hidden group">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 shadow-sm border border-amber-100">
                  <FiClock size={20} />
               </div>
               <div>
                  <h4 className="text-xl font-semibold text-slate-900 tracking-tight">{overdue}</h4>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Overdue Needs Action</p>
               </div>
            </div>
         </div>

         {/* Blue Info: Today's Created */}
         <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden group">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 shadow-sm border border-blue-100">
                  <FiTag size={20} />
               </div>
               <div>
                  <h4 className="text-xl font-semibold text-slate-900 tracking-tight">{todayCreated}</h4>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Today's New Entrants</p>
               </div>
            </div>
         </div>

         {/* Green Success: Today's Resolved */}
         <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden group">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 shadow-sm border border-emerald-100">
                  <FiCheckCircle size={20} />
               </div>
               <div>
                  <h4 className="text-xl font-semibold text-slate-900 tracking-tight">{todayResolved}</h4>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Total Resolved Today</p>
               </div>
            </div>
         </div>
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
          <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-0.5">{title}</p>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">{value || 0}</h2>
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
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider leading-none mb-1">{label}</p>
          <p className={`text-xs font-semibold uppercase tracking-wider ${style}`}>{value}</p>
       </div>
    </div>
  );
}

function PersonCard({ role, name, username, phone, isStaff }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2">
       <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider leading-none mb-1">{role}</p>
       <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-semibold ${isStaff ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-50 text-slate-400'}`}>
            {name?.charAt(0) || <FiUser />}
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-700 leading-none">{name || 'Unassigned'}</p>
            {(username || phone) && <p className="text-[9px] text-slate-400 font-semibold mt-1 uppercase tracking-wider">@{username || phone}</p>}
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
