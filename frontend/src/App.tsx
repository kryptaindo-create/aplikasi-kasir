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

const AppContent: React.FC = () => {
  const { user, isLocked, setScreenLock, logout } = useApp();
  const [activePage, setActivePage] = useState<string>('');

  // Set default page based on role once logged in
  useEffect(() => {
    if (user) {
      setActivePage(user.role === 'MASTER_ADMIN' ? 'DASHBOARD' : 'POS');
    }
  }, [user]);

  // --- AUTO-LOCK SCREEN TIMEOUT (120 DETIK) ---
  useEffect(() => {
    if (!user || isLocked) return;

    let timeoutId: any;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setScreenLock(true);
      }, 120000); // 120,000ms = 120s
    };

    // User activity listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => document.addEventListener(event, resetTimer));

    resetTimer(); // Init timer

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [user, isLocked, setScreenLock]);

  // Render Auth Gate
  if (!user) {
    return <AuthModal />;
  }

  // Render Locked Screen Gate
  if (isLocked) {
    return <LockScreen />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#08090d] text-slate-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#0a0b12] border-r border-white/5 flex flex-col justify-between p-6">
        <div className="space-y-8">
          {/* Brand header */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center font-extrabold text-white text-base">
              L
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white leading-none">LuxePOS</h2>
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Multi Branch</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-2">
            {user.role === 'MASTER_ADMIN' ? (
              <>
                <button
                  onClick={() => setActivePage('DASHBOARD')}
                  className={`w-full py-3 px-4 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${
                    activePage === 'DASHBOARD'
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  Dashboard Owner
                </button>
                <button
                  onClick={() => setActivePage('INVENTORY')}
                  className={`w-full py-3 px-4 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${
                    activePage === 'INVENTORY'
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  Stok Barang
                </button>
                <button
                  onClick={() => setActivePage('TRANSFER')}
                  className={`w-full py-3 px-4 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${
                    activePage === 'TRANSFER'
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  Transfer Stok
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setActivePage('POS')}
                  className={`w-full py-3 px-4 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${
                    activePage === 'POS'
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  Point of Sales (POS)
                </button>
                <button
                  onClick={() => setActivePage('INVENTORY')}
                  className={`w-full py-3 px-4 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${
                    activePage === 'INVENTORY'
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  Stok Barang
                </button>
                <button
                  onClick={() => setActivePage('TRANSFER')}
                  className={`w-full py-3 px-4 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${
                    activePage === 'TRANSFER'
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  Transfer Stok
                </button>
                <button
                  onClick={() => setActivePage('CLAIMS')}
                  className={`w-full py-3 px-4 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${
                    activePage === 'CLAIMS'
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  Berita Acara Stok
                </button>
              </>
            )}
          </nav>
        </div>

        {/* User Card Profile & Logout */}
        <div className="space-y-4 pt-6 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-500/10 flex-center border border-indigo-500/20 font-bold text-sm text-indigo-400 uppercase">
              {user.username.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <h4 className="text-xs font-bold text-white truncate">{user.username}</h4>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">{user.role}</p>
            </div>
          </div>

          <button onClick={logout} className="btn-secondary w-full py-2.5 text-xs">
            Logout
          </button>
        </div>
      </aside>

      {/* Main Panel Content Render Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activePage === 'POS' && <POSMain />}
        {activePage === 'INVENTORY' && <StockInventory />}
        {activePage === 'TRANSFER' && <StockTransfer />}
        {activePage === 'CLAIMS' && <StockClaims />}
        {activePage === 'DASHBOARD' && <DashboardOwner />}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
