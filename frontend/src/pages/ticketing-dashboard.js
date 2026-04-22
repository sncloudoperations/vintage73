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

// Register ChartJS
// Custom Plugin for 3D Volumetric Pie/Donut Charts
const volumetricPiePlugin = {
  id: 'volumetricPiePlugin',
  beforeDatasetsDraw: (chart) => {
    const { ctx } = chart;
    const depth = 20; // 3D Thickness

    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.type !== 'pie' && meta.type !== 'doughnut') return;

      meta.data.forEach((element, index) => {
        const { startAngle, endAngle, outerRadius, innerRadius, x, y } = element;
        const color = dataset.backgroundColor[index];
        
        // Draw the "Thickness" (Slices Depth)
        ctx.save();
        ctx.fillStyle = shadeColor(color, -20); // Darker shade for side face
        for (let j = 1; j <= depth; j++) {
          ctx.beginPath();
          ctx.arc(x, y + j, outerRadius, startAngle, endAngle);
          if (innerRadius > 0) {
            ctx.arc(x, y + j, innerRadius, endAngle, startAngle, true);
          }
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      });
    });
  },
  afterDatasetsDraw: (chart) => {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.type !== 'pie' && meta.type !== 'doughnut') return;

      meta.data.forEach((element, index) => {
        const { x, y, outerRadius, innerRadius, startAngle, endAngle } = element;
        
        // Add Floating Percentages directly on slices for Donut
        if (meta.type === 'doughnut') {
          const midAngle = (startAngle + endAngle) / 2;
          const radius = innerRadius + (outerRadius - innerRadius) / 2;
          const labelX = x + Math.cos(midAngle) * radius;
          const labelY = y + Math.sin(midAngle) * radius;
          
          const total = dataset.data.reduce((a, b) => a + b, 0);
          const val = dataset.data[index];
          const pct = Math.round((val / (total || 1)) * 100);
          
          if (pct > 5) {
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 4;
            ctx.fillText(`${pct}%`, labelX, labelY);
            ctx.restore();
          }
        }
      });
    });
  }
};

// Custom Plugin for 3D Bar Charts
const volumetricBarPlugin = {
  id: 'volumetricBarPlugin',
  beforeDatasetsDraw: (chart) => {
    const { ctx } = chart;
    const depth = 8;
    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.type !== 'bar') return;
      meta.data.forEach((bar, index) => {
        const { x, y, base, width } = bar;
        const color = dataset.backgroundColor[index] || dataset.backgroundColor;
        ctx.save();
        ctx.fillStyle = shadeColor(color, -15);
        ctx.beginPath();
        ctx.moveTo(x - width / 2, y);
        ctx.lineTo(x - width / 2 + depth, y - depth);
        ctx.lineTo(x + width / 2 + depth, y - depth);
        ctx.lineTo(x + width / 2, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = shadeColor(color, 15);
        ctx.beginPath();
        ctx.moveTo(x + width / 2, y);
        ctx.lineTo(x + width / 2 + depth, y - depth);
        ctx.lineTo(x + width / 2 + depth, base - depth);
        ctx.lineTo(x + width / 2, base);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
    });
  },
  afterDatasetsDraw: (chart) => {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.type !== 'bar') return;
      meta.data.forEach((bar, index) => {
        const value = dataset.data[index];
        if (value !== 0) {
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.font = 'black 11px Inter, sans-serif';
          ctx.fillStyle = '#1e293b';
          ctx.fillText(value, bar.x, bar.y - 12);
          ctx.restore();
        }
      });
    });
  }
};

