import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';

export const StockClaims: React.FC = () => {
  const { user, submitStockClaim } = useApp();

  const [activeTab, setActiveTab] = useState<'BUAT' | 'RIWAYAT'>('BUAT');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<'DAMAGED' | 'LOST' | 'EXPIRED'>('DAMAGED');
  const [notes, setNotes] = useState<string>('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // --- DB QUERIES ---
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const inventories = useLiveQuery(() => 
    user?.branch_id ? db.inventories.where({ branch_id: user.branch_id }).toArray() : Promise.resolve([])
  ) || [];
  
  const claims = useLiveQuery(() => db.stock_claims.reverse().toArray()) || [];

  const getProductStock = (productId: string) => {
    return inventories.find(i => i.product_id === productId)?.stock || 0;
  };

  const getProductName = (productId: string) => {
    return products.find(p => p.id === productId)?.name || 'Produk Tidak Dikenal';
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string); // Save as base64 string
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || quantity <= 0 || !notes) {
      alert('Harap lengkapi semua kolom wajib.');
      return;
    }

    const availableStock = getProductStock(selectedProductId);
    if (quantity > availableStock) {
      alert(`Jumlah klaim melebihi stok yang ada (${availableStock} unit).`);
      return;
    }

    setLoading(true);
    try {
      await submitStockClaim(selectedProductId, quantity, reason, notes, photo);
      alert('Pengajuan Berita Acara berhasil dibuat. Stok aktif berkurang sementara menunggu persetujuan Master Admin.');
      
      // Clear Form
      setSelectedProductId('');
      setQuantity(1);
      setNotes('');
      setPhoto(null);
      setActiveTab('RIWAYAT');
    } catch (err) {
      alert('Gagal mengirimkan pengajuan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#08090d] animate-fade-in relative">
      {/* Background ambient glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[35vw] h-[35vw] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[35vw] h-[35vw] rounded-full bg-pink-500/5 blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto space-y-6 relative z-10">
        <div className="flex justify-between items-center bg-white/3 p-4 rounded-2xl glass-panel border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white font-extrabold shadow border border-white/10">
              W
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white leading-tight">Berita Acara Kerusakan &amp; Kehilangan Stok</h1>
              <p className="text-xs text-gray-400 mt-0.5">Pengurangan stok non-transaksi wajib diajukan ke Master Admin untuk verifikasi audit.</p>
            </div>
          </div>
        </div>

        {/* Tab Selector (Segmented control) */}
        <div className="flex justify-start">
          <div className="segmented-control">
            <button
              onClick={() => setActiveTab('BUAT')}
              className={`segmented-item flex items-center gap-2 ${activeTab === 'BUAT' ? 'active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Buat Pengajuan Baru
            </button>
            <button
              onClick={() => setActiveTab('RIWAYAT')}
              className={`segmented-item flex items-center gap-2 ${activeTab === 'RIWAYAT' ? 'active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Daftar Berita Acara ({claims.length})
            </button>
          </div>
        </div>

        {/* TAB 1: FORM PENGAMBILAN BERITA ACARA */}
        {activeTab === 'BUAT' && (
          <form onSubmit={handleSubmit} className="glass-panel p-6 border-white/5 space-y-5 max-w-xl shadow-2xl animate-fade-in">
            <h3 className="text-base font-bold text-white mb-1 uppercase tracking-wider">Form Klaim Stok Rusak / Hilang</h3>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Pilih Produk *</label>
              <select
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
                className="w-full bg-[#0f111a] border-white/5 font-semibold text-xs py-2.5"
                required
              >
                <option value="">-- Pilih Produk --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Stok aktif: {getProductStock(p.id)})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Jumlah Klaim *</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(parseInt(e.target.value) || 0)}
                  className="w-full py-2 px-3 font-semibold text-xs text-indigo-400 bg-black/25"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Alasan Klaim *</label>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value as any)}
                  className="w-full bg-[#0f111a] border-white/5 font-semibold text-xs py-2.5"
                  required
                >
                  <option value="DAMAGED">Barang Rusak</option>
                  <option value="LOST">Barang Hilang / Dicuri</option>
                  <option value="EXPIRED">Kedaluwarsa (Expired)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Keterangan / Kronologi *</label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Tuliskan keterangan detail..."
                className="w-full py-2.5 px-3 text-xs bg-black/25"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Unggah Foto Bukti Fisik</label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="w-full text-xs text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:uppercase file:tracking-wider file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20"
              />
              {photo && (
                <div className="mt-3 relative w-32 h-32 rounded-xl overflow-hidden border border-white/10 shadow-lg animate-fade-in">
                  <img src={photo} alt="Evidence Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    className="absolute top-1.5 right-1.5 bg-black/75 hover:bg-black text-white rounded-full w-5 h-5 flex items-center justify-center text-xs border border-white/10"
                  >
                    &times;
                  </button>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg">
              {loading ? 'Mengirimkan...' : 'Kirim Berita Acara'}
            </button>
          </form>
        )}

        {/* TAB 2: RIWAYAT CLAIMS */}
        {activeTab === 'RIWAYAT' && (
          <div className="glass-panel border-white/5 overflow-hidden shadow-2xl animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/3 border-b border-white/10 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                    <th className="p-4">Tanggal</th>
                    <th className="p-4">Produk</th>
                    <th className="p-4">Tipe Klaim</th>
                    <th className="p-4 text-center">Jumlah</th>
                    <th className="p-4">Keterangan</th>
                    <th className="p-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs font-semibold">
                  {claims.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500 font-bold py-12">
                        Belum ada berita acara yang diajukan.
                      </td>
                    </tr>
                  ) : (
                    claims.map(c => (
                      <tr key={c.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 text-[11px] font-mono text-gray-400">
                          {new Date(c.created_at).toLocaleString('id-ID')}
                        </td>
                        <td className="p-4 font-bold text-white">
                          {getProductName(c.product_id)}
                        </td>
                        <td className="p-4">
                          <span className="text-[10px] font-bold tracking-wide uppercase text-gray-300">
                            {c.reason === 'DAMAGED' ? 'Rusak' : c.reason === 'LOST' ? 'Hilang' : 'Expired'}
                          </span>
                        </td>
                        <td className="p-4 font-extrabold text-center text-indigo-300">
                          {c.quantity}
                        </td>
                        <td className="p-4 text-gray-400 truncate max-w-[200px]" title={c.notes}>
                          {c.notes}
                        </td>
                        <td className="p-4 text-right">
                          <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold border uppercase tracking-wider ${
                            c.status === 'APPROVED' ? 'bg-emerald/10 text-emerald-400 border-emerald-500/20' :
                            c.status === 'PENDING_APPROVAL' ? 'bg-amber/10 text-amber border-amber-500/20 animate-pulse' :
                            'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {c.status === 'APPROVED' ? 'Disetujui' :
                             c.status === 'PENDING_APPROVAL' ? 'Menunggu' : 'Ditolak'}
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
