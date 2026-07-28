import React, { useState, useEffect, useRef } from 'react';
import { useApp, type CartItem } from '../context/AppContext';
import { db, type Product } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';

export const POSMain: React.FC = () => {
  const {
    user,
    connectionState,
    activeShift,
    cart,
    pendingMutations,
    isSyncing,
    openShift,
    closeShift,
    addToCart,
    updateCartItemQty,
    applyCartItemDiscount,
    voidCartItem,
    checkout,
    clearCart,
    syncData,
    logout
  } = useApp();

  // --- LOCAL STATES ---
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'DEBIT' | 'RECEIVABLE'>('CASH');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [checkoutSuccess, setCheckoutSuccess] = useState<boolean>(false);
  const [lastTxId, setLastTxId] = useState<string>('');
  // Snapshot of cart + totals saved before cart is cleared after checkout
  const [lastReceiptSnapshot, setLastReceiptSnapshot] = useState<{
    items: typeof cart;
    subtotal: number;
    discountSum: number;
    grandTotal: number;
    paymentMethod: string;
    cashReceived: number;
    cashChange: number;
  } | null>(null);

  // Shift Gate
  const [openingCashInput, setOpeningCashInput] = useState<string>('');
  
  // Close Shift Modals
  const [showCloseShiftModal, setShowCloseShiftModal] = useState<boolean>(false);
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [shiftReport, setShiftReport] = useState<{ expected: number; variance: number; actual: number } | null>(null);

  // Security Override Modals
  const [showDiscountOverrideModal, setShowDiscountOverrideModal] = useState<boolean>(false);
  const [overrideProductId, setOverrideProductId] = useState<string>('');
  const [pendingDiscountValue, setPendingDiscountValue] = useState<number>(0);
  const [discountPin, setDiscountPin] = useState<string>('');
  const [discountError, setDiscountError] = useState<string>('');

  const [showVoidModal, setShowVoidModal] = useState<boolean>(false);
  const [voidProductId, setVoidProductId] = useState<string>('');
  const [voidReason, setVoidReason] = useState<string>('');
  const [voidPin, setVoidPin] = useState<string>('');
  const [voidError, setVoidError] = useState<string>('');

  // Discount mode per item: '%' or 'Rp'
  const [discountModeMap, setDiscountModeMap] = useState<Record<string, '%' | 'Rp'>>({});
  // Raw discount input string per item (to allow free typing)
  const [discountInputMap, setDiscountInputMap] = useState<Record<string, string>>({});

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // --- DB QUERIES ---
  // Live query for products
  const products = useLiveQuery(() => db.products.toArray()) || [];
  // Live query for branch inventories
  const inventories = useLiveQuery(() => 
    user?.branch_id ? db.inventories.where({ branch_id: user.branch_id }).toArray() : Promise.resolve([])
  ) || [];

  // Focus barcode scanner input ONLY when shift opens (not on every cart change)
  useEffect(() => {
    if (activeShift && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [activeShift]);

  // Return focus to scanner ONLY if the user is not currently typing in another input
  const keepFocus = () => {
    const active = document.activeElement;
    const isTypingElsewhere = active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.tagName === 'SELECT'
    );
    if (!isTypingElsewhere && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  // Get stock for product
  const getProductStock = (productId: string) => {
    const inv = inventories.find(i => i.product_id === productId);
    return inv ? inv.stock : 0;
  };

  // Categories list
  const categories = ['Semua', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery);
    const matchesCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // --- ACTIONS ---

  // Handle Barcode Scan Enter
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput) return;

    const matched = products.find(p => p.barcode === barcodeInput);
    if (matched) {
      const stock = getProductStock(matched.id);
      if (stock <= 0) {
        alert(`Stok produk ${matched.name} kosong!`);
      } else {
        addToCart(matched);
      }
    } else {
      alert(`Produk dengan barcode ${barcodeInput} tidak ditemukan.`);
    }
    setBarcodeInput('');
  };

  // Open Shift
  const handleOpenShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseFloat(openingCashInput);
    if (isNaN(cash) || cash < 0) {
      alert('Masukkan jumlah modal awal yang valid.');
      return;
    }
    openShift(cash);
  };

  // Close Shift
  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const actual = parseFloat(actualCashInput);
    if (isNaN(actual) || actual < 0) {
      alert('Masukkan hitung fisik uang di laci.');
      return;
    }

    const rep = await closeShift(actual);
    setShiftReport({
      expected: rep.expected,
      variance: rep.variance,
      actual
    });
  };

  // Apply Discount Change
  const handleDiscountChange = (productId: string, percent: number) => {
    if (percent < 0 || percent > 100) return;
    const res = applyCartItemDiscount(productId, percent);
    if (!res.authorized) {
      // Trigger Override
      setOverrideProductId(productId);
      setPendingDiscountValue(percent);
      setShowDiscountOverrideModal(true);
      setDiscountPin('');
      setDiscountError('');
    }
  };

  // Toggle discount mode between % and Rp for a specific item
  const handleDiscountModeToggle = (productId: string) => {
    const currentMode = discountModeMap[productId] || '%';
    const newMode = currentMode === '%' ? 'Rp' : '%';
    setDiscountModeMap(prev => ({ ...prev, [productId]: newMode }));
    setDiscountInputMap(prev => ({ ...prev, [productId]: '' }));
  };

  // Handle discount input change with mode awareness
  const handleDiscountInputChange = (productId: string, rawValue: string, price: number) => {
    setDiscountInputMap(prev => ({ ...prev, [productId]: rawValue }));
    const numValue = parseFloat(rawValue) || 0;
    const mode = discountModeMap[productId] || '%';

    let percentValue: number;
    if (mode === 'Rp') {
      // Convert nominal amount to percentage, capped at 100%
      percentValue = price > 0 ? Math.min(100, (numValue / price) * 100) : 0;
    } else {
      percentValue = Math.min(100, Math.max(0, numValue));
    }
    handleDiscountChange(productId, percentValue);
  };


  const submitDiscountOverride = () => {
    // Attempt discount bypass with pin
    const item = cart.find(i => i.product.id === overrideProductId);

    if (!item) return;

    // We verify master pin (simulated locally)
    if (discountPin === '123456') { // Mock PIN verification
      applyCartItemDiscount(overrideProductId, pendingDiscountValue, true);
      setShowDiscountOverrideModal(false);
    } else {
      setDiscountError('PIN Master Admin tidak valid.');
    }
  };

  // Void Cart Item
  const triggerVoid = (productId: string) => {
    setVoidProductId(productId);
    setShowVoidModal(true);
    setVoidPin('');
    setVoidReason('');
    setVoidError('');
  };

  const submitVoid = async () => {
    if (!voidReason) {
      setVoidError('Alasan pembatalan (void) wajib diisi.');
      return;
    }
    const res = await voidCartItem(voidProductId, voidReason, voidPin);
    if (res.success) {
      setShowVoidModal(false);
    } else {
      setVoidError(res.error || 'Otorisasi gagal');
    }
  };

  // Checkout Pay
  const handleCheckoutSubmit = async () => {
    if (paymentMethod === 'CASH' && cashReceived < grandTotal) {
      alert('Uang tunai yang diterima kurang.');
      return;
    }

    try {
      // Snapshot BEFORE checkout clears the cart
      setLastReceiptSnapshot({
        items: [...cart],
        subtotal,
        discountSum,
        grandTotal,
        paymentMethod,
        cashReceived,
        cashChange: Math.max(0, cashReceived - grandTotal)
      });

      const sale = await checkout(paymentMethod, cashReceived);
      setLastTxId(sale.id);
      setCheckoutSuccess(true);
      setCashReceived(0);
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.product.selling_price * item.quantity), 0);
  const discountSum = cart.reduce((acc, item) => {
    return acc + ((item.product.selling_price * item.discount_percent / 100) * item.quantity);
  }, 0);
  const grandTotal = subtotal - discountSum;

  // --- 1. SHIFT GATE VIEW (IF SHIFT NOT OPEN) ---
  if (!activeShift) {
    if (shiftReport) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0b10]">
          <div className="glass-panel w-full max-w-md p-8 text-center border-white/10">
            <div className="w-16 h-16 rounded-full bg-emerald/10 text-emerald flex-center mx-auto mb-6 border border-emerald/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Shift Berhasil Ditutup</h2>
            <p className="text-gray-400 text-sm mb-6">Laporan rekonsiliasi kas laci telah disimpan permanen.</p>
            
            <div className="space-y-4 text-left bg-black/40 p-4 rounded-xl mb-6 border border-white/5">
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Expected Cash (Sistem):</span>
                <span className="text-white font-semibold">Rp {shiftReport.expected.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Actual Cash (Fisik Laci):</span>
                <span className="text-white font-semibold">Rp {shiftReport.actual.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-3">
                <span className="text-gray-400 text-sm">Selisih Kas:</span>
                <span className={`font-bold text-lg ${shiftReport.variance < 0 ? 'text-rose-500' : 'text-emerald'}`}>
                  Rp {shiftReport.variance.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {shiftReport.variance < 0 && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg text-left mb-6 font-semibold">
                Peringatan: Selisih minus tercatat pada log fraud. Layanan kasir akan dinonaktifkan sementara hingga persetujuan Master Admin.
              </div>
            )}

            <button onClick={() => { setShiftReport(null); logout(); }} className="btn-primary w-full py-3 rounded-xl">
              Kembali ke Login
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0b10]">
        <div className="glass-panel w-full max-w-md p-8 border-white/10 animate-fade-in">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold text-white">Mulai Shift Kasir</h2>
            <p className="text-gray-400 text-sm mt-1">Harap input kas awal untuk membuka drawer kasir.</p>
          </div>

          <form onSubmit={handleOpenShiftSubmit} className="space-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Nominal Modal Awal (Rp)</label>
              <input
                type="number"
                value={openingCashInput}
                onChange={e => setOpeningCashInput(e.target.value)}
                placeholder="Contoh: 200000"
                className="w-full py-3 px-4 text-center text-xl font-bold text-indigo-400"
                autoFocus
              />
            </div>

            <button type="submit" className="btn-primary w-full py-3.5 rounded-xl text-base shadow-lg">
              Buka Shift POS
            </button>

            <button type="button" onClick={logout} className="btn-secondary w-full py-3 rounded-xl">
              Keluar Akun
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- 2. POS MAIN WORKSPACE VIEW ---
  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#08090d] relative" onClick={keepFocus}>
      {/* 2.1 POS HEADER */}
      <header className="glass-panel rounded-none border-t-0 border-x-0 py-4 px-6 flex items-center justify-between z-10 bg-black/20">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white font-black shadow-md border border-white/10">
            L
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white leading-none">
              Luxe<span className="text-indigo-400">POS</span>
            </h1>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">
              {user?.role} — Cabang {user?.branch_id?.substring(0, 8)}
            </p>
          </div>
        </div>

        {/* Sync Controls & Heartbeat */}
        <div className="flex items-center gap-4">
          {/* Heartbeat connection badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <div className={`w-2 h-2 rounded-full pulse-glow-indicator ${connectionState === 'ONLINE' ? 'bg-emerald text-emerald-400' : 'bg-amber text-amber-400'}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">
              {connectionState === 'ONLINE' ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Sync mutations tracker */}
          {pendingMutations > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold animate-pulse">
              <span>{pendingMutations} Mutasi Lokal</span>
            </div>
          )}

          <button
            onClick={syncData}
            disabled={isSyncing || connectionState === 'OFFLINE'}
            className="btn-secondary py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18" />
            </svg>
            <span className="font-bold uppercase tracking-wider text-[10px]">
              {isSyncing ? 'Sinkron...' : 'Sinkron'}
            </span>
          </button>

          <button onClick={() => setShowCloseShiftModal(true)} className="btn-danger py-2 px-3.5 rounded-xl text-xs font-bold uppercase tracking-wider">
            Tutup Shift
          </button>
        </div>
      </header>

      {/* 2.2 CONTENT BODY */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: BARCODE SCANNER & PRODUCT CATALOG */}
        <div className="w-3/5 p-6 flex flex-col gap-6 overflow-hidden">
          {/* Scanner Input (Focused Barcode console) */}
          <div className="glass-panel p-4 flex items-center gap-4 border-indigo-500/20 bg-indigo-500/5 shadow-[0_0_15px_rgba(99,102,241,0.03)]">
            <div className="text-indigo-400 relative">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute -top-0.5 -right-0.5 animate-ping" />
              <div className="w-1.5 h-1.5 rounded-full bg-rose-600 absolute -top-0.5 -right-0.5" />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h.01M16 20h2M4 4h2M4 16h2M4 12h2M4 8h2m12 0h2m-2 4h2m-2 4h2M12 20h.01M16 12h.01M16 8h.01M12 8h.01M20 16h.01M20 4h.01M16 4h.01M12 4h.01" />
              </svg>
            </div>
            <form onSubmit={handleBarcodeSubmit} className="flex-1">
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                placeholder="Scan Barcode Produk Kasir..."
                className="w-full bg-transparent border-none text-white text-base font-semibold placeholder-gray-500 focus:ring-0 focus:box-shadow-none p-0"
              />
            </form>
            <span className="text-[9px] text-indigo-400 font-bold uppercase border border-indigo-500/30 px-2 py-0.5 rounded-lg bg-indigo-500/10 tracking-wider">
              Ready Scanner
            </span>
          </div>

          {/* Search and Category Filter */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari produk dengan nama..."
                className="w-full pl-10"
              />
              <div className="absolute left-3.5 top-3.5 text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-48 bg-[#0f111a] border-white/5 font-semibold text-xs"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Catalog grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-4">
              {filteredProducts.map(p => {
                const stock = getProductStock(p.id);
                const isCriticalStock = stock <= 5;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (stock <= 0) alert('Stok produk kosong!');
                      else addToCart(p);
                    }}
                    className="glass-panel p-4 text-left border-white/5 glass-panel-hover flex flex-col h-32 justify-between"
                  >
                    <div>
                      <span className="text-[10px] text-indigo-400 font-bold tracking-wider uppercase bg-indigo-500/5 px-2 py-0.5 rounded-md border border-indigo-500/10">
                        {p.category}
                      </span>
                      <h3 className="text-sm font-bold text-white truncate w-full mt-2.5">{p.name}</h3>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">{p.barcode}</p>
                    </div>
                    <div className="flex justify-between items-end w-full">
                      <span className="text-base font-extrabold text-emerald">Rp {p.selling_price.toLocaleString('id-ID')}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold border ${
                        isCriticalStock 
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                          : 'bg-white/5 text-gray-400 border-transparent'
                      }`}>
                        Stok: {stock}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SHOPPING CART */}
        <div className="w-2/5 border-l border-white/10 flex flex-col overflow-hidden bg-black/15">
          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/3">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Keranjang Kasir
            </h2>
            <button onClick={clearCart} className="text-xs text-rose-400 font-bold uppercase tracking-wider hover:text-rose-300">
              Kosongkan
            </button>
          </div>

          {/* Cart items list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex-center flex-col text-gray-500 py-12 px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-white/3 flex-center text-gray-600 mb-4 border border-white/5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-gray-400">Keranjang Masih Kosong</span>
                <p className="text-[11px] text-gray-500 max-w-[200px] mt-1 leading-relaxed">
                  Gunakan barcode scanner atau ketik nama barang untuk menambahkan item.
                </p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.product.id} className="glass-panel p-3 border-white/5 flex flex-col gap-3.5">
                  <div className="flex justify-between items-start">
                    <div className="max-w-[80%]">
                      <h4 className="text-xs font-bold text-white truncate leading-tight">{item.product.name}</h4>
                      <span className="text-[10px] text-gray-500 font-mono mt-1 block">
                        Rp {item.product.selling_price.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <button
                      onClick={() => triggerVoid(item.product.id)}
                      className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all p-0"
                      title="Void Item"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex justify-between items-center mt-1">
                    {/* Qty controller */}
                    <div className="flex items-center border border-white/5 rounded-xl overflow-hidden bg-black/35 p-0.5">
                      <button
                        onClick={() => updateCartItemQty(item.product.id, item.quantity - 1)}
                        className="w-6 h-6 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white flex items-center justify-center font-bold text-sm"
                      >
                        -
                      </button>
                      <span className="px-2 font-bold text-xs text-white min-w-[24px] text-center">{item.quantity}</span>
                      <button
                        onClick={() => {
                          const stock = getProductStock(item.product.id);
                          if (item.quantity >= stock) alert('Stok produk habis!');
                          else updateCartItemQty(item.product.id, item.quantity + 1);
                        }}
                        className="w-6 h-6 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white flex items-center justify-center font-bold text-sm"
                      >
                        +
                      </button>
                    </div>

                    {/* Discount Input with % / Rp toggle */}
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {/* Mode Toggle Button */}
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleDiscountModeToggle(item.product.id); }}
                        className="flex items-center h-6 rounded-lg overflow-hidden border border-white/10 text-[9px] font-extrabold tracking-wider select-none"
                        title="Klik untuk ganti mode diskon"
                      >
                        <span className={`px-1.5 py-1 transition-colors ${(discountModeMap[item.product.id] || '%') === '%' ? 'bg-indigo-500 text-white' : 'bg-transparent text-gray-500'}`}>
                          %
                        </span>
                        <span className={`px-1.5 py-1 transition-colors ${(discountModeMap[item.product.id] || '%') === 'Rp' ? 'bg-indigo-500 text-white' : 'bg-transparent text-gray-500'}`}>
                          Rp
                        </span>
                      </button>
                      {/* Value Input */}
                      <input
                        type="number"
                        min="0"
                        max={(discountModeMap[item.product.id] || '%') === '%' ? 100 : item.product.selling_price}
                        value={discountInputMap[item.product.id] ?? (item.discount_percent > 0 ? item.discount_percent : '')}
                        onChange={e => handleDiscountInputChange(item.product.id, e.target.value, item.product.selling_price)}
                        onClick={e => e.stopPropagation()}
                        onFocus={e => e.stopPropagation()}
                        placeholder={(discountModeMap[item.product.id] || '%') === 'Rp' ? '0' : '0'}
                        className={`py-1 px-1.5 text-center text-xs bg-black/35 rounded-lg border-white/5 ${(discountModeMap[item.product.id] || '%') === 'Rp' ? 'w-20' : 'w-12'}`}
                      />
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-xs font-bold text-indigo-300">
                        Rp {((item.product.selling_price * (1 - item.discount_percent / 100)) * item.quantity).toLocaleString('id-ID')}
                      </span>
                      {item.discount_percent > 0 && (
                        <span className="text-[9px] text-rose-400 font-semibold">
                          -{(item.discount_percent).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 2.3 PAYMENT SUMMARY & ACTIONS */}
          <div className="p-4 border-t border-white/10 bg-white/3 flex flex-col gap-4">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal:</span>
                <span className="font-semibold text-gray-200">Rp {subtotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Total Potongan (Diskon):</span>
                <span className="font-semibold text-rose-400">-Rp {discountSum.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-white border-t border-white/5 pt-2.5">
                <span>Grand Total:</span>
                <span className="text-gradient-emerald text-lg">Rp {grandTotal.toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-4 gap-2">
              {(['CASH', 'QRIS', 'DEBIT', 'RECEIVABLE'] as const).map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2 px-1 rounded-xl text-[10px] font-bold tracking-wider uppercase ${
                    paymentMethod === method 
                      ? 'btn-primary border-indigo-500/20 shadow-md shadow-indigo-500/10' 
                      : 'btn-secondary border-white/5 text-gray-400'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            {/* Cash Received Handler if CASH selected */}
            {paymentMethod === 'CASH' && (
              <div className="flex gap-3 items-end bg-black/20 p-3 rounded-xl border border-white/5 animate-fade-in">
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Uang Diterima (Rp)</label>
                  <input
                    type="number"
                    value={cashReceived || ''}
                    onChange={e => setCashReceived(parseFloat(e.target.value) || 0)}
                    onClick={e => e.stopPropagation()}
                    onFocus={e => e.stopPropagation()}
                    placeholder="Contoh: 100000"
                    className="w-full py-2 px-3 text-sm bg-black/40 border-white/5 text-indigo-400 font-extrabold"
                    autoComplete="off"
                  />
                </div>
                <div className="w-1/3 flex flex-col text-right">
                  <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Kembalian</span>
                  <span className="text-sm font-extrabold text-white pt-1">
                    Rp {Math.max(0, cashReceived - grandTotal).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handleCheckoutSubmit}
              disabled={cart.length === 0}
              className="btn-success w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider"
            >
              Bayar Transaksi
            </button>
          </div>
        </div>
      </div>

      {/* --- VOID PROTECTION SECURITY MODAL --- */}
      {showVoidModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-sm p-6 border-rose-500/20 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base font-extrabold text-rose-400">Proteksi Void Keamanan</h3>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed mb-4">
              Penghapusan item memerlukan otorisasi PIN Master Admin (PIN default: <span className="font-mono text-white">123456</span>).
            </p>

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">PIN Master Admin</label>
                <input
                  type="password"
                  value={voidPin}
                  onChange={e => setVoidPin(e.target.value)}
                  placeholder="••••••"
                  className="w-full text-center tracking-widest text-lg font-bold bg-black/40 border-white/5 text-rose-400"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Alasan Void</label>
                <input
                  type="text"
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                  placeholder="Contoh: Salah Scan / Salah Input"
                  className="w-full text-xs"
                />
              </div>

              {voidError && <p className="text-rose-400 text-xs font-semibold bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg">{voidError}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowVoidModal(false)} className="btn-secondary flex-1 py-2.5 text-xs font-bold uppercase tracking-wider">
                  Batal
                </button>
                <button onClick={submitVoid} className="btn-danger flex-1 py-2.5 text-xs font-bold uppercase tracking-wider">
                  Otorisasi Void
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- DISCOUNT OVERRIDE SECURITY MODAL --- */}
      {showDiscountOverrideModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-sm p-6 border-indigo-500/20 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base font-extrabold text-indigo-400">Batas Diskon Terlampaui</h3>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed mb-4">
              Nominal diskon manual melebihi batas wajar produk. Otorisasi PIN Master Admin diperlukan.
            </p>

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">PIN Master Admin</label>
                <input
                  type="password"
                  value={discountPin}
                  onChange={e => setDiscountPin(e.target.value)}
                  placeholder="••••••"
                  className="w-full text-center tracking-widest text-lg font-bold bg-black/40 border-white/5 text-indigo-400"
                />
              </div>

              {discountError && <p className="text-rose-400 text-xs font-semibold bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg">{discountError}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowDiscountOverrideModal(false);
                    applyCartItemDiscount(overrideProductId, 0);
                  }}
                  className="btn-secondary flex-1 py-2.5 text-xs font-bold uppercase tracking-wider"
                >
                  Batal
                </button>
                <button onClick={submitDiscountOverride} className="btn-primary flex-1 py-2.5 text-xs font-bold uppercase tracking-wider">
                  Otorisasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- CLOSE SHIFT RECONCILIATION MODAL --- */}
      {showCloseShiftModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-sm p-6 border-white/10 shadow-2xl">
            <h3 className="text-base font-extrabold text-white mb-2">Tutup Shift & Kas Drawer</h3>
            <p className="text-gray-400 text-xs leading-relaxed mb-4">
              Hitung fisik uang tunai di laci cash drawer secara teliti. Deviasi minus akan terekam permanen.
            </p>

            <form onSubmit={handleCloseShiftSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Uang Fisik Di Laci (Rp)</label>
                <input
                  type="number"
                  value={actualCashInput}
                  onChange={e => setActualCashInput(e.target.value)}
                  placeholder="Masukkan jumlah fisik laci"
                  className="w-full text-center text-lg font-bold text-emerald bg-black/40 border-white/5"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCloseShiftModal(false)} className="btn-secondary flex-1 py-2.5 text-xs font-bold uppercase tracking-wider">
                  Kembali
                </button>
                <button type="submit" className="btn-danger flex-1 py-2.5 text-xs font-bold uppercase tracking-wider">
                  Selesaikan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CHECKOUT SUCCESS PRINT DIALOG --- */}
      {checkoutSuccess && lastReceiptSnapshot && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-md border-emerald/20 shadow-2xl overflow-hidden">
            {/* Success Header */}
            <div className="p-6 flex flex-col items-center text-center border-b border-white/5">
              <div className="w-14 h-14 rounded-full bg-emerald/10 text-emerald flex items-center justify-center mb-4 border border-emerald/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-extrabold text-white">Transaksi Berhasil</h3>
              <p className="text-gray-400 text-xs mt-1">Kembalian dicairkan. Struk siap cetak.</p>
            </div>

            {/* Receipt Body */}
            <div className="max-h-[55vh] overflow-y-auto">
              <div className="bg-black/40 m-4 rounded-xl border border-white/5 font-mono text-xs text-gray-300 overflow-hidden">
                {/* Store header */}
                <div className="bg-white/5 px-4 py-3 text-center border-b border-dashed border-white/10">
                  <div className="font-extrabold text-white text-sm tracking-widest">LuxePOS RECEIPT</div>
                  <div className="text-gray-500 text-[10px] mt-0.5">{new Date().toLocaleString('id-ID')}</div>
                </div>

                <div className="px-4 py-3 space-y-1.5 border-b border-dashed border-white/10">
                  <div className="flex justify-between">
                    <span className="text-gray-500">ID Tx:</span>
                    <span className="text-gray-300 truncate ml-2">{lastTxId.substring(0, 20)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Kasir:</span>
                    <span className="text-gray-300">{user?.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Metode:</span>
                    <span className="text-gray-300">{lastReceiptSnapshot.paymentMethod}</span>
                  </div>
                </div>

                {/* Item list */}
                <div className="px-4 py-3 space-y-2 border-b border-dashed border-white/10">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Daftar Barang</div>
                  {lastReceiptSnapshot.items.map((item, i) => {
                    const lineTotal = item.product.selling_price * item.quantity;
                    const discAmt = (item.product.selling_price * item.discount_percent / 100) * item.quantity;
                    const afterDisc = lineTotal - discAmt;
                    return (
                      <div key={i} className="space-y-0.5">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-white font-semibold leading-tight flex-1">{item.product.name}</span>
                          <span className="text-emerald-400 font-bold whitespace-nowrap">Rp {afterDisc.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between text-gray-500 text-[10px]">
                          <span>{item.quantity} × Rp {item.product.selling_price.toLocaleString('id-ID')}</span>
                          {item.discount_percent > 0 && (
                            <span className="text-rose-400">Disc {item.discount_percent.toFixed(1)}%</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                <div className="px-4 py-3 space-y-1.5">
                  <div className="flex justify-between text-gray-400">
                    <span>Subtotal:</span>
                    <span>Rp {lastReceiptSnapshot.subtotal.toLocaleString('id-ID')}</span>
                  </div>
                  {lastReceiptSnapshot.discountSum > 0 && (
                    <div className="flex justify-between text-rose-400">
                      <span>Total Diskon:</span>
                      <span>-Rp {lastReceiptSnapshot.discountSum.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-white text-sm border-t border-dashed border-white/10 pt-2 mt-1">
                    <span>TOTAL BAYAR:</span>
                    <span className="text-emerald-400">Rp {lastReceiptSnapshot.grandTotal.toLocaleString('id-ID')}</span>
                  </div>
                  {lastReceiptSnapshot.paymentMethod === 'CASH' && (
                    <>
                      <div className="flex justify-between text-gray-400">
                        <span>Uang Diterima:</span>
                        <span>Rp {lastReceiptSnapshot.cashReceived.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between font-bold text-indigo-400">
                        <span>Kembalian:</span>
                        <span>Rp {lastReceiptSnapshot.cashChange.toLocaleString('id-ID')}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="text-center text-gray-600 text-[10px] py-3 border-t border-dashed border-white/10">
                  Terima kasih atas kunjungan Anda
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-4 border-t border-white/5">
              <button
                onClick={() => {
                  setCheckoutSuccess(false);
                  setLastReceiptSnapshot(null);
                  setTimeout(() => keepFocus(), 200);
                }}
                className="btn-secondary flex-1 py-3 text-xs font-bold uppercase tracking-wider"
              >
                Transaksi Baru
              </button>
              <button
                onClick={() => {
                  window.print();
                  setCheckoutSuccess(false);
                  setLastReceiptSnapshot(null);
                  setTimeout(() => keepFocus(), 200);
                }}
                className="btn-primary flex-1 py-3 text-xs font-bold uppercase tracking-wider"
              >
                Cetak Struk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
