import { useRouter } from 'next/router';
import { useTabs } from '@/context/TabContext';
import { FiX, FiHome } from 'react-icons/fi';

export default function TabBar() {
  const { tabs, removeTab, closeAllTabs } = useTabs();
  const router = useRouter();

  if (tabs.length === 0) return null;

  return (
    <div className="bg-transparent px-4 pt-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
      {tabs.map((tab) => (
        <div
          key={tab.path}
          onClick={() => router.push(tab.path)}
          className={`
            group flex items-center gap-2 px-3 py-1.5 rounded-t-lg cursor-pointer border-t border-l border-r text-xs font-medium transition-all min-w-[100px] max-w-[180px]
            ${router.pathname === tab.path 
              ? 'bg-white border-gray-200 text-emerald-600 border-b-white -mb-px relative z-10' 
              : 'bg-gray-50 border-transparent text-slate-500 hover:bg-gray-100'
            }
          `}
        >
          {tab.path === '/dashboard' || tab.path === '/' ? <FiHome className="shrink-0" /> : null}
          <span className="truncate flex-1">{tab.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeTab(tab.path, router.pathname);
            }}
            className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
          >
            <FiX size={12} />
          </button>
        </div>
      ))}
      
      {tabs.length > 2 && (
        <button 
            onClick={closeAllTabs}
            className="ml-auto text-xs text-slate-400 hover:text-red-500 px-2 whitespace-nowrap"
        >
            Close All
        </button>
      )}
    </div>
  );
}
