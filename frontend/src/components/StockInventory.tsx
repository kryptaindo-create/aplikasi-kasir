import React, { useState, useEffect } from 'react';
import { db, type Product, type Inventory } from '../db';
import { useApp } from '../context/AppContext';

const BRANCHES_MAP: Record<string, string> = {
  'b1000000-0000-0000-0000-000000000001': 'Wajad Diesel Pereulak',
  'b1000000-0000-0000-0000-000000000002': 'Wajah Diesel Idi',
  'b1000000-0000-0000-0000-000000000003': 'Astana Plastik'
};

const CATEGORY_LIST = ['Makanan', 'Minuman', 'Tembakau', 'Kebutuhan Anak', 'Alat Tulis', 'Elektronik', 'Lainnya'];
const FILTER_CATEGORIES = ['Semua Kategori', ...CATEGORY_LIST];

const fmtRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const pct = (n: number) => `${n.toFixed(1)}%`;

export const StockInventory: React.FC = () => {
  const { user, token, connectionState } = useApp();
  const isOwner = user?.role === 'MASTER_ADMIN';

  const [products, setProducts] = useState<Product[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua Kategori');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');

  // ── EDIT MODAL ──────────────────────────────────────────────────
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editSellPrice, setEditSellPrice] = useState<number>(0);
  const [editCostPrice, setEditCostPrice] = useState<number>(0);
  const [editCategory, setEditCategory] = useState<string>('');
  const [editStocks, setEditStocks] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [editError, setEditError] = useState<string>('');

  // ── ADD PRODUCT MODAL ────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newBarcode, setNewBarcode] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('Makanan');
  const [newSellPrice, setNewSellPrice] = useState<string>('');
  const [newCostPrice, setNewCostPrice] = useState<string>('');
  const [newMaxDiscount, setNewMaxDiscount] = useState<string>('10');
  const [newStocks, setNewStocks] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<boolean>(false);
  const [addError, setAddError] = useState<string>('');
  const [addSuccess, setAddSuccess] = useState<string>('');

  // Load from Dexie
  const loadData = async () => {
    try {
      setLoading(true);
      const allProducts = await db.products.toArray();
      const allInventories = await db.inventories.toArray();
      setProducts(allProducts);
      setInventories(allInventories);
    } catch (err) {
      console.error('Error loading inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ── COMPUTED ─────────────────────────────────────────────────────
  const filteredProducts = products.filter(prod => {
    const q = searchQuery.toLowerCase();
    const matchSearch = prod.name.toLowerCase().includes(q) || prod.barcode.includes(q);
    const matchCat = selectedCategory === 'Semua Kategori' || prod.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const getStock = (productId: string, branchId: string): number => {
    const inv = inventories.find(i => i.product_id === productId && i.branch_id === branchId);
    return inv ? inv.stock : 0;
  };

  const getTotalStock = (productId: string): number =>
    Object.keys(BRANCHES_MAP).reduce((sum, bId) => sum + getStock(productId, bId), 0);

  const getGrossMargin = (prod: Product): number => prod.selling_price - prod.cost_price;
  const getGrossMarginPct = (prod: Product): number =>
    prod.selling_price > 0 ? (getGrossMargin(prod) / prod.selling_price) * 100 : 0;

  // Profit columns visible to owner only
  const branchIds = isOwner ? Object.keys(BRANCHES_MAP) : (user?.branch_id ? [user.branch_id] : []);

  // ── EDIT MODAL ────────────────────────────────────────────────────
  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setEditSellPrice(product.selling_price);
    setEditCostPrice(product.cost_price || 0);
    setEditCategory(product.category);
    const stocksObj: Record<string, number> = {};
    Object.keys(BRANCHES_MAP).forEach(bId => { stocksObj[bId] = getStock(product.id, bId); });
    setEditStocks(stocksObj);
    setEditError('');
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    if (editSellPrice <= 0) { setEditError('Harga jual harus lebih dari 0'); return; }
    if (editCostPrice < 0) { setEditError('Harga beli tidak boleh negatif'); return; }
    if (editSellPrice < editCostPrice) { setEditError('⚠️ Harga jual lebih kecil dari harga beli!'); return; }
    setSaving(true);
    setEditError('');
    try {
      // Update Dexie local
      await db.products.update(editingProduct.id, {
        selling_price: editSellPrice,
        cost_price: editCostPrice,
        category: editCategory,
        updated_at: new Date().toISOString()
      });

      for (const [branchId, stock] of Object.entries(editStocks)) {
        const existing = inventories.find(i => i.product_id === editingProduct.id && i.branch_id === branchId);
        if (existing) {
          await db.inventories.where({ product_id: editingProduct.id, branch_id: branchId }).modify({ stock });
        } else {
          await db.inventories.add({ product_id: editingProduct.id, branch_id: branchId, stock });
        }
      }

      // API sync if online
      if (connectionState !== 'OFFLINE' && token) {
        await fetch(`http://localhost:5000/api/v1/admin/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ selling_price: editSellPrice, cost_price: editCostPrice, category: editCategory })
        });
        for (const [branchId, stock] of Object.entries(editStocks)) {
          await fetch(`http://localhost:5000/api/v1/admin/inventories/${editingProduct.id}/${branchId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ stock })
          });
        }
      }

      setEditingProduct(null);
      await loadData();
    } catch (e: any) {
      setEditError(e.message || 'Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  };

  // ── ADD PRODUCT ───────────────────────────────────────────────────
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    if (!newBarcode || !newName) { setAddError('Barcode dan nama wajib diisi'); return; }
    const sell = parseFloat(newSellPrice);
    const cost = parseFloat(newCostPrice);
    if (isNaN(sell) || sell <= 0) { setAddError('Harga jual harus lebih dari 0'); return; }
    if (isNaN(cost) || cost < 0) { setAddError('Harga beli tidak valid'); return; }

    setAdding(true);
    try {
      const newId = `p${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const stocks: Record<string, number> = {};
      Object.keys(BRANCHES_MAP).forEach(bId => { stocks[bId] = parseInt(newStocks[bId] || '0') || 0; });

      // Save to Dexie
      await db.products.add({
        id: newId,
        barcode: newBarcode,
        name: newName,
        category: newCategory,
        selling_price: sell,
        cost_price: cost,
        max_discount: parseFloat(newMaxDiscount) || 10,
        updated_at: new Date().toISOString()
      });

      for (const [bId, qty] of Object.entries(stocks)) {
        await db.inventories.add({ product_id: newId, branch_id: bId, stock: qty });
      }

      // API sync if online
      if (connectionState !== 'OFFLINE' && token) {
        const res = await fetch('http://localhost:5000/api/v1/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            barcode: newBarcode, name: newName, category: newCategory,
            selling_price: sell, cost_price: cost,
            max_discount: parseFloat(newMaxDiscount) || 10,
            initial_stocks: stocks
          })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Gagal simpan ke server');
        }
      }

      setAddSuccess('✅ Produk berhasil ditambahkan!');
      // Reset form
      setNewBarcode(''); setNewName(''); setNewCategory('Makanan');
      setNewSellPrice(''); setNewCostPrice(''); setNewMaxDiscount('10'); setNewStocks({});

      setTimeout(() => { setShowAddModal(false); setAddSuccess(''); }, 1200);
      await loadData();
    } catch (e: any) {
      setAddError(e.message || 'Gagal menambahkan produk');
    } finally {
      setAdding(false);
    }
  };

  // ── RENDER ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#08090d]">
        <div className="text-gray-400 text-sm animate-pulse">Memuat katalog barang...</div>
      </div>
    );
  }

  // Summary stats (owner view)
  const totalProducts = filteredProducts.length;
  const avgMarginPct = totalProducts > 0
    ? filteredProducts.reduce((s, p) => s + getGrossMarginPct(p), 0) / totalProducts
    : 0;
  const totalStockValue = filteredProducts.reduce((s, p) => s + p.cost_price * getTotalStock(p.id), 0);
  const totalSellValue = filteredProducts.reduce((s, p) => s + p.selling_price * getTotalStock(p.id), 0);

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#08090d] animate-fade-in relative">
      {/* Radial glow bg */}
      <div className="absolute top-0 left-[20%] w-[40vw] h-[30vw] rounded-full bg-indigo-500/4 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-[10%] w-[30vw] h-[30vw] rounded-full bg-emerald-500/4 blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Stok &amp; Katalog Barang</h1>
            <p className="text-xs text-gray-400 mt-1">
              {isOwner
                ? 'Kelola produk, harga beli/jual, dan pantau margin keuntungan seluruh toko.'
                : `Tinjau katalog produk dan persediaan di ${user?.branch_id ? BRANCHES_MAP[user.branch_id] : 'cabang Anda'}.`}
            </p>
          </div>
          {isOwner && (
            <button
              onClick={() => { setShowAddModal(true); setAddError(''); setAddSuccess(''); }}
              className="btn-primary px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Barang
            </button>
          )}
        </div>

        {/* Summary KPI Cards (Owner only) */}
        {isOwner && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total SKU', value: `${totalProducts}`, sub: 'produk aktif', color: 'text-indigo-400' },
              { label: 'Nilai Modal (HPP)', value: fmtRp(totalStockValue), sub: 'total stok × harga beli', color: 'text-amber-400' },
              { label: 'Nilai Jual Stok', value: fmtRp(totalSellValue), sub: 'total stok × harga jual', color: 'text-emerald-400' },
              { label: 'Margin Rata-rata', value: pct(avgMarginPct), sub: 'gross margin', color: 'text-pink-400' },
            ].map((kpi, i) => (
              <div key={i} className="glass-panel p-4 border-white/5 flex flex-col gap-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{kpi.label}</span>
                <span className={`text-xl font-extrabold ${kpi.color}`}>{kpi.value}</span>
                <span className="text-[10px] text-gray-500">{kpi.sub}</span>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari produk dengan nama atau barcode..."
              className="w-full pl-9 pr-4 py-2.5 bg-white/3 border border-white/8 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/40"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="bg-white/3 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500/40"
          >
            {FILTER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {isOwner && (
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="bg-white/3 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500/40"
            >
              <option value="ALL">Semua Toko (Matriks)</option>
              {Object.entries(BRANCHES_MAP).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
        </div>

        {/* Table */}
        <div className="glass-panel overflow-hidden border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-white/5 text-gray-400 text-xs font-semibold uppercase tracking-wider border-b border-white/5">
                  <th className="py-4 px-4">Barcode</th>
                  <th className="py-4 px-4">Nama Barang</th>
                  <th className="py-4 px-4">Kategori</th>
                  {isOwner && <th className="py-4 px-4 text-amber-400">Harga Beli</th>}
                  <th className="py-4 px-4 text-emerald-400">Harga Jual</th>
                  {isOwner && (
                    <>
                      <th className="py-4 px-4 text-pink-400">Margin</th>
                      <th className="py-4 px-4 text-pink-400">Margin%</th>
                    </>
                  )}
                  {/* Stock columns */}
                  {isOwner && selectedBranch === 'ALL'
                    ? Object.entries(BRANCHES_MAP).map(([bId, bName]) => (
                      <th key={bId} className="py-4 px-4 text-center text-[10px]">{bName.split(' ')[0]}</th>
                    ))
                    : <th className="py-4 px-4 text-center">Stok Toko</th>
                  }
                  {isOwner && <th className="py-4 px-4 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={20} className="py-12 text-center text-gray-500 text-sm">
                      Tidak ada produk ditemukan.
                    </td>
                  </tr>
                ) : filteredProducts.map(prod => {
                  const margin = getGrossMargin(prod);
                  const marginPct = getGrossMarginPct(prod);
                  const targetBranch = !isOwner ? (user?.branch_id || '') : (selectedBranch !== 'ALL' ? selectedBranch : '');

                  return (
                    <tr key={prod.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-500">{prod.barcode}</td>
                      <td className="py-3.5 px-4 font-bold text-white">{prod.name}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 text-xs rounded-full font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
                          {prod.category}
                        </span>
                      </td>
                      {isOwner && (
                        <td className="py-3.5 px-4 font-semibold text-amber-400">{fmtRp(prod.cost_price)}</td>
                      )}
                      <td className="py-3.5 px-4 font-semibold text-emerald-400">{fmtRp(prod.selling_price)}</td>
                      {isOwner && (
                        <>
                          <td className="py-3.5 px-4 font-bold text-pink-400">{fmtRp(margin)}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 text-xs rounded-full font-bold border ${
                              marginPct >= 20 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : marginPct >= 10 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                              {pct(marginPct)}
                            </span>
                          </td>
                        </>
                      )}
                      {/* Stock */}
                      {isOwner && selectedBranch === 'ALL'
                        ? Object.keys(BRANCHES_MAP).map(bId => {
                          const s = getStock(prod.id, bId);
                          return (
                            <td key={bId} className={`py-3.5 px-4 text-center font-bold ${s === 0 ? 'text-rose-400' : s < 10 ? 'text-amber-400' : 'text-gray-200'}`}>
                              {s}
                            </td>
                          );
                        })
                        : (
                          <td className={`py-3.5 px-4 text-center font-bold ${getStock(prod.id, targetBranch) === 0 ? 'text-rose-400' : getStock(prod.id, targetBranch) < 10 ? 'text-amber-400' : 'text-gray-200'}`}>
                            {getStock(prod.id, targetBranch)}
                          </td>
                        )
                      }
                      {isOwner && (
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleEditClick(prod)}
                            className="px-3 py-1.5 text-xs font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 rounded-lg hover:bg-indigo-500 hover:text-white transition-all"
                          >
                            Ubah
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── EDIT MODAL ─────────────────────────────────────────────── */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-lg overflow-hidden border border-white/10">
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/4">
              <div>
                <h3 className="text-base font-bold text-white">Ubah Produk</h3>
                <p className="text-xs text-gray-400 mt-0.5">{editingProduct.name}</p>
              </div>
              <button onClick={() => setEditingProduct(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Prices */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Harga Beli (HPP)</label>
                  <input
                    type="number" min="0"
                    value={editCostPrice || ''}
                    onChange={e => setEditCostPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#0a0b12] border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/40"
                    placeholder="Harga modal"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Harga Jual</label>
                  <input
                    type="number" min="0"
                    value={editSellPrice || ''}
                    onChange={e => setEditSellPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#0a0b12] border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/40"
                    placeholder="Harga jual"
                  />
                </div>
              </div>

              {/* Live margin preview */}
              {editSellPrice > 0 && (
                <div className="bg-white/3 rounded-xl px-4 py-3 flex justify-between items-center border border-white/5">
                  <div className="text-xs text-gray-400">Laba Kotor</div>
                  <div className={`font-extrabold text-sm ${editSellPrice >= editCostPrice ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fmtRp(editSellPrice - editCostPrice)}
                    <span className="text-xs font-normal ml-1 opacity-70">
                      ({editSellPrice > 0 ? pct(((editSellPrice - editCostPrice) / editSellPrice) * 100) : '0%'})
                    </span>
                  </div>
                </div>
              )}

              {/* Category */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Kategori</label>
                <select
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                  className="w-full bg-[#0a0b12] border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/40"
                >
                  {CATEGORY_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Stock per branch */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Stok Per Toko</label>
                <div className="space-y-2">
                  {Object.entries(BRANCHES_MAP).map(([bId, bName]) => (
                    <div key={bId} className="flex items-center gap-3 bg-white/3 rounded-xl px-4 py-2.5 border border-white/5">
                      <span className="flex-1 text-xs text-gray-300 font-medium">{bName}</span>
                      <input
                        type="number" min="0"
                        value={editStocks[bId] ?? 0}
                        onChange={e => setEditStocks(prev => ({ ...prev, [bId]: parseInt(e.target.value) || 0 }))}
                        className="w-20 bg-[#0a0b12] border border-white/10 rounded-lg px-2 py-1.5 text-center text-white text-sm focus:outline-none focus:border-indigo-500/40"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {editError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold">
                  {editError}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-white/5 flex gap-3 justify-end">
              <button onClick={() => setEditingProduct(null)} className="btn-secondary py-2 px-5 text-sm rounded-xl" disabled={saving}>Batal</button>
              <button onClick={handleSaveEdit} className="btn-primary py-2 px-6 text-sm rounded-xl" disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD PRODUCT MODAL ──────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-lg overflow-hidden border border-white/10">
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/4">
              <h3 className="text-base font-bold text-white">Tambah Barang Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <form onSubmit={handleAddProduct} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Barcode & Name */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Barcode / Kode SKU</label>
                  <input
                    type="text" value={newBarcode} onChange={e => setNewBarcode(e.target.value)}
                    className="w-full bg-[#0a0b12] border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/40 font-mono"
                    placeholder="e.g. 8999123456789" required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Kategori</label>
                  <select
                    value={newCategory} onChange={e => setNewCategory(e.target.value)}
                    className="w-full bg-[#0a0b12] border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/40"
                  >
                    {CATEGORY_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nama Barang</label>
                <input
                  type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  className="w-full bg-[#0a0b12] border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/40"
                  placeholder="Nama lengkap produk" required
                />
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Harga Beli (HPP)</label>
                  <input
                    type="number" min="0" value={newCostPrice} onChange={e => setNewCostPrice(e.target.value)}
                    className="w-full bg-[#0a0b12] border border-amber-500/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                    placeholder="Harga modal" required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Harga Jual</label>
                  <input
                    type="number" min="0" value={newSellPrice} onChange={e => setNewSellPrice(e.target.value)}
                    className="w-full bg-[#0a0b12] border border-emerald-500/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                    placeholder="Harga jual ke pelanggan" required
                  />
                </div>
              </div>

              {/* Live margin */}
              {newSellPrice && newCostPrice && (
                <div className="bg-white/3 rounded-xl px-4 py-3 flex justify-between items-center border border-white/5">
                  <span className="text-xs text-gray-400">Preview Margin Laba</span>
                  <div className={`font-extrabold text-sm ${parseFloat(newSellPrice) >= parseFloat(newCostPrice) ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fmtRp(parseFloat(newSellPrice) - parseFloat(newCostPrice))}
                    <span className="text-xs font-normal ml-1 opacity-70">
                      ({parseFloat(newSellPrice) > 0 ? pct(((parseFloat(newSellPrice) - parseFloat(newCostPrice)) / parseFloat(newSellPrice)) * 100) : '0%'})
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Maks. Diskon (%)</label>
                <input
                  type="number" min="0" max="100" value={newMaxDiscount} onChange={e => setNewMaxDiscount(e.target.value)}
                  className="w-full bg-[#0a0b12] border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/40"
                  placeholder="10"
                />
              </div>

              {/* Initial stocks per branch */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Stok Awal Per Toko</label>
                <div className="space-y-2">
                  {Object.entries(BRANCHES_MAP).map(([bId, bName]) => (
                    <div key={bId} className="flex items-center gap-3 bg-white/3 rounded-xl px-4 py-2.5 border border-white/5">
                      <span className="flex-1 text-xs text-gray-300 font-medium">{bName}</span>
                      <input
                        type="number" min="0"
                        value={newStocks[bId] || ''}
                        onChange={e => setNewStocks(prev => ({ ...prev, [bId]: e.target.value }))}
                        className="w-20 bg-[#0a0b12] border border-white/10 rounded-lg px-2 py-1.5 text-center text-white text-sm focus:outline-none focus:border-indigo-500/40"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {addError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold">
                  ⚠️ {addError}
                </div>
              )}
              {addSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold">
                  {addSuccess}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary py-2 px-5 text-sm rounded-xl" disabled={adding}>Batal</button>
                <button type="submit" className="btn-primary py-2 px-6 text-sm rounded-xl" disabled={adding}>
                  {adding ? 'Menyimpan...' : '+ Tambah Barang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
