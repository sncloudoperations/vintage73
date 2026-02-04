import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { FiLogOut, FiMapPin, FiArrowLeft } from 'react-icons/fi';
import api from '@/lib/api';

export default function Layout({ children }) {
  const router = useRouter();
  const noLauncher = ['/login', '/setup', '/_error'];
  const showSidebar = !noLauncher.includes(router.pathname);
  const [user, setUser] = useState(null);
  const [loginTime, setLoginTime] = useState('');
  const [branch, setBranch] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);

      // Fallback: Fetch branch name if missing from existing session
      if (userData.branchId && !userData.branchName) {
        api.get(`/branches/${userData.branchId}`)
          .then(res => {
            setBranch(res.data);
            // Update localStorage for next time
            const updatedUser = { ...userData, branchName: res.data.name };
            localStorage.setItem('user', JSON.stringify(updatedUser));
          })
          .catch(err => console.error("Error fetching branch:", err));
      } else if (userData.branchName) {
        setBranch({ name: userData.branchName });
      }
    }
    
    // Set login time (simulated for today's session)
    if (!loginTime) {
      setLoginTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }, [router.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {showSidebar && (
        <>
          <Sidebar />
          {/* Modern Top Header */}
          <header className="fixed top-0 right-0 left-64 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-40">
            {/* Left Side - Back Button */}
            <div>
              {router.pathname !== '/dashboard' && (
                <button
                  onClick={() => router.back()}
                  className="group flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all duration-200 shadow-sm active:scale-95"
                >
                  <FiArrowLeft className="text-lg group-hover:-translate-x-0.5 transition-transform" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Back</span>
                </button>
              )}
            </div>

            {/* Right Side - User Profile */}
            <div className="flex items-center gap-4">
              {/* Standard Avatar */}
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs border border-emerald-200">
                {(user?.name || user?.username || 'U').charAt(0).toUpperCase()}
              </div>

              {branch && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                  <FiMapPin className="text-xs" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">{branch.name}</span>
                </div>
              )}
              
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-700">{user?.name || user?.username || 'Guest'}</span>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">Login: {loginTime}</span>
                </div>
              </div>

              <div className="w-px h-6 bg-slate-200 mx-1" />

              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-1.5 text-slate-500 hover:text-red-600 transition-colors font-medium text-sm rounded-md hover:bg-red-50"
              >
                <FiLogOut className="text-lg" />
                <span>Logout</span>
              </button>
            </div>
          </header>
        </>
      )}
      <main className={`transition-all duration-300 ${showSidebar ? 'ml-64 p-8 pt-20' : 'w-full p-0'}`}>
        {children}
      </main>
    </div>
  );
}
