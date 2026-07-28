import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { db, type User } from '../db';

interface BranchReport {
  branch_id: string;
  branch_name: string;
  revenue: number;
  net_profit: number;
  transactions: number;
}

interface ConsolidatedData {
  total_revenue: number;
  net_profit: number;
  total_transactions: number;
}

interface VoidLog {
  id: string;
  transaction_id: string;
  cashier_name: string;
  authorizer_name: string;
  reason: string;
  created_at: string;
}

interface DiscountLog {
  id: string;
  transaction_id: string;
  cashier_name: string;
  authorizer_name: string;
  discount_percentage: number;
  created_at: string;
}

interface DiscrepancyLog {
  id: string;
  cashier_name: string;
  branch_name: string;
  expected_cash: number;
  actual_cash: number;
  variance: number;
  closing_time: string;
}

interface PendingClaim {
  id: string;
  product_id: string;
  product_name: string;
  branch_name: string;
  quantity: number;
  reason: string;
  notes: string;
  photo_evidence: string | null;
  created_at: string;
}

export const DashboardOwner: React.FC = () => {
  const { token, connectionState, syncData } = useApp();

  const [activeMenu, setActiveMenu] = useState<'METRICS' | 'FRAUD' | 'CLAIMS' | 'SESSIONS' | 'USERS'>('METRICS');
  const [loading, setLoading] = useState<boolean>(true);

  // Consolidated financial data
  const [report, setReport] = useState<ConsolidatedData>({ total_revenue: 0, net_profit: 0, total_transactions: 0 });
  const [branchesReport, setBranchesReport] = useState<BranchReport[]>([]);
  
  // Fraud logs
  const [voidLogs, setVoidLogs] = useState<VoidLog[]>([]);
  const [discountLogs, setDiscountLogs] = useState<DiscountLog[]>([]);
  const [discrepancyLogs, setDiscrepancyLogs] = useState<DiscrepancyLog[]>([]);

  // Pending stock claims
  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>([]);
  
  // Active sessions
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  // User Management State
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [newRole, setNewRole] = useState<'CASHIER' | 'MASTER_ADMIN'>('CASHIER');
  const [newBranchId, setNewBranchId] = useState<string>('b1000000-0000-0000-0000-000000000001');
  const [creatingUser, setCreatingUser] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string>('');
  const [modalSuccess, setModalSuccess] = useState<string>('');

  const BRANCHES_MAP: Record<string, string> = {
    'b1000000-0000-0000-0000-000000000001': 'Wajad Diesel Pereulak',
    'b1000000-0000-0000-0000-000000000002': 'Wajah Diesel Idi',
    'b1000000-0000-0000-0000-000000000003': 'Astana Plastik'
  };

  // Fetch report data
  const fetchData = async () => {
    if (connectionState === 'OFFLINE' || !token) {
      // Fallback mocks for offline visualization
      setReport({ total_revenue: 120500000, net_profit: 32400000, total_transactions: 924 });
      setBranchesReport([
        { branch_id: 'b1', branch_name: 'Wajad Diesel Pereulak', revenue: 45000000, net_profit: 12000000, transactions: 340 },
        { branch_id: 'b2', branch_name: 'Wajah Diesel Idi', revenue: 38500000, net_profit: 9800000, transactions: 294 },
        { branch_id: 'b3', branch_name: 'Astana Plastik', revenue: 37000000, net_profit: 10600000, transactions: 290 }
      ]);
      try {
        const localUsers = await db.users.toArray();
        setUsersList(localUsers);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch metrics
      const repRes = await fetch('http://localhost:5000/api/v1/admin/reports/consolidated', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (repRes.ok) {
        const data = await repRes.json();
        setReport(data.consolidated);
        setBranchesReport(data.branches);
      }

      // 2. Fetch fraud logs
      const fraudRes = await fetch('http://localhost:5000/api/v1/admin/fraud-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (fraudRes.ok) {
        const data = await fraudRes.json();
        setVoidLogs(data.voids);
        setDiscountLogs(data.discounts);
        setDiscrepancyLogs(data.discrepancies);
      }

      // 3. Fetch active sessions
      const sessRes = await fetch('http://localhost:5000/api/v1/admin/active-sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (sessRes.ok) {
        const data = await sessRes.json();
        setActiveSessions(data);
      }

      // 4. Mock pending claims since DB table doesn't have names joined, or fetch from stock claims
      // In production, we'd query stock_claims where status = PENDING_APPROVAL joined with products and branches.
      // For presentation, we query the server and map claims.
      const claimsRes = await fetch('http://localhost:5000/api/v1/sync/pull?branch_id=b1000000-0000-0000-0000-000000000001', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (claimsRes.ok) {
        const pullData = await claimsRes.json();
        // Look up product names
        const mappedClaims = pullData.stockClaims
          .filter((c: any) => c.status === 'PENDING_APPROVAL')
          .map((c: any) => ({
            id: c.id,
            product_id: c.product_id,
            product_name: pullData.products.find((p: any) => p.id === c.product_id)?.name || 'Kopi Susu Gula Aren 250ml',
            branch_name: 'Wajad Diesel Pereulak',
            quantity: c.quantity,
            reason: c.reason,
            notes: c.notes,
            photo_evidence: c.photo_evidence,
            created_at: c.created_at
          }));
        setPendingClaims(mappedClaims);
      }

      const localUsers = await db.users.toArray();
      setUsersList(localUsers);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [connectionState, token]);

  const handleClaimApproval = async (claimId: string, approve: boolean) => {
    if (!token) return;
    const confirmMsg = approve ? 'menyetujui' : 'menolak';
    if (!window.confirm(`Apakah Anda yakin ingin ${confirmMsg} Berita Acara ini?`)) return;

    try {
      const res = await fetch('http://localhost:5000/api/v1/admin/claims/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ claim_id: claimId, approve })
      });

      if (res.ok) {
        alert(`Berita Acara berhasil di-${approve ? 'setujui' : 'tolak'}.`);
        fetchData(); // reload
      } else {
        alert('Gagal memproses berita acara.');
      }
    } catch (e) {
      alert('Gagal menghubungi server.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword || !newPin) {
      setModalError('Semua field wajib diisi');
      return;
    }

    if (newPin.length !== 6) {
      setModalError('PIN harus berukuran 6 digit angka');
      return;
    }

    if (connectionState === 'OFFLINE') {
      setModalError('Pendaftaran akun memerlukan koneksi online untuk enkripsi hashing backend.');
      return;
    }

    try {
      setCreatingUser(true);
      setModalError('');
      setModalSuccess('');

      const res = await fetch('http://localhost:5000/api/v1/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          pin: newPin,
          role: newRole,
          branch_id: newRole === 'CASHIER' ? newBranchId : null
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Gagal membuat akun');
      }

      setModalSuccess('Akun berhasil dibuat! Menyelaraskan data...');
      
      // Clear inputs
      setNewUsername('');
      setNewPassword('');
      setNewPin('');

      // Pull latest user hashes to Dexie
      if (syncData) {
        await syncData();
      }

      // Reload
      const localUsers = await db.users.toArray();
      setUsersList(localUsers);

      setTimeout(() => {
        setIsCreateModalOpen(false);
        setModalSuccess('');
      }, 1500);

    } catch (err: any) {
      setModalError(err.message || 'Gagal membuat akun');
    } finally {
      setCreatingUser(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex-center bg-[#0a0b10] text-gray-400">
        <span>Memuat data dashboard terpusat...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#08090d] animate-fade-in relative">
      {/* Background radial glows */}
      <div className="absolute top-[-5%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[35vw] h-[35vw] rounded-full bg-pink-500/5 blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex justify-between items-center bg-white/3 p-4 rounded-2xl glass-panel border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white font-extrabold shadow border border-white/10">
              M
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white leading-tight">Dashboard Master Owner</h1>
              <p className="text-xs text-gray-400 mt-0.5">Konsolidasi Keuangan & Audit Fraud Real-time.</p>
            </div>
          </div>
          <button onClick={fetchData} className="btn-secondary py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider">
            Segarkan Laporan
          </button>
        </div>

        {/* Dashboard Menu Tabs (Segmented Control style) */}
        <div className="flex justify-start">
          <div className="segmented-control">
            <button
              onClick={() => setActiveMenu('METRICS')}
              className={`segmented-item flex items-center gap-2 ${activeMenu === 'METRICS' ? 'active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Konsolidasi Keuangan
            </button>
            <button
              onClick={() => setActiveMenu('FRAUD')}
              className={`segmented-item flex items-center gap-2 ${activeMenu === 'FRAUD' ? 'active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Anti-Fraud System
            </button>
            <button
              onClick={() => setActiveMenu('CLAIMS')}
              className={`segmented-item flex items-center gap-2 ${activeMenu === 'CLAIMS' ? 'active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Persetujuan Berita Acara ({pendingClaims.length})
            </button>
            <button
              onClick={() => setActiveMenu('SESSIONS')}
              className={`segmented-item flex items-center gap-2 ${activeMenu === 'SESSIONS' ? 'active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Sesi &amp; Aktivitas Kasir
            </button>
            <button
              onClick={() => setActiveMenu('USERS')}
              className={`segmented-item flex items-center gap-2 ${activeMenu === 'USERS' ? 'active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Manajemen Akun
            </button>
          </div>
        </div>

        {/* 1. KONSOLIDASI KEUANGAN TAB */}
        {activeMenu === 'METRICS' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-6">
              <div className="glass-panel p-6 border-white/5 bg-gradient-to-br from-indigo-500/5 to-pink-500/5 flex flex-col justify-between h-40">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Pendapatan (Omset)</span>
                  <h3 className="text-3xl font-black text-white mt-2">
                    Rp {report.total_revenue.toLocaleString('id-ID')}
                  </h3>
                </div>
                {/* SVG Mock Sparkline for visual depth */}
                <div className="h-10 w-full overflow-hidden mt-3">
                  <svg className="w-full h-full text-indigo-400" viewBox="0 0 120 30" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="omset-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(99, 102, 241, 0.2)" />
                        <stop offset="100%" stopColor="rgba(99, 102, 241, 0)" />
                      </linearGradient>
                    </defs>
                    <path d="M0,25 L15,12 L30,18 L45,6 L60,15 L75,8 L90,14 L105,5 L120,10 L120,30 L0,30 Z" fill="url(#omset-grad)" />
                    <path d="M0,25 L15,12 L30,18 L45,6 L60,15 L75,8 L90,14 L105,5 L120,10" fill="none" stroke="rgba(99, 102, 241, 0.6)" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>
              <div className="glass-panel p-6 border-white/5 bg-gradient-to-br from-emerald/5 to-indigo-500/5 flex flex-col justify-between h-40">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Laba Bersih</span>
                  <h3 className="text-3xl font-black text-gradient-emerald mt-2">
                    Rp {report.net_profit.toLocaleString('id-ID')}
                  </h3>
                </div>
                {/* SVG Mock Sparkline */}
                <div className="h-10 w-full overflow-hidden mt-3">
                  <svg className="w-full h-full text-emerald" viewBox="0 0 120 30" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="laba-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(16, 185, 129, 0.2)" />
                        <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
                      </linearGradient>
                    </defs>
                    <path d="M0,20 L15,24 L30,10 L45,15 L60,5 L75,18 L90,12 L105,22 L120,5 L120,30 L0,30 Z" fill="url(#laba-grad)" />
                    <path d="M0,20 L15,24 L30,10 L45,15 L60,5 L75,18 L90,12 L105,22 L120,5" fill="none" stroke="rgba(16, 185, 129, 0.6)" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>
              <div className="glass-panel p-6 border-white/5 bg-gradient-to-br from-indigo-500/5 to-white/5 flex flex-col justify-between h-40">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Transaksi</span>
                  <h3 className="text-3xl font-black text-gradient-indigo mt-2">
                    {report.total_transactions} <span className="text-sm font-medium text-gray-500 uppercase tracking-widest">Tx</span>
                  </h3>
                </div>
                <div className="flex gap-1.5 items-center text-[11px] text-gray-500 font-bold uppercase tracking-wider mt-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-500/40 animate-ping" />
                  <span>Real-time Transaksi Masuk</span>
                </div>
              </div>
            </div>

            {/* Branch breakdown */}
            <div className="glass-panel border-white/5 overflow-hidden">
              <div className="p-4 bg-white/3 border-b border-white/10 font-bold text-white text-sm tracking-tight flex items-center justify-between">
                <span>Rincian Per-Cabang Toko</span>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-0.5 rounded border border-indigo-500/15 uppercase tracking-wider">3 Cabang Aktif</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] font-bold uppercase text-gray-400 bg-black/35 tracking-wider">
                      <th className="p-4">Nama Toko</th>
                      <th className="p-4 text-center">Transaksi</th>
                      <th className="p-4">Omset Pendapatan</th>
                      <th className="p-4">Laba Bersih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs font-semibold">
                    {branchesReport.map(b => (
                      <tr key={b.branch_id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 font-bold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-400" />
                          {b.branch_name}
                        </td>
                        <td className="p-4 text-center font-extrabold text-gray-200">{b.transactions}</td>
                        <td className="p-4 text-emerald font-bold">Rp {Number(b.revenue).toLocaleString('id-ID')}</td>
                        <td className="p-4 text-indigo-300 font-bold">Rp {Number(b.net_profit).toLocaleString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Offline-First Sync instructions */}
            <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-[11px] text-gray-500 leading-relaxed">
              <strong className="text-gray-400">Catatan Sinkronisasi:</strong> Data di atas dikonsolidasi dari transaksi yang berhasil di-upload secara online oleh kasir cabang A, B, dan C. Deviasi kasir saat offline akan diperbarui ke database cloud pusat begitu perangkat kasir terhubung kembali ke jaringan internet.
            </div>
          </div>
        )}

        {/* 2. ANTI-FRAUD SYSTEM AUDITING TAB */}
        {activeMenu === 'FRAUD' && (
          <div className="space-y-6">
            {/* Status bar */}
            <div className="glass-panel p-4 border-white/5 bg-gradient-to-r from-emerald-500/5 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 pulse-glow-indicator" />
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">System Security Status: SECURE</span>
              </div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Otorisasi PIN Wajib Aktif</span>
            </div>

            {/* Void logs */}
            <div className="glass-panel border-white/5 overflow-hidden">
              <div className="p-4 bg-rose-500/5 border-b border-rose-500/10 font-bold text-rose-400 text-sm tracking-tight flex items-center justify-between">
                <span>Log Audit Void &amp; Item Deletion (PIN Master Otorisasi)</span>
                <span className="text-[10px] bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded uppercase tracking-wider font-extrabold">Void audit trail</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 font-bold uppercase text-gray-400 bg-black/35 tracking-wider">
                      <th className="p-3">Tanggal</th>
                      <th className="p-3">ID Tx</th>
                      <th className="p-3">Kasir</th>
                      <th className="p-3">Otorisator (Master Admin)</th>
                      <th className="p-3 text-right">Alasan Pembatalan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {voidLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-500 font-bold">
                          <div className="flex flex-col items-center gap-2 justify-center py-4">
                            <div className="w-10 h-10 rounded-full bg-white/3 flex items-center justify-center text-gray-600 border border-white/5 mb-1">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                            </div>
                            <span>Tidak ada log void yang terekam (Sistem Aman)</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      voidLogs.map(l => (
                        <tr key={l.id} className="hover:bg-white/3 transition-colors text-gray-300">
                          <td className="p-3 font-mono text-[11px]">{new Date(l.created_at).toLocaleString('id-ID')}</td>
                          <td className="p-3 font-mono text-gray-500">{l.transaction_id.substring(0, 16)}...</td>
                          <td className="p-3 font-bold text-gray-200">{l.cashier_name}</td>
                          <td className="p-3 text-emerald font-bold">{l.authorizer_name}</td>
                          <td className="p-3 text-rose-400 font-extrabold text-right">{l.reason}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Discount logs */}
            <div className="glass-panel border-white/5 overflow-hidden">
              <div className="p-4 bg-indigo-500/5 border-b border-indigo-500/10 font-bold text-indigo-400 text-sm tracking-tight flex items-center justify-between">
                <span>Log Audit Diskon Ilegal (Bypass Maksimal &gt;10%)</span>
                <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded uppercase tracking-wider font-extrabold">Bypass logs</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 font-bold uppercase text-gray-400 bg-black/35 tracking-wider">
                      <th className="p-3">Tanggal</th>
                      <th className="p-3">ID Tx</th>
                      <th className="p-3">Kasir</th>
                      <th className="p-3">Otorisator</th>
                      <th className="p-3 text-center">Persentase Diskon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {discountLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-500 font-bold">
                          <div className="flex flex-col items-center gap-2 justify-center py-4">
                            <div className="w-10 h-10 rounded-full bg-white/3 flex items-center justify-center text-gray-600 border border-white/5 mb-1">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                            </div>
                            <span>Tidak ada log bypass diskon terdeteksi</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      discountLogs.map(l => (
                        <tr key={l.id} className="hover:bg-white/3 transition-colors text-gray-300">
                          <td className="p-3 font-mono text-[11px]">{new Date(l.created_at).toLocaleString('id-ID')}</td>
                          <td className="p-3 font-mono text-gray-500">{l.transaction_id.substring(0, 16)}...</td>
                          <td className="p-3 font-bold text-gray-200">{l.cashier_name}</td>
                          <td className="p-3 text-emerald font-bold">{l.authorizer_name}</td>
                          <td className="p-3 text-center font-extrabold text-indigo-400">{l.discount_percentage}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Discrepancies */}
            <div className="glass-panel border-white/5 overflow-hidden">
              <div className="p-4 bg-rose-500/5 border-b border-rose-500/10 font-bold text-rose-500 text-sm tracking-tight flex items-center justify-between">
                <span>Penyimpangan Uang Kas Drawer (Variance Minus)</span>
                <span className="text-[10px] bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded uppercase tracking-wider font-extrabold">Kas discrepancy</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 font-bold uppercase text-gray-400 bg-black/35 tracking-wider">
                      <th className="p-3">Tutup Shift</th>
                      <th className="p-3">Kasir</th>
                      <th className="p-3">Cabang Toko</th>
                      <th className="p-3">Expected (Sistem)</th>
                      <th className="p-3">Fisik (Input Laci)</th>
                      <th className="p-3">Deviasi Selisih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {discrepancyLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-500 font-bold">
                          <div className="flex flex-col items-center gap-2 justify-center py-4">
                            <div className="w-10 h-10 rounded-full bg-white/3 flex items-center justify-center text-gray-600 border border-white/5 mb-1">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                            </div>
                            <span>Laci Kasir Aman (Selisih Nihil)</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      discrepancyLogs.map(l => (
                        <tr key={l.id} className="hover:bg-white/3 transition-colors text-gray-300">
                          <td className="p-3 font-mono text-[11px]">{new Date(l.closing_time).toLocaleString('id-ID')}</td>
                          <td className="p-3 font-bold text-gray-200">{l.cashier_name}</td>
                          <td className="p-3 text-gray-400">{l.branch_name}</td>
                          <td className="p-3">Rp {Number(l.expected_cash).toLocaleString('id-ID')}</td>
                          <td className="p-3">Rp {Number(l.actual_cash).toLocaleString('id-ID')}</td>
                          <td className="p-3 font-bold text-rose-500 bg-rose-500/5">Rp {Number(l.variance).toLocaleString('id-ID')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. persetujuan BERITA ACARA STOK CLAIMS */}
        {activeMenu === 'CLAIMS' && (
          <div className="space-y-4">
            {pendingClaims.length === 0 ? (
              <div className="glass-panel p-10 text-center text-gray-500 border-white/5 font-bold flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/3 flex items-center justify-center text-gray-600 border border-white/5 mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span>Tidak ada pengajuan berita acara stok (write-off) baru.</span>
              </div>
            ) : (
              pendingClaims.map(c => (
                <div key={c.id} className="glass-panel p-5 border-white/5 bg-white/3 flex justify-between items-start animate-fade-in gap-6">
                  <div className="space-y-3 flex-1">
                    <div className="flex gap-2 items-center">
                      <span className="text-[9px] px-2.5 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold uppercase tracking-wider">
                        {c.reason}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{c.branch_name}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white">{c.product_name}</h3>
                    <p className="text-xs text-indigo-300 font-bold">Jumlah Claim: <span className="text-white font-extrabold text-sm">{c.quantity}</span> unit</p>
                    <p className="text-xs text-gray-400 leading-relaxed bg-black/20 p-2.5 rounded-xl border border-white/5">
                      Kronologi/Notes: <span className="text-gray-300 italic">"{c.notes}"</span>
                    </p>
                    {c.photo_evidence && (
                      <div className="mt-3">
                        <span className="text-[10px] text-gray-500 font-bold block mb-1.5 uppercase tracking-wider">Bukti Foto Kerusakan:</span>
                        <img src={c.photo_evidence} alt="Evidence" className="w-48 h-32 object-cover rounded-xl border border-white/10 shadow-lg" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 mt-2">
                    <button
                      onClick={() => handleClaimApproval(c.id, true)}
                      className="btn-success py-2.5 px-4 text-xs font-bold uppercase tracking-wider rounded-xl"
                    >
                      Setujui (Deduce Stok)
                    </button>
                    <button
                      onClick={() => handleClaimApproval(c.id, false)}
                      className="btn-secondary py-2.5 px-4 text-xs font-bold uppercase tracking-wider rounded-xl text-rose-400 hover:bg-rose-500/10 border-rose-500/10"
                    >
                      Tolak
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 4. ACTIVE SESSIONS MONITORING (Redesigned Profile Cards Grid) */}
        {activeMenu === 'SESSIONS' && (
          <div className="space-y-4">
            <div className="glass-panel p-4 border-white/5 bg-white/3 font-bold text-white text-sm tracking-tight flex items-center justify-between">
              <span>Sesi Aktif Perangkat &amp; Kasir (Anti-MultiLogin Monitor)</span>
              <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/15 text-indigo-400 font-bold px-2 py-0.5 rounded uppercase tracking-wider">Live tracking</span>
            </div>

            {activeSessions.length === 0 ? (
              <div className="glass-panel p-10 text-center text-gray-500 border-white/5 font-bold flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/3 flex items-center justify-center text-gray-600 border border-white/5 mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <span>Tidak ada sesi kasir aktif saat ini.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeSessions.map(s => (
                  <div key={s.id} className="glass-panel p-5 border-white/5 flex gap-4 items-center hover:border-indigo-500/20 hover:bg-indigo-500/[0.02] transition-all">
                    {/* Cashier Initials Avatar */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 p-0.5 flex-shrink-0">
                      <div className="w-full h-full rounded-full bg-[#10121e] flex items-center justify-center font-black text-white text-base">
                        {s.username.charAt(0).toUpperCase()}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 justify-between">
                        <h4 className="text-sm font-bold text-white truncate">{s.username}</h4>
                        <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-extrabold uppercase bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-glow-indicator" />
                          Aktif
                        </span>
                      </div>
                      
                      <p className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-wider mt-1">
                        {s.role} — {s.branch_name || 'Owner Central'}
                      </p>
                      
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono mt-2 pt-2 border-t border-white/5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate">{s.device_identifier}</span>
                      </div>
                      <p className="text-[9px] text-gray-600 font-mono mt-1">
                        Aktif Terakhir: {new Date(s.last_active_at).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. MANAJEMEN AKUN TAB */}
        {activeMenu === 'USERS' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white/3 p-4 rounded-2xl glass-panel border-white/5">
              <div>
                <h3 className="text-base font-extrabold text-white">Manajemen Akun Kasir &amp; Admin</h3>
                <p className="text-xs text-gray-400 mt-0.5">Daftar kredensial kasir aktif cabang dan admin pusat.</p>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(true);
                  setModalError('');
                  setModalSuccess('');
                }}
                className="btn-primary py-2.5 px-5 rounded-xl text-xs font-bold uppercase tracking-wider shadow"
              >
                + Buat Akun Baru
              </button>
            </div>

            <div className="glass-panel overflow-hidden border border-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-gray-400 text-xs font-semibold uppercase tracking-wider border-b border-white/5">
                      <th className="py-4 px-6">Nama Pengguna (Username)</th>
                      <th className="py-4 px-6">Peran (Role)</th>
                      <th className="py-4 px-6">Tugas Cabang</th>
                      <th className="py-4 px-6 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {usersList.map(u => (
                      <tr key={u.id} className="hover:bg-white/3 transition-colors">
                        <td className="py-4 px-6 font-semibold text-white">{u.username}</td>
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                            u.role === 'MASTER_ADMIN'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          }`}>
                            {u.role === 'MASTER_ADMIN' ? 'Owner / Admin Pusat' : 'Kasir Cabang'}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-medium text-gray-300">
                          {u.branch_id ? BRANCHES_MAP[u.branch_id] || u.branch_id : 'Pusat (Semua Cabang)'}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="px-2 py-0.5 text-[9px] font-extrabold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                            Aktif
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Account Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-md overflow-hidden border border-white/10">
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
              <h3 className="text-lg font-bold text-white">Buat Akun Baru</h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-[#0a0b12] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
                  placeholder="Contoh: kasir_kemang"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#0a0b12] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
                  placeholder="Masukkan password"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">PIN Transaksi (6 Digit)</label>
                <input
                  type="text"
                  maxLength={6}
                  pattern="\d{6}"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-[#0a0b12] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm font-mono tracking-widest text-center"
                  placeholder="123456"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Role (Hak Akses)</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'CASHIER' | 'MASTER_ADMIN')}
                  className="w-full bg-[#0a0b12] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
                >
                  <option value="CASHIER">KASIR CABANG (CASHIER)</option>
                  <option value="MASTER_ADMIN">MASTER ADMIN / OWNER</option>
                </select>
              </div>

              {newRole === 'CASHIER' && (
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Tugas Cabang</label>
                  <select
                    value={newBranchId}
                    onChange={(e) => setNewBranchId(e.target.value)}
                    className="w-full bg-[#0a0b12] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
                  >
                    {Object.keys(BRANCHES_MAP).map(id => (
                      <option key={id} value={id}>{BRANCHES_MAP[id]}</option>
                    ))}
                  </select>
                </div>
              )}

              {modalError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold">
                  ⚠️ {modalError}
                </div>
              )}

              {modalSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold">
                  ✅ {modalSuccess}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn-secondary py-2.5 px-5 text-sm"
                  disabled={creatingUser}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary py-2.5 px-6 text-sm"
                  disabled={creatingUser}
                >
                  {creatingUser ? 'Memproses...' : 'Buat Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
