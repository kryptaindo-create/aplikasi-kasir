import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export const LockScreen: React.FC = () => {
  const { user, unlockScreen } = useApp();
  const [input, setInput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleKeyPress = (num: string) => {
    if (input.length < 6) {
      setInput(prev => prev + num);
      setError('');
    }
  };

  const handleBackspace = () => {
    setInput(prev => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setInput('');
    setError('');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (input.length === 0) return;

    setIsSubmitting(true);
    const success = await unlockScreen(input);
    setIsSubmitting(false);

    if (!success) {
      setError('PIN Master Admin atau Kasir salah');
      setInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08090d]/80 backdrop-blur-2xl animate-fade-in">
      {/* Background radial glows */}
      <div className="absolute top-[20%] left-[30%] w-[35vw] h-[35vw] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[30%] w-[35vw] h-[35vw] rounded-full bg-pink-500/5 blur-[120px] pointer-events-none" />

      <div className="glass-panel w-full max-w-sm p-8 text-center border-white/10 flex flex-col items-center relative z-10 shadow-2xl">
        {/* User avatar badge with pulsing glowing border */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full rounded-full bg-[#121420] flex items-center justify-center font-bold text-2xl text-white uppercase tracking-wider">
              {user?.username ? user.username.charAt(0) : 'U'}
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-indigo-500 border-2 border-[#121420] flex items-center justify-center text-white shadow">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        <h2 className="text-xl font-extrabold text-white leading-tight">Sistem Terkunci</h2>
        <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1 block">
          {user?.username} ({user?.role})
        </span>
        <p className="text-gray-400 text-xs mt-3 mb-6 max-w-[240px] mx-auto leading-relaxed">
          Masukkan PIN Kasir atau PIN Master Admin untuk membuka laci kasir.
        </p>

        {/* PIN Indicators */}
        <div className="flex gap-3 mb-6 justify-center">
          {[0, 1, 2, 3, 4, 5].map(index => (
            <div
              key={index}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                index < input.length
                  ? 'bg-indigo-400 border-indigo-400 scale-110 shadow-[0_0_12px_rgba(99,102,241,0.6)]'
                  : 'border-gray-700 bg-transparent'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-rose-400 text-xs font-semibold mb-4 animate-fade-in bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg">
            {error}
          </p>
        )}

        {/* Numeric Keypad (Circular dial style) */}
        <div className="grid grid-cols-3 gap-y-4 gap-x-6 w-full max-w-[240px] mb-6 justify-items-center">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="w-12 h-12 text-base rounded-full flex items-center justify-center font-bold btn-secondary hover:bg-white/10 hover:border-white/20 active:scale-90 p-0 border border-white/5 bg-white/3"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="w-12 h-12 text-xs rounded-full flex items-center justify-center font-bold text-rose-400 btn-secondary hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-300 active:scale-90 p-0 border border-white/5 bg-white/3"
          >
            C
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="w-12 h-12 text-base rounded-full flex items-center justify-center font-bold btn-secondary hover:bg-white/10 hover:border-white/20 active:scale-90 p-0 border border-white/5 bg-white/3"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="w-12 h-12 text-sm rounded-full flex items-center justify-center font-bold btn-secondary hover:bg-white/10 hover:border-white/20 active:scale-90 p-0 border border-white/5 bg-white/3"
          >
            ⌫
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={isSubmitting || input.length === 0}
          className="btn-primary w-full py-3.5 rounded-xl max-w-[240px] text-xs font-bold uppercase tracking-wider shadow-lg transition-all duration-200"
        >
          {isSubmitting ? 'Memproses...' : 'Buka Kunci'}
        </button>
      </div>
    </div>
  );
};
