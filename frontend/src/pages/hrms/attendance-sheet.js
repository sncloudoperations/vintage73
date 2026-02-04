import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { FiFilter, FiCalendar, FiUsers, FiDownload, FiCheck, FiX, FiMinus } from 'react-icons/fi';

export default function AttendanceSheet() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(new Date());
    const [filters, setFilters] = useState({ departmentId: '' });
    const [departments, setDepartments] = useState([]);

    useEffect(() => {
        fetchDepartments();
    }, []);

    useEffect(() => {
        fetchBulkAttendance();
    }, [date, filters]);

    const fetchDepartments = async () => {
        try {
            const res = await api.get('/hrms/departments');
            setDepartments(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchBulkAttendance = async () => {
        setLoading(true);
        try {
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            const res = await api.get(`/hrms/attendance/bulk?month=${month}&year=${year}`);
            
            let filteredData = res.data;
            if (filters.departmentId) {
                filteredData = filteredData.filter(u => u.employeeProfile?.departmentId === parseInt(filters.departmentId));
            }
            setData(filteredData);
        } catch (err) {
            toast.error("Failed to fetch attendance sheet");
        } finally {
            setLoading(false);
        }
    };

    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const daysArr = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const getStatus = (user, day) => {
        const currentDate = new Date(date.getFullYear(), date.getMonth(), day);
        const dateStr = currentDate.toISOString().split('T')[0];
        
        const att = user.attendance?.find(a => new Date(a.date).toISOString().split('T')[0] === dateStr);
        if (att) return att.status;

        const leave = user.leaveRequests?.find(l => {
            const s = new Date(l.startDate); s.setHours(0,0,0,0);
            const e = new Date(l.endDate); e.setHours(0,0,0,0);
            return currentDate >= s && currentDate <= e;
        });
        if (leave) return leave.leaveType?.name || 'LEAVE';

        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
        if (isWeekend) return 'WEEKEND';

        return 'ABSENT';
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'PRESENT': return 'text-emerald-500 bg-emerald-50';
            case 'HALF_DAY': return 'text-amber-500 bg-amber-50';
            case 'ABSENT': return 'text-red-500 bg-red-50';
            case 'WEEKEND': return 'text-slate-400 bg-slate-50';
            default: return 'text-blue-500 bg-blue-50'; // Leaves
        }
    };

    return (
        <div className="p-6">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Attendance Sheet</h1>
                    <p className="text-slate-500 text-sm mt-1">Monthly overview of employee attendance</p>
                </div>
                <div className="flex gap-3">
                    <select 
                        className="input bg-white border-slate-200"
                        value={filters.departmentId}
                        onChange={e => setFilters({...filters, departmentId: e.target.value})}
                    >
                        <option value="">All Departments</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <input 
                        type="month" 
                        className="input bg-white border-slate-200" 
                        value={`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`}
                        onChange={e => {
                            const [y, m] = e.target.value.split('-');
                            setDate(new Date(y, m - 1, 1));
                        }}
                    />
                </div>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
                    <table className="w-full text-left border-collapse min-w-max">
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50 z-30 w-48 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">Employee</th>
                                {daysArr.map(d => (
                                    <th key={d} className="p-2 text-[10px] font-black text-slate-400 uppercase text-center min-w-[36px] border-l border-slate-100">
                                        {d}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={daysInMonth + 1} className="p-10 text-center text-slate-400">Loading Attendance Sheet...</td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={daysInMonth + 1} className="p-10 text-center text-slate-400">No employees found</td>
                                </tr>
                            ) : data.map(user => (
                                <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                                    <td className="p-3 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">
                                        <div className="font-bold text-slate-800 text-sm truncate">{user.name}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{user.employeeProfile?.department?.name || 'No Dept'}</div>
                                    </td>
                                    {daysArr.map(d => {
                                        const status = getStatus(user, d);
                                        return (
                                            <td key={d} className={`p-1 border-l border-slate-100 text-center`}>
                                                <div className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center text-[8px] font-black ${getStatusColor(status)} shadow-sm`}>
                                                    {status === 'PRESENT' ? <FiCheck size={12} /> : 
                                                     status === 'ABSENT' ? <FiX size={12} /> :
                                                     status === 'HALF_DAY' ? <FiMinus size={12} /> :
                                                     status === 'WEEKEND' ? '' : status.charAt(0)}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest gap-4">
                <div className="flex gap-6">
                    <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-500 flex items-center justify-center"><FiCheck size={10}/></div> Present</div>
                    <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-lg bg-red-100 text-red-500 flex items-center justify-center"><FiX size={10}/></div> Absent</div>
                    <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-lg bg-amber-100 text-amber-500 flex items-center justify-center"><FiMinus size={10}/></div> Half Day</div>
                    <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-lg bg-blue-100 text-blue-500"></div> Leave</div>
                </div>
                <div className="italic text-[10px] normal-case">* Sundays and Saturdays are marked as Weekend by default. Any blank working day is automatically docked.</div>
            </div>
        </div>
    );
}
