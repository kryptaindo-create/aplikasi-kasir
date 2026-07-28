import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export const AuthModal: React.FC = () => {
  const { login, connectionState } = useApp();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const deviceId = localStorage.getItem('pos_device_id') || 'DEV-UNKNOWN';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Harap isi semua kolom');
      return;
    }

    setLoading(true);
    setError('');

    const res = await login(username, password, deviceId);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Autentikasi gagal');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#08090d]">
      {/* Decorative background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-pink-500/8 blur-[140px] pointer-events-none" />

      {/* Connection status badge */}
      <div className="absolute top-6 right-6 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
        <div className={`w-2 h-2 rounded-full pulse-glow-indicator ${connectionState === 'ONLINE' ? 'bg-emerald text-emerald-400' : 'bg-amber text-amber-400'}`} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">
          {connectionState === 'ONLINE' ? 'Online Mode' : 'Offline Mode'}
        </span>
      </div>

      <div className="glass-panel w-full max-w-md p-8 md:p-10 border-white/10 shadow-2xl relative z-10 animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-pink-500 items-center justify-center text-white mb-5 shadow-lg shadow-indigo-500/20 border border-white/10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">
            Luxe<span className="text-indigo-400">POS</span>
          </h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Multi-Branch System & Anti-Fraud Center</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-semibold animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Username</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Masukkan username"
                className="w-full py-3 px-4 pl-10"
                disabled={loading}
                autoFocus
              />
              <div className="absolute left-3.5 top-3 text-gray-500 flex items-center h-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Password</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full py-3 px-4 pl-10"
                disabled={loading}
              />
              <div className="absolute left-3.5 top-3 text-gray-500 flex items-center h-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3.5 mt-2 rounded-xl text-base shadow-lg transition-all duration-200"
          >
            {loading ? 'Mengautentikasi...' : 'Masuk ke Sistem'}
          </button>
        </form>

        <div className="mt-8 border-t border-white/5 pt-6 text-center">
          <p className="text-xs text-gray-500">
            Perangkat Terdaftar: <span className="font-semibold text-gray-400">{deviceId}</span>
          </p>
          <p className="text-[10px] text-gray-600 mt-2">
            * 1 Akun kasir hanya dapat aktif pada 1 perangkat secara bersamaan. Login di tempat lain akan menutup sesi perangkat lama.
          </p>
        </div>
      </div>
    </div>
  );
};
