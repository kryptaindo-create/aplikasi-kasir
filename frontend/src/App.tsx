import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthModal } from './components/AuthModal';
import { LockScreen } from './components/LockScreen';
import { POSMain } from './components/POSMain';
import { StockTransfer } from './components/StockTransfer';
import { StockClaims } from './components/StockClaims';
import { DashboardOwner } from './components/DashboardOwner';
import { StockInventory } from './components/StockInventory';
import './index.css';

// ── Icon components ───────────────────────────────────────────
const IconPOS = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);
const IconInventory = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);
const IconTransfer = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
);
const IconClaims = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const IconDashboard = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
  </svg>
);
const IconLogout = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);
const IconMenu = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const IconClose = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ── Main App Component ────────────────────────────────────────
const AppContent: React.FC = () => {
  const { user, isLocked, setScreenLock, logout } = useApp();
  const [activePage, setActivePage] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      setActivePage(user.role === 'MASTER_ADMIN' ? 'DASHBOARD' : 'POS');
    }
  }, [user]);

  // Auto-lock after 120s inactivity
  useEffect(() => {
    if (!user || isLocked) return;
    let timeoutId: any;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setScreenLock(true), 120000);
    };
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(e => document.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(timeoutId);
      events.forEach(e => document.removeEventListener(e, resetTimer));
    };
  }, [user, isLocked, setScreenLock]);

  if (!user) return <AuthModal />;
  if (isLocked) return <LockScreen />;

  // Navigation items per role
  const navItems = user.role === 'MASTER_ADMIN'
    ? [
        { key: 'DASHBOARD', label: 'Dashboard',    icon: <IconDashboard /> },
        { key: 'INVENTORY', label: 'Stok Barang',  icon: <IconInventory /> },
        { key: 'TRANSFER',  label: 'Transfer Stok',icon: <IconTransfer /> },
      ]
    : [
        { key: 'POS',       label: 'Point of Sales', icon: <IconPOS /> },
        { key: 'INVENTORY', label: 'Stok Barang',    icon: <IconInventory /> },
        { key: 'TRANSFER',  label: 'Transfer Stok',  icon: <IconTransfer /> },
        { key: 'CLAIMS',    label: 'Berita Acara',   icon: <IconClaims /> },
      ];

  const handleNav = (key: string) => {
    setActivePage(key);
    setMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#08090d] text-slate-100">

      {/* ── DESKTOP SIDEBAR (hidden on mobile, icon-only on tablet) ── */}
      <aside className="
        hidden md:flex
        md:w-16 lg:w-64
        flex-col justify-between
        bg-[#0a0b12] border-r border-white/5
        py-5 px-3 lg:px-6
        transition-all duration-300
      ">
        <div className="space-y-6">
          {/* Brand */}
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 min-w-[2rem] rounded-lg bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center font-extrabold text-white text-base shadow-lg">
              L
            </div>
            <div className="hidden lg:block overflow-hidden">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white leading-none whitespace-nowrap">LuxePOS</h2>
                <span className="text-[9px] bg-indigo-500/15 text-indigo-400 font-extrabold px-1.5 py-0.5 rounded border border-indigo-500/25 tracking-widest">BY KRYPTA</span>
              </div>
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mt-0.5">Multi Branch System</span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="space-y-1">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => handleNav(item.key)}
                title={item.label}
                className={`
                  w-full py-2.5 px-3 rounded-xl text-sm font-semibold
                  flex items-center gap-3 transition-all
                  ${activePage === item.key
                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }
                `}
              >
                <span className="min-w-[1.25rem]">{item.icon}</span>
                <span className="hidden lg:block whitespace-nowrap">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* User card + logout */}
        <div className="space-y-3 pt-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 min-w-[2rem] rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 font-bold text-sm text-indigo-400 uppercase">
              {user.username.charAt(0)}
            </div>
            <div className="hidden lg:block overflow-hidden">
              <h4 className="text-xs font-bold text-white truncate">{user.username}</h4>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">{user.role === 'MASTER_ADMIN' ? 'Owner' : 'Kasir'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center gap-3 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
          >
            <span className="min-w-[1.25rem]"><IconLogout /></span>
            <span className="hidden lg:block">Logout</span>
          </button>
          
          <div className="hidden lg:block text-center pt-2 border-t border-white/5">
            <span className="text-[10px] text-gray-500 font-semibold tracking-wider">Dibuat oleh <strong className="text-indigo-400 tracking-widest uppercase">KRYPTA</strong></span>
          </div>
        </div>
      </aside>

      {/* ── MOBILE DRAWER OVERLAY ─────────────────────────────── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer Panel */}
      <div className={`
        fixed top-0 left-0 h-full z-50 w-72
        bg-[#0a0b12] border-r border-white/8
        flex flex-col justify-between py-6 px-5
        transform transition-transform duration-300 ease-in-out
        md:hidden
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="space-y-6">
          {/* Brand + close */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center font-extrabold text-white text-lg shadow-lg">
                L
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white leading-none">LuxePOS</h2>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Multi Branch</span>
              </div>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-white p-1">
              <IconClose />
            </button>
          </div>

          {/* Nav items */}
          <nav className="space-y-1.5">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => handleNav(item.key)}
                className={`
                  w-full py-3.5 px-4 rounded-xl text-sm font-semibold
                  flex items-center gap-3.5 transition-all
                  ${activePage === item.key
                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }
                `}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* User + Logout */}
        <div className="space-y-4 pt-4 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 font-bold text-sm text-indigo-400 uppercase">
              {user.username.charAt(0)}
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">{user.username}</h4>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{user.role === 'MASTER_ADMIN' ? 'Owner / Master Admin' : 'Kasir'}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); setMobileMenuOpen(false); }}
            className="w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center gap-3 text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
          >
            <IconLogout />
            Logout
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile Top Bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0a0b12] border-b border-white/5 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/8 transition-all"
            >
              <IconMenu />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center font-extrabold text-white text-xs">
                L
              </div>
              <span className="text-sm font-extrabold text-white">LuxePOS</span>
            </div>
          </div>

          {/* Active page title on mobile */}
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
            {navItems.find(n => n.key === activePage)?.label || ''}
          </span>

          {/* User avatar */}
          <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 font-bold text-xs text-indigo-400 uppercase">
            {user.username.charAt(0)}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {activePage === 'POS'       && <POSMain />}
          {activePage === 'INVENTORY' && <StockInventory />}
          {activePage === 'TRANSFER'  && <StockTransfer />}
          {activePage === 'CLAIMS'    && <StockClaims />}
          {activePage === 'DASHBOARD' && <DashboardOwner />}
        </main>

        {/* ── MOBILE BOTTOM NAVIGATION BAR ───────────────────── */}
        <nav className="md:hidden flex items-center bg-[#0a0b12] border-t border-white/8 safe-area-bottom">
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => handleNav(item.key)}
              className={`
                flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5
                text-[10px] font-bold transition-all
                ${activePage === item.key ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'}
              `}
            >
              <span className={`transition-transform ${activePage === item.key ? 'scale-110' : ''}`}>
                {item.icon}
              </span>
              <span className="leading-tight">{item.label.split(' ')[0]}</span>
              {activePage === item.key && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-indigo-400 rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

const App: React.FC = () => (
  <AppProvider>
    <AppContent />
  </AppProvider>
);

export default App;
