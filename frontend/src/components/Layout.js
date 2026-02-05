import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import TopNavigation from './TopNavigation';
import TabBar from './TabBar';
import { FiLogOut, FiMapPin, FiArrowLeft } from 'react-icons/fi';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';

export default function Layout({ children }) {
  const router = useRouter();
  const { theme } = useTheme();
  const noLauncher = ['/login', '/setup', '/_error'];
  const showNavigation = !noLauncher.includes(router.pathname);
  const [user, setUser] = useState(null);
  const [loginTime, setLoginTime] = useState('');
  const [branch, setBranch] = useState(null);

  useEffect(() => {
    // Company Profile is now managed by ThemeContext

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
    location.href = '/login'; // Force full reload to clear any context states if needed
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col relative">
      {/* Global Screen Layout Wallpaper - Only visible on Main Menu */}
      {(router.pathname === '/' || router.pathname === '/dashboard') && theme.companyProfile?.dashboardImageUrl && (
          <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none mt-24 pb-12 px-6">
              <img 
                src={`http://localhost:5000${theme.companyProfile.dashboardImageUrl}`} 
                alt="Layout Background" 
                className="h-[500px] w-auto max-w-5xl object-contain opacity-80 shadow-sm"
              />
          </div>
      )}

      {showNavigation && (
        <div className="flex flex-col bg-white/90 backdrop-blur-sm border-b border-gray-200 relative z-50">
          {/* 1. Global Header */}
          <header className="h-14 flex items-center justify-between px-6 border-b border-gray-100">
            {/* Left - Logo */}
            <div className="flex items-center gap-3">
              {theme.companyProfile?.logoUrl ? (
                <img 
                    src={`http://localhost:5000${theme.companyProfile.logoUrl}`} 
                    alt="Company Logo" 
                    className="h-10 w-auto object-contain"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm" style={{ backgroundColor: theme.primaryColor }}>
                    {(theme.companyProfile?.companyName || 'P').charAt(0).toUpperCase()}
                </div>
              )}
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">
                {theme.companyProfile?.companyName || 'Wholesale Cloud'}
              </h1>
            </div>

            {/* Right - Profile & Global Actions */}
            <div className="flex items-center gap-6">
                {branch && (
                    <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-gray-50 text-slate-600 rounded-full border border-gray-200">
                        <FiMapPin className="text-xs" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">{branch.name}</span>
                    </div>
                )}

                <div className="flex items-center gap-3 pl-6 border-l border-gray-100">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-slate-800 leading-none">{user?.name || user?.username || 'Guest'}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">Logged in: {loginTime}</p>
                    </div>
                    <div 
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 border-white ring-2 ring-gray-100"
                        style={{ backgroundColor: theme.primaryColor }}
                    >
                        {(user?.name || user?.username || 'U').charAt(0).toUpperCase()}
                    </div>
                    
                    <button 
                        onClick={handleLogout}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all ml-2"
                        title="Logout"
                    >
                        <FiLogOut className="text-xl" />
                    </button>
                </div>
            </div>
          </header>

          {/* 2. Top Navigation Bar */}
          <TopNavigation />

          {/* 3. Open Tabs Bar */}
          <TabBar />
        </div>
      )}

      {/* 4. Main Content Area */}
      <main className="flex-1 overflow-x-hidden p-6 relative z-10">
        <div className="max-w-[1920px] mx-auto">
            {children}
        </div>
      </main>
    </div>
  );
}
