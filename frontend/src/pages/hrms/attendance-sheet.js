import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiFilter, FiCalendar, FiUsers, FiDownload, FiCheck, FiX, FiMinus } from 'react-icons/fi';
import SearchableSelect from '@/components/SearchableSelect';

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
            const s = new Date(l.startDate); s.setHours(0, 0, 0, 0);
            const e = new Date(l.endDate); e.setHours(0, 0, 0, 0);
            return currentDate >= s && currentDate <= e;
        });
        if (leave) return leave.leaveType?.name || 'LEAVE';

        const daysMap = {
            'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
            'Thursday': 4, 'Friday': 5, 'Saturday': 6
        };
        const offDay = daysMap[user.weeklyOff] ?? 0;
        const isWeeklyOff = currentDate.getDay() === offDay;
        if (isWeeklyOff && user.weeklyOff !== 'None') return 'WEEKEND';

        return 'ABSENT';
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'PRESENT': return 'text-primary bg-primary-light/10';
            case 'HALF_DAY': return 'text-amber-500 bg-amber-50';
            case 'ABSENT': return 'text-red-500 bg-red-50';
            case 'WEEKEND': return 'text-slate-400 bg-slate-50 border border-slate-100/50';
            default: return 'text-blue-500 bg-blue-50'; // Leaves
        }
    };

    const deptOptions = [
        { label: 'All Departments', value: '' },
        ...departments.map(d => ({ label: d.name, value: d.id }))
    ];

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-800">Attendance Sheet</h1>
                    <p className="text-slate-500 text-sm mt-1">Monthly overview of employee attendance</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <SearchableSelect
                        options={deptOptions}
                        value={filters.departmentId}
                        onChange={val => setFilters({ ...filters, departmentId: val })}
                        placeholder="All Departments"
                        className="w-full sm:w-64"
                    />
                    <input
                        type="month"
                        className="input bg-white border-slate-200 h-[48px] w-full sm:w-48"
                        value={`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`}
                        onChange={e => {
                            const [y, m] = e.target.value.split('-');
                            setDate(new Date(y, m - 1, 1));
                        }}
                    />
                </div>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="table-container scroll-line lg:no-scrollbar overflow-x-auto overflow-y-auto max-h-[70vh]">
                    <table className="w-full text-left border-collapse min-w-max">
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-4 text-xs font-medium text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50 z-30 w-48 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">Employee</th>
                                {daysArr.map(d => (
                                    <th key={d} className="p-2 text-[10px] font-medium text-slate-400 uppercase text-center min-w-[36px] border-l border-slate-100">
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
                                        <div className="font-medium text-slate-800 text-sm truncate">{user.name}</div>
                                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">{user.employeeProfile?.department?.name || 'No Dept'}</div>
                                    </td>
                                    {daysArr.map(d => {
                                        const status = getStatus(user, d);
                                        return (
                                            <td key={d} className={`p-1 border-l border-slate-100 text-center`}>
                                                <div className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center text-[8px] font-medium ${getStatusColor(status)} shadow-sm`}>
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

            <div className="mt-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-t border-slate-100 pt-6">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-primary-light/10 text-primary flex items-center justify-center shadow-sm border border-primary/5">
                            <FiCheck size={12} />
                        </div>
                        <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Present</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shadow-sm border border-red-100/50">
                            <FiX size={12} />
                        </div>
                        <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Absent</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center shadow-sm border border-amber-100/50">
                            <FiMinus size={12} />
                        </div>
                        <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Half Day</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center shadow-sm border border-blue-100/50">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        </div>
                        <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Leave</span>
                    </div>
                </div>
                
                <div className="max-w-md">
                    <p className="text-[10px] text-slate-400 leading-relaxed italic">
                        <span className="font-bold text-slate-500 not-italic">* NOTE:</span> Weekly Off is based on the day selected in User Master. Blank working days are automatically docked as Absent.
                    </p>
                </div>
            </div>
        </div>
    );
}
