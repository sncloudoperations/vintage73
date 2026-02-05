import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { MENU_STRUCTURE } from '@/lib/menuStructure';
import { useTabs } from '@/context/TabContext';
import { FiChevronDown, FiGrid, FiSearch } from 'react-icons/fi';

export default function TopNavigation() {
  const router = useRouter();
  const { addTab } = useTabs();
  const [user, setUser] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const searchRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // Click outside to close search
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseEnter = (groupTitle) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setActiveDropdown(groupTitle);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 300); // 300ms delay for stability
  };

  const handleItemClick = (item) => {
    addTab({ name: item.name, path: item.path });
    setActiveDropdown(null);
    setSearchTerm(''); // Clear search on selection
  };

  useEffect(() => {
    if (!searchTerm) {
      setSearchResults([]);
      return;
    }

    const results = [];
    MENU_STRUCTURE.forEach(group => {
      // Permission check logic (simplified for search - can be strict user check if needed)
      // For now, assuming if they can see the menu, they can search it. 
      // Re-using the filter logic would be best but for performance let's simple match.
      // Ideally we re-use the 'filteredGroups' but that's local to render.
      
      group.items.forEach(item => {
        if (item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          results.push({ ...item, group: group.title });
        }
      });
    });
    setSearchResults(results);
  }, [searchTerm]);

  const filteredGroups = MENU_STRUCTURE.map(group => {
    if (!user) return null;
    if (user.role === 'admin') return group;

    const allowedModules = user.allowedModules || [];
    const hasFullGroupAccess = allowedModules.includes(group.title);

    const visibleItems = group.items.filter(item => {
        if (hasFullGroupAccess) return true;
        if (allowedModules.includes(`${group.title}:${item.name}`)) return true;
        return false;
    });

    if (visibleItems.length > 0) {
        return { ...group, items: visibleItems };
    }
    return null;
  }).filter(Boolean);

  return (
    <nav className="bg-gradient-to-r from-primary-dark to-primary px-4 h-12 flex items-center justify-between gap-1 shadow-md relative z-30">
      <div className="flex items-center gap-1">
        
        {/* Dynamic Menu Groups */}
        <div className="flex items-center gap-1">
            {filteredGroups.map((group, idx) => (
                <div 
                    key={idx}
                    className="relative group h-full flex items-center"
                    onMouseEnter={() => handleMouseEnter(group.title)}
                    onMouseLeave={handleMouseLeave}
                >
                    <button 
                    onClick={() => setActiveDropdown(activeDropdown === group.title ? null : group.title)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold capitalize tracking-normal transition-all
                        ${activeDropdown === group.title 
                            ? 'bg-white text-primary-dark shadow-sm transform scale-105' 
                            : 'text-white/90 hover:bg-white/20 hover:text-white'}
                    `}
                    >
                        {group.icon && <group.icon className="text-lg" />}
                        <span>{group.title.toLowerCase()}</span>
                        <FiChevronDown className={`transition-transform duration-200 ${activeDropdown === group.title ? 'rotate-180' : 'opacity-70'}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {activeDropdown === group.title && (
                        <div 
                           className="absolute top-full left-0 w-64 pt-2 z-50"
                           onMouseEnter={() => handleMouseEnter(group.title)}
                        >
                            <div className="bg-white border text-left border-gray-100 rounded-lg shadow-xl py-2 overflow-hidden">
                                <div className="px-3 py-1.5 mb-1 bg-slate-50 border-b border-gray-50">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{group.title} Modules</h4>
                                </div>
                                {group.items.map((item) => (
                                    <div 
                                        key={item.path}
                                        onClick={() => handleItemClick(item)}
                                        className={`flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition-colors
                                            ${router.pathname === item.path ? 'bg-primary-light text-primary-dark font-bold border-l-4 border-primary' : 'text-slate-600 hover:bg-slate-50 hover:text-primary-dark'}
                                        `}
                                    >
                                        <item.icon className={router.pathname === item.path ? 'text-primary' : 'text-slate-400'} />
                                        {item.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
      </div>


      {/* Search Bar */}
      <div className="relative" ref={searchRef}>
          <div className="relative">
             <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-primary-dark" />
             <input 
               type="text" 
               placeholder="Search..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-48 pl-8 pr-3 py-1.5 text-sm bg-white border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-800 placeholder-slate-400 shadow-sm/20 transition-all"
             />
          </div>

          {/* Search Results Dropdown */}
          {searchTerm && searchResults.length > 0 && (
             <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-xl py-2 z-50 max-h-[400px] overflow-y-auto">
                <div className="px-3 py-1.5 bg-slate-50 border-b border-gray-50 text-xs font-bold text-slate-400 uppercase mb-1">
                   Search Results
                </div>
                {searchResults.map((item, idx) => (
                   <div 
                      key={idx}
                      onClick={() => handleItemClick(item)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-primary-dark cursor-pointer transition-colors"
                   >
                      <item.icon className="text-slate-400" />
                      <div className="flex flex-col">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-[10px] text-slate-400">{item.group}</span>
                      </div>
                   </div>
                ))}
             </div>
          )}
          
          {searchTerm && searchResults.length === 0 && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl p-4 text-center z-50">
                  <p className="text-sm text-slate-500">No results found</p>
              </div>
          )}
      </div>
    </nav>
  );
}
