import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { 
  FiHome, FiUsers, FiBox, FiShoppingBag, FiTruck, FiBarChart2, FiSettings, FiLogOut, FiGrid,
  FiChevronDown, FiChevronRight, FiDollarSign, FiBook, FiPackage, FiSearch, FiChevronsUp, FiChevronsDown
} from 'react-icons/fi';
import { TbBarcode } from 'react-icons/tb';
import { MENU_STRUCTURE } from '@/lib/menuStructure';

export default function Sidebar() {
  const router = useRouter();
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, [router.pathname]);

  const toggleGroup = (title) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const toggleAllGroups = (collapse) => {
    const newState = {};
    MENU_STRUCTURE.forEach(group => {
      newState[group.title] = collapse;
    });
    setCollapsedGroups(newState);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const [searchTerm, setSearchTerm] = useState('');

  // Filter groups based on permission and search
  const filteredGroups = MENU_STRUCTURE.map(group => {
    if (!user) return null;
    if (user.role === 'admin') {
      // If searching, filter items
      if (searchTerm) {
         const matchingItems = group.items.filter(item => 
           item.name.toLowerCase().includes(searchTerm.toLowerCase())
         );
         if (matchingItems.length > 0) {
           return { ...group, items: matchingItems };
         }
         return null;
      }
      return group;
    }

    const allowedModules = user.allowedModules || [];
    
    // Check if user has FULL access to the group (Backward compatibility)
    const hasFullGroupAccess = allowedModules.includes(group.title);

    // Filter items based on permission AND search
    const visibleItems = group.items.filter(item => {
        // First check permission
        let hasPermission = false;
        if (hasFullGroupAccess) hasPermission = true;
        else if (allowedModules.includes(`${group.title}:${item.name}`)) hasPermission = true;

        if (!hasPermission) return false;

        // Then check search term
        if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }

        return true;
    });

    if (visibleItems.length > 0) {
        return { ...group, items: visibleItems };
    }

    return null;
  }).filter(Boolean);

  return (
    <div className="w-64 h-screen bg-white border-r border-gray-100 flex flex-col fixed left-0 top-0 z-50 overflow-y-auto">
      {/* Header */}
      <div className="p-6">
        <h1 className="text-xl font-bold text-slate-800">Pillow Spot</h1>
        <p className="text-xs text-slate-400 font-medium">{user?.name || user?.username || 'Guest'}</p>
      </div>

       {/* Search Bar */}
       <div className="px-4 mb-2">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search menu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Menu */}
      <div className="flex-1 px-4 py-2 space-y-6">
        {/* Dashboard Link & Collapse Toggle */}
        {(user?.role === 'admin' || user?.allowedModules?.includes('DASHBOARD')) && (
          <div className="flex items-center justify-between mb-4 pr-2">
            <Link href="/" className="flex-1">
               <div className={`flex items-center gap-3 px-4 py-3 transition-all ${router.pathname === '/' || router.pathname === '/dashboard' ? 'bg-gradient-to-r from-emerald-50 to-transparent border-l-4 border-emerald-600 text-emerald-800' : 'text-slate-500 hover:bg-gray-50 border-l-4 border-transparent'}`}>
                 <FiGrid className="text-lg" />
                 <span className="font-medium text-sm">Dashboard</span>
               </div>
            </Link>
            
            <button 
              onClick={() => {
                const someExpanded = MENU_STRUCTURE.some(g => !collapsedGroups[g.title]);
                toggleAllGroups(someExpanded);
              }}
              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
              title="Toggle All Groups"
            >
              {MENU_STRUCTURE.some(g => !collapsedGroups[g.title]) ? <FiChevronsUp size={18} /> : <FiChevronsDown size={18} />}
            </button>
          </div>
        )}
        
        {filteredGroups.map((group, idx) => (
          <div key={idx}>
            <div 
              className="flex items-center justify-between cursor-pointer mb-2 px-2 group"
              onClick={() => toggleGroup(group.title)}
            >
              <div className="flex items-center gap-2">
                {group.icon && <group.icon className="text-sm text-green-700" />}
                <h3 className="text-xs font-bold text-green-700 uppercase tracking-wider">{group.title}</h3>
              </div>
              <div className="text-green-700 group-hover:text-green-800 transition-colors">
                {!searchTerm && (collapsedGroups[group.title] ? <FiChevronRight /> : <FiChevronDown />)}
              </div>
            </div>
            
            {/* Collapsible Content */}
            <div className={`space-y-1 overflow-hidden transition-all duration-300 ${!searchTerm && collapsedGroups[group.title] ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'}`}>
              {group.items.map((item) => (
                <Link href={item.path} key={item.path}>
                  <div className={`flex items-center gap-3 px-4 py-2.5 transition-all ${router.pathname === item.path ? 'bg-gradient-to-r from-emerald-50 to-transparent border-l-4 border-emerald-600 text-emerald-800 font-medium' : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50 border-l-4 border-transparent'}`}>
                    <item.icon className={`text-lg ${router.pathname === item.path ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="text-sm">{item.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* Footer / Logout */}
      <div className="p-4 border-t border-gray-100 pb-8">
        <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition-colors w-full px-4 py-2">
          <FiLogOut />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}