// Helper to shade colors for 3D effect
function shadeColor(color, percent) {
  let R = parseInt(color.substring(1, 3), 16);
  let G = parseInt(color.substring(3, 5), 16);
  let B = parseInt(color.substring(5, 7), 16);
  R = parseInt((R * (100 + percent)) / 100);
  G = parseInt((G * (100 + percent)) / 100);
  B = parseInt((B * (100 + percent)) / 100);
  R = R < 255 ? R : 255;
  G = G < 255 ? G : 255;
  B = B < 255 ? B : 255;
  const RR = R.toString(16).length === 1 ? '0' + R.toString(16) : R.toString(16);
  const GG = G.toString(16).length === 1 ? '0' + G.toString(16) : G.toString(16);
  const BB = B.toString(16).length === 1 ? '0' + B.toString(16) : B.toString(16);
  return '#' + RR + GG + BB;
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  volumetricPiePlugin,
  volumetricBarPlugin
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
        borderRadius: 12,
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
            <FiFilter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            <select 
              className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none"
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
          <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wider ml-1">
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
        <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-700">
           {/* Individual Performance Header & Action Strip */}
           <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-md flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-8 text-center md:text-left w-full md:w-auto">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-center text-3xl font-semibold shadow-indigo-500/10 rotate-3">
                    {(() => {
                       const selected = peopleOptions.find(p => p.value == filters.personId) || 
                                        stats?.participants?.find(p => p.id == filters.personId);
                       return (selected?.name || selected?.label || '?').charAt(0);
                    })()}
                 </div>
                  <div className="space-y-1 flex-1">
                    <h2 className="text-3xl font-semibold text-slate-900 tracking-tight">
                       {(() => {
                          const selected = peopleOptions.find(p => p.value == filters.personId) || 
                                           stats?.participants?.find(p => p.id == filters.personId);
                          return selected?.name || selected?.label?.split(' (')[0] || 'Unknown Participant';
                       })()}
                    </h2>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
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

               <div className="flex flex-wrap justify-center gap-4 w-full md:w-auto">
                  {stats?.summary.highPriority > 0 && (
                    <div className="flex gap-2">
                       <button 
                          onClick={() => {
                              const user = stats?.participants?.[0] || 
                                           (filters.role === 'customer' ? stats?.tickets?.[0]?.customer : stats?.tickets?.[0]?.assignedTo) ||
                                           { id: filters.personId, name: peopleOptions.find(p => p.value === filters.personId)?.label?.split(' (')[0] || 'Participant' };
                              openQuickHighPriority(user);
                           }}
                          className={`${filters.role === 'employee' ? 'h-16 px-6' : 'h-16 px-8'} bg-rose-600 hover:bg-rose-700 text-white rounded-2xl flex items-center gap-4 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-rose-500/10`}
                       >
                          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                             <FiAlertCircle size={20} />
                          </div>
                          <div className="text-left">
                             <p className="text-[10px] font-semibold text-rose-100 uppercase tracking-wider leading-none mb-1">Attention Required</p>
                             <p className="text-sm font-semibold uppercase tracking-tight">View {stats?.summary.highPriority} High Tickets</p>
                          </div>
                       </button>

                       {filters.role === 'employee' && (
                          <>
                             <button 
                               onClick={() => {
                                 const user = { id: filters.personId };
                                 openQuickHighPriority(user);
                               }}
                               className="h-16 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/10"
                               title="Quick Solve Priority Cases"
                             >
                                <FiCheckCircle size={22} />
                                <div className="text-left hidden sm:block">
                                   <p className="text-[9px] font-semibold text-emerald-100 uppercase tracking-wider leading-none mb-1">Service Task</p>
                                   <p className="text-xs font-semibold uppercase tracking-tight">Solve Ticket</p>
                                </div>
                             </button>

                             <button 
                               onClick={() => {
                                 const user = { id: filters.personId };
                                 openQuickHighPriority(user);
                               }}
                               className="h-16 px-6 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-slate-500/10"
                               title="Delegate Critical Tasks"
                             >
                                <FiMoreHorizontal size={22} />
                                <div className="text-left hidden sm:block">
                                   <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider leading-none mb-1">Workload</p>
                                   <p className="text-xs font-semibold uppercase tracking-tight">Reassign</p>
                                </div>
                             </button>
                          </>
                       )}
                    </div>
                  )}
                 <div className="h-16 px-8 bg-slate-900 text-white rounded-2xl flex items-center gap-6 shadow-slate-900/5">
                    <div className="text-center">
                       <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none mb-1">Total</p>
                       <p className="text-xl font-semibold leading-none">{stats?.summary.total}</p>
                    </div>
                    <div className="w-px h-8 bg-slate-700" />
                    <div className="text-center">
                       <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none mb-1">SLA Health</p>
                       <p className="text-xl font-semibold leading-none text-emerald-400">{stats?.summary.total > 0 ? Math.round(((stats?.summary.total - stats?.summary.overdue) / stats?.summary.total) * 100) : 100}%</p>
                    </div>
                 </div>
              </div>
           </div>

           {/* Core Analytics Suite */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* STATUS PERFORMANCE BAR CHART */}
              <div className="bg-white p-10 rounded-3xl border border-slate-100 shadow-sm flex flex-col min-h-[500px] hover:shadow-xl transition-all">
                 <div className="flex justify-between items-center mb-10">
                    <div className="space-y-1">
                       <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider leading-none">Lifecycle Matrix</p>
                       <h3 className="text-2xl font-semibold text-slate-900 tracking-tight">Status Performance Distribution</h3>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600"><FiTrendingUp size={24} /></div>
                 </div>
                  <div className="flex-1 w-full max-w-4xl mx-auto py-4">
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
                                barThickness: 40,
                                maxBarThickness: 50
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
                                   ticks: { padding: 10 }
                                }
                             }
                          }} 
                       />
                    )}
                 </div>
              </div>

              {/* PRIORITY & PERSPECTIVE SPLIT */}
              <div className="grid grid-cols-1 gap-10">
                 {/* PIE CHART (Priority) */}
                 <div className="bg-white p-10 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-12 hover:shadow-xl transition-all">
                    <div className="space-y-1">
                       <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider leading-none">Intensity Index</p>
                       <h3 className="text-2xl font-semibold text-slate-900 tracking-tight">Priority Breakdown (3D)</h3>
                    </div>
                    <div className="flex flex-col md:flex-row gap-12 items-center">
                       <div className="flex-1 w-full max-h-[300px] relative">
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
                                   hoverOffset: 30,
                                   borderWidth: 0
                                }]
                             }} 
                             options={{ ...pieOptions, plugins: { ...pieOptions.plugins, legend: { display: false } } }} 
                          />
                       </div>
                       <div className="flex-1 grid grid-cols-2 gap-4">
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
                                <div key={label} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center space-y-1 group hover:border-indigo-400 transition-all">
                                   <p className="text-2xl font-semibold tracking-tight" style={{ color: glossyPalette[i] }}>{pct}%</p>
                                   <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider leading-none truncate">{label}</p>
                                   <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">{val} Tickets</p>
                                </div>
                             );
                          })}
                       </div>
                    </div>
                 </div>

                 {/* DONUT CHART (Efficiency) */}
                 <div className="bg-white p-10 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-12 items-center hover:shadow-xl transition-all overflow-hidden relative">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-50 rounded-full blur-3xl opacity-50" />
                    <div className="flex-1 space-y-6 z-10">
                       <div className="space-y-1">
                          <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider leading-none">Outcome Ratio</p>
                          <h3 className="text-2xl font-semibold text-slate-900 tracking-tight">Performance Insight</h3>
                       </div>
                       <div className="space-y-4">
                          <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                             <div className="p-3 bg-white rounded-xl text-emerald-600 shadow-sm"><FiCheckCircle size={20} /></div>
                             <div>
                                <p className="text-sm font-semibold text-emerald-700 leading-none">Resolved</p>
                                <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mt-1">{stats?.participants[0]?.resolved || 0} Successful Fixes</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                             <div className="p-3 bg-white rounded-xl text-amber-600 shadow-sm"><FiClock size={20} /></div>
                             <div>
                                <p className="text-sm font-semibold text-amber-700 leading-none">Pending</p>
                                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mt-1">
                                   {Math.round(((stats?.summary.total - stats?.participants[0]?.resolved) / (stats?.summary.total || 1)) * 100)}% Load Exposure
                                </p>
                             </div>
                          </div>
                       </div>
                    </div>
                    <div className="flex flex-col gap-10">
                       <div className="w-full md:w-[220px] h-[220px] relative z-10 mx-auto">
                          <Doughnut 
                             data={{
                                labels: ['Resolved', 'Pending'],
                                datasets: [{
                                   data: [
                                      stats?.participants[0]?.resolved || 0,
                                      stats?.summary.total - (stats?.participants[0]?.resolved || 0)
                                   ],
                                   backgroundColor: ['#10b981', '#f1f5f9'],
                                   borderWidth: 0,
                                   cutout: '70%'
                                }]
                             }} 
                             options={chartOptions} 
                          />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          {['Resolved', 'Pending'].map((label, i) => {
                             const counts = [
                                stats?.participants[0]?.resolved || 0,
                                stats?.summary.total - (stats?.participants[0]?.resolved || 0)
                             ];
                             const val = counts[i];
                             const total = counts.reduce((a, b) => a + b, 0);
                             const pct = Math.round((val / (total || 1)) * 100);
                             return (
                                <div key={label} className="text-center space-y-1">
                                   <p className="text-2xl font-semibold tracking-tight" style={{ color: i === 0 ? '#10b981' : '#94a3b8' }}>{pct}%</p>
                                   <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none truncate">{label}</p>
                                   <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">{val} Tickets</p>
                                </div>
                             );
                          })}
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           {/* Participant Specific Insight Badges */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                 { label: 'Work Intensity', value: stats?.summary.total > 20 ? 'Extreme' : 'Optimal', icon: <FiTrendingUp />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                 { label: 'Avg Resolution', value: stats?.summary.avgResolutionTime ? `${stats.summary.avgResolutionTime.toFixed(1)}h` : 'N/A', icon: <FiClock />, color: 'text-amber-600', bg: 'bg-amber-50' },
                 { label: 'Closure Velocity', value: (stats?.participants[0]?.resolved / stats?.summary.total) > 0.8 ? 'Excellent' : 'Normal', icon: <FiCheckCircle />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                 { label: 'Critical Risk', value: stats?.summary.overdue > 0 ? 'Elevated' : 'Safe', icon: <FiInfo />, color: 'text-slate-600', bg: 'bg-slate-50' }
              ].map(badge => (
                 <div key={badge.label} className={`${badge.bg} p-6 rounded-3xl border border-white shadow-sm flex items-center justify-between group hover:scale-105 transition-all`}>
                    <div className="space-y-1">
                       <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none">{badge.label}</p>
                       <p className={`text-xl font-semibold ${badge.color} leading-none tracking-tight`}>{badge.value}</p>
                    </div>
                    <div className={`${badge.color} opacity-20 group-hover:opacity-100 transition-opacity`}>{badge.icon}</div>
                 </div>
              ))}
           </div>
        </div>
      )}

      {currentTier === 'role-list' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
           {/* Summary Stats (Composition Matrix) */}
           <div className="lg:col-span-3 space-y-8">
              <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
                 <div className="flex justify-between items-center mb-8">
                    <div className="space-y-1">
                       <h3 className="text-xl font-semibold text-slate-900 tracking-tight">Priority Intelligence Matrix</h3>
                       <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">3D Volumetric Analytics Distribution</p>
                    </div>
                    <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 flex items-center gap-2">
                       <span className="text-[9px] font-semibold text-indigo-600 uppercase tracking-wider leading-none">Total Volume:</span>
                       <span className="text-[11px] font-semibold text-indigo-700 leading-none">{stats?.summary.total}</span>
                    </div>
                 </div>
                  <div className="flex flex-col gap-10">
                    <div className="h-[320px] relative">
                       <Pie data={priorityPieData} options={pieOptions} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                       {priorityPieData.labels.map((label, i) => {
                          const val = priorityPieData.datasets[0].data[i];
                          const total = priorityPieData.datasets[0].data.reduce((a, b) => a + b, 0);
                          const pct = Math.round((val / (total || 1)) * 100);
                          return (
                             <div key={label} className="text-center space-y-2">
                                <p className="text-2xl font-semibold tracking-tight" style={{ color: priorityPieData.datasets[0].backgroundColor[i] }}>{pct}%</p>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none truncate">{label}</p>
                                <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">{val} Tickets</p>
                             </div>
                          );
                       })}
                    </div>
                  </div>
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[460px]">
                     <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-8">Status Composition (3D)</h3>
                     <div className="flex flex-col gap-10">
                        <div className="h-[200px] w-full relative">
                           <Doughnut data={statusPieData} options={chartOptions} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           {statusPieData.labels.slice(0, 4).map((label, i) => {
                              const val = statusPieData.datasets[0].data[i];
                              const total = statusPieData.datasets[0].data.reduce((a, b) => a + b, 0);
                              const pct = Math.round((val / (total || 1)) * 100);
                              return (
                                 <div key={label} className="text-center space-y-1">
                                    <p className="text-xl font-semibold tracking-tight" style={{ color: statusPieData.datasets[0].backgroundColor[i] }}>{pct}%</p>
                                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider truncate">{label} ({val})</p>
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                  </div>
                  <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[460px]">
                     <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-8">Team Load Share (3D)</h3>
                     <div className="flex flex-col gap-10">
                        <div className="h-[200px] w-full relative">
                           <Pie data={teamLoadData} options={pieOptions} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                           {teamLoadData.labels.slice(0, 3).map((label, i) => {
                              const val = teamLoadData.datasets[0].data[i];
                              const total = teamLoadData.datasets[0].data.reduce((a, b) => a + b, 0);
                              const pct = Math.round((val / (total || 1)) * 100);
                              return (
                                 <div key={label} className="text-center space-y-1">
                                    <p className="text-lg font-semibold tracking-tight" style={{ color: teamLoadData.datasets[0].backgroundColor[i] }}>{pct}%</p>
                                    <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider truncate leading-none">{label.split(' ')[0]}</p>
                                    <p className="text-[8px] font-semibold text-slate-300 uppercase tracking-wider leading-none mt-1">({val})</p>
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                  </div>
               </div>
           </div>

           {/* Sidebar Participant List */}
           <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[calc(100vh-250px)] lg:h-auto lg:min-h-[850px]">
              <div className="p-6 border-b border-slate-50">
                 <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-tight">Active {filters.role} Participants</h3>
                 <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-1">{stats?.participants.length || 0} Records Identified</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                 {stats?.participants.map(user => {
                    const needsAttention = filters.role === 'customer' 
                       ? (user.highPriority > 0 || user.open > 5)
                       : (user.overdue > 0 || user.pending > 5);

                    return (
                        <div 
                          key={user.id} 
                          className="w-full p-6 bg-white border border-slate-100 rounded-2xl text-left hover:border-indigo-400 hover:shadow-2xl hover:-translate-y-1 transition-all group relative overflow-hidden flex flex-col gap-6 shadow-sm"
                        >
                           {needsAttention && (
                              <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1 bg-rose-50 rounded-full border border-rose-100 animate-bounce">
                                 <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                 </span>
                                 <span className="text-[8px] font-semibold text-rose-600 uppercase tracking-wider leading-none">High Attention</span>
                              </div>
                           )}
                           
                           <div className="flex items-center gap-5 cursor-pointer" onClick={() => openSummaryModal(user)}>
                              <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl font-semibold text-slate-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:rotate-6 transition-all shadow-sm">
                                 {user.name?.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <p className="text-base font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{user.name}</p>
                                 <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-1 opacity-60">ID: {String(user.id).slice(-8).toUpperCase()}</p>
                              </div>
                           </div>

                           {/* Mini Perspective Charts */}
                           <div className="grid grid-cols-2 gap-4">
                              <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex flex-col gap-3">
                                 <div className="flex justify-between items-center">
                                    <span className="text-[8px] font-semibold text-slate-400 uppercase">Response Health</span>
                                    <span className="text-[10px] font-semibold text-indigo-600">{Math.round((user.closed / (user.total || 1)) * 100)}%</span>
                                 </div>
                                 <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${(user.closed / (user.total || 1)) * 100}%` }}></div>
                                 </div>
                              </div>
                              <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex flex-col gap-3">
                                 <div className="flex justify-between items-center">
                                    <span className="text-[8px] font-semibold text-slate-400 uppercase text-rose-500">Urgency</span>
                                    <span className="text-[10px] font-semibold text-rose-600">{user.highPriority}</span>
                                 </div>
                                 <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-rose-500 rounded-full transition-all duration-1000" style={{ width: `${(user.highPriority / (user.total || 1)) * 100}%` }}></div>
                                 </div>
                              </div>
                           </div>

                           <div className="grid grid-cols-2 gap-3 pt-2">
                              <button 
                                onClick={() => openSummaryModal(user)}
                                className="h-11 bg-slate-900 text-white rounded-xl text-[10px] font-semibold uppercase tracking-wider hover:bg-slate-700 transition-all shadow-lg shadow-slate-100"
                              >
                                Analytics
                              </button>
                              {user.highPriority > 0 && (
                                <button 
                                  onClick={() => openQuickHighPriority(user)}
                                  className="h-11 bg-rose-600 text-white rounded-xl text-[10px] font-semibold uppercase tracking-wider hover:bg-rose-700 transition-all shadow-md shadow-rose-100"
                                >
                                  View ({user.highPriority})
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

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white text-slate-400 text-[10px] uppercase font-semibold tracking-wider border-b border-slate-100">
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
                  <td className="px-8 py-5 font-semibold text-indigo-600 text-sm group-hover:underline">{t.ticketId}</td>
                  <td className="px-8 py-5 text-sm font-medium text-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-semibold text-slate-400">{t.customer?.name?.charAt(0) || 'C'}</div>
                      <div>
                        <p className="font-semibold text-slate-800">{t.customer?.name || 'Internal'}</p>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-tight">{t.category?.name || 'General'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-semibold text-slate-800 truncate max-w-[200px]">{t.title}</p>
                    <p className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">{t.description}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${getStatusStyles(t.status)} border border-slate-200/50`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider border ${getPriorityStyles(t.priority)}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right font-semibold text-slate-400 text-xs text-nowrap">
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm shadow-2xl overflow-hidden">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden border border-slate-100"
            >
              {/* Left Side: Detail & Timeline */}
              <div className="flex-1 flex flex-col min-h-0 bg-white">
                <div className="p-8 border-b border-slate-50 flex justify-between items-start shrink-0">
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

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
                   {/* Description */}
                   <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-3 bg-indigo-600 rounded-full"></div>
                        <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Initial Request Description</h4>
                      </div>
                      <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 text-sm font-medium text-slate-700 leading-relaxed">
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
                              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
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
              <div className="w-full md:w-[320px] bg-slate-50 border-l border-slate-100 flex flex-col shrink-0 p-8 space-y-8 overflow-y-auto custom-scrollbar">
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

                <div className="flex-1" />

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
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
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
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
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
