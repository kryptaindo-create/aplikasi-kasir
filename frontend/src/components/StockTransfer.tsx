import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { db, type Inventory } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';

const BRANCH_LIST = [
  { id: 'b1000000-0000-0000-0000-000000000001', name: 'WAJAH DIESEL PEREULAK' },
  { id: 'b1000000-0000-0000-0000-000000000002', name: 'WAJAH DIESEL IDIH' },
  { id: 'b1000000-0000-0000-0000-000000000003', name: 'ASTANA PLASTIK' }
];

export const StockTransfer: React.FC = () => {
  const { user, submitStockTransfer, confirmStockTransfer } = useApp();
  
  const [activeTab, setActiveTab] = useState<'KIRIM' | 'TERIMA' | 'RIWAYAT'>('TERIMA');
  const [targetBranchId, setTargetBranchId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);

  // --- DB QUERIES ---
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const inventories = useLiveQuery<Inventory[]>(() => 
    user?.branch_id ? db.inventories.where({ branch_id: user.branch_id }).toArray() : Promise.resolve([] as Inventory[])
  ) || [];
  
  const transfers = useLiveQuery(() => db.stock_transfers.reverse().toArray()) || [];

  // Filter transfers where this branch is receiver and state is IN_TRANSIT
  const pendingIncomingTransfers = transfers.filter(
    t => t.to_branch_id === user?.branch_id && t.status === 'IN_TRANSIT'
  );

  // RIWAYAT transfers involving this branch
  const myTransfers = transfers.filter(
    t => t.from_branch_id === user?.branch_id || t.to_branch_id === user?.branch_id
  );

  const getProductStock = (productId: string) => {
    return inventories.find(i => i.product_id === productId)?.stock || 0;
  };

  const getProductName = (productId: string) => {
    return products.find(p => p.id === productId)?.name || 'Produk Tidak Dikenal';
  };

  const getBranchName = (bId: string) => {
    return BRANCH_LIST.find(b => b.id === bId)?.name || 'Cabang Tidak Dikenal';
  };

  const handleKirimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBranchId || !selectedProductId || quantity <= 0) {
      alert('Harap isi semua kolom dengan benar.');
      return;
    }

    const availableStock = getProductStock(selectedProductId);
    if (quantity > availableStock) {
      alert(`Stok tidak mencukupi. Stok saat ini: ${availableStock}`);
      return;
    }

    setLoading(true);
    try {
      await submitStockTransfer(targetBranchId, selectedProductId, quantity);
      alert('Stok berhasil dikirim (status: Dalam Perjalanan).');
      setSelectedProductId('');
      setQuantity(1);
      setActiveTab('RIWAYAT');
    } catch (err) {
      alert('Gagal memproses pengiriman.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (transferId: string, status: 'RECEIVED' | 'REJECTED') => {
    const actionName = status === 'RECEIVED' ? 'menerima' : 'menolak';
    if (!window.confirm(`Apakah Anda yakin ingin ${actionName} transfer barang ini?`)) return;

    try {
      await confirmStockTransfer(transferId, status);
      alert(`Transfer barang berhasil di-${status}.`);
    } catch (e) {
      alert('Gagal memperbarui status transfer.');
    }
  };

  return (
    <div className="flex-1 p-3.5 sm:p-6 overflow-y-auto bg-[#08090d] animate-fade-in relative">
      {/* Background ambient glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[35vw] h-[35vw] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[35vw] h-[35vw] rounded-full bg-pink-500/5 blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white/3 p-3.5 sm:p-4 rounded-2xl glass-panel border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 min-w-[2.5rem] rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white font-extrabold shadow border border-white/10">
              T
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-white leading-tight">Transfer Stok Antar-Cabang</h1>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Perpindahan inventaris memerlukan konfirmasi 2-arah.</p>
            </div>
          </div>
        </div>

        {/* Tab Headers (Segmented control style) */}
        <div className="flex justify-start w-full overflow-hidden">
          <div className="segmented-control w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('TERIMA')}
              className={`segmented-item flex items-center gap-2 ${activeTab === 'TERIMA' ? 'active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7V4m0 0L8 8m4-4l4 4" />
              </svg>
              <span>Terima Barang ({pendingIncomingTransfers.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('KIRIM')}
              className={`segmented-item flex items-center gap-2 ${activeTab === 'KIRIM' ? 'active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span>Kirim Stok</span>
            </button>
            <button
              onClick={() => setActiveTab('RIWAYAT')}
              className={`segmented-item flex items-center gap-2 ${activeTab === 'RIWAYAT' ? 'active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Riwayat Transfer</span>
            </button>
          </div>
        </div>

        {/* 1. TERIMA BARANG TAB */}
        {activeTab === 'TERIMA' && (
          <div className="space-y-4">
            {pendingIncomingTransfers.length === 0 ? (
              <div className="glass-panel p-10 text-center text-gray-500 border-white/5 font-bold flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/3 flex items-center justify-center text-gray-600 border border-white/5 mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <span>Tidak ada kiriman stok masuk yang berstatus 'Dalam Perjalanan'.</span>
              </div>
            ) : (
              pendingIncomingTransfers.map(t => (
                <div key={t.id} className="glass-panel p-5 border-indigo-500/10 bg-indigo-500/5 flex items-center justify-between animate-fade-in gap-4">
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-wider bg-indigo-500/10 px-2.5 py-0.5 rounded border border-indigo-500/15">
                      Dari: {getBranchName(t.from_branch_id)}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1.5">{getProductName(t.product_id)}</h3>
                    <p className="text-xs text-gray-400">
                      Jumlah Kirim: <span className="text-white font-extrabold">{t.quantity} unit</span> | Tanggal: {new Date(t.created_at).toLocaleString('id-ID')}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAction(t.id, 'RECEIVED')}
                      className="btn-success py-2 px-4 text-xs font-bold uppercase tracking-wider rounded-xl"
                    >
                      Terima Barang
                    </button>
                    <button
                      onClick={() => handleAction(t.id, 'REJECTED')}
                      className="btn-secondary py-2 px-4 text-xs font-bold uppercase tracking-wider rounded-xl text-rose-400 hover:bg-rose-500/10 border-rose-500/10"
                    >
                      Tolak
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 2. KIRIM STOK FORM TAB */}
        {activeTab === 'KIRIM' && (
          <form onSubmit={handleKirimSubmit} className="glass-panel p-6 border-white/5 space-y-5 max-w-xl shadow-2xl animate-fade-in">
            <h3 className="text-base font-bold text-white mb-1 uppercase tracking-wider">Form Pengiriman Barang</h3>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Toko Cabang Tujuan</label>
              <select
                value={targetBranchId}
                onChange={e => setTargetBranchId(e.target.value)}
                className="w-full bg-[#0f111a] border-white/5 font-semibold text-xs py-2.5"
                required
              >
                <option value="">-- Pilih Cabang Penerima --</option>
                {BRANCH_LIST.filter(b => b.id !== user?.branch_id).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Pilih Produk</label>
              <select
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
                className="w-full bg-[#0f111a] border-white/5 font-semibold text-xs py-2.5"
                required
              >
                <option value="">-- Pilih Produk --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Stok saat ini: {getProductStock(p.id)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Jumlah Kirim (Unit)</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value) || 0)}
                className="w-full py-2.5 px-3 text-xs bg-black/25 text-indigo-400 font-bold"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg">
              {loading ? 'Mengirim...' : 'Kirim Stok Baru'}
            </button>
          </form>
        )}

        {/* 3. RIWAYAT TRANSFER TAB */}
        {activeTab === 'RIWAYAT' && (
          <div className="glass-panel border-white/5 overflow-hidden shadow-2xl animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/3 border-b border-white/10 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                    <th className="p-4">Tanggal</th>
                    <th className="p-4">Barang</th>
                    <th className="p-4">Pengirim</th>
                    <th className="p-4">Penerima</th>
                    <th className="p-4 text-center">Jumlah</th>
                    <th className="p-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs font-semibold">
                  {myTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500 font-bold py-12">
                        Belum ada riwayat perpindahan stok.
                      </td>
                    </tr>
                  ) : (
                    myTransfers.map(t => (
                      <tr key={t.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 text-[11px] font-mono text-gray-400">
                          {new Date(t.created_at).toLocaleString('id-ID')}
                        </td>
                        <td className="p-4 font-bold text-white">
                          {getProductName(t.product_id)}
                        </td>
                        <td className="p-4 text-xs text-gray-300">
                          {getBranchName(t.from_branch_id)}
                        </td>
                        <td className="p-4 text-xs text-gray-300">
                          {getBranchName(t.to_branch_id)}
                        </td>
                        <td className="p-4 font-extrabold text-center text-indigo-300">
                          {t.quantity}
                        </td>
                        <td className="p-4 text-right">
                          <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold border uppercase tracking-wider ${
                            t.status === 'RECEIVED' ? 'bg-emerald/10 text-emerald-400 border-emerald-500/20' :
                            t.status === 'IN_TRANSIT' ? 'bg-amber/10 text-amber border-amber-500/20 animate-pulse' :
                            'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {t.status === 'RECEIVED' ? 'Selesai' :
                             t.status === 'IN_TRANSIT' ? 'Dalam Perjalanan' : 'Ditolak'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
