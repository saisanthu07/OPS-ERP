import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_ITEMS = [
  { to: '/inventory', label: 'Inventory', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> },
  { to: '/work-orders', label: 'Work Orders', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
  { to: '/transfers', label: 'Transfers', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 3 4 4-4 4"/><path d="M4 7h16"/><path d="m16 21-4-4 4-4"/><path d="M20 17H4"/></svg> },
  { to: '/orders', label: 'Customer Orders', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
];

const ROLE_COLORS = {
  ADMIN: 'bg-amber-500/20 text-amber-300 border-amber-600/40',
  OPERATIONS: 'bg-sky-500/20 text-sky-300 border-sky-600/40',
  SALES: 'bg-emerald-500/20 text-emerald-300 border-emerald-600/40',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const [isDark, setIsDark] = React.useState(true);

  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 transition-colors">
      <aside className="w-64 shrink-0 bg-white dark:bg-[#0f0f11] border-r border-zinc-200 dark:border-zinc-900 flex flex-col transition-colors">
        <div className="px-5 py-5 border-b border-zinc-200 dark:border-zinc-900 h-16 flex items-center transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-black dark:bg-white flex items-center justify-center font-bold text-white dark:text-black text-sm transition-colors">
              OE
            </div>
            <div>
              <div className="font-semibold text-sm leading-none text-zinc-900 dark:text-white tracking-tight">Ops ERP</div>
              <div className="text-[10px] text-zinc-500 mt-1 leading-none uppercase tracking-wider">Operations Portal</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-6 text-xs text-zinc-500 dark:text-zinc-600">
          <div>v1.0 - Ops ERP</div>
          <div className="mt-1 flex gap-2">
            <NavLink to="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-400">Terms</NavLink>
            <span>|</span>
            <NavLink to="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-400">Privacy</NavLink>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white dark:bg-[#141416] transition-colors">
        <header className="h-16 px-6 border-b border-zinc-200 dark:border-zinc-900 flex items-center justify-between shrink-0 bg-white dark:bg-[#0f0f11] transition-colors">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
            Console
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsDark(!isDark)} className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
              {isDark ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              )}
            </button>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${ROLE_COLORS[user?.role] || 'border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400'}`}>
              {user?.role}
            </span>
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
              {user?.name}
            </div>
            <button onClick={logout} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-red-600 dark:hover:text-red-400 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Log out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
