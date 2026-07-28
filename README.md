# LuxePOS — Aplikasi Kasir Multi-Cabang

Sistem Point-of-Sale (POS) modern dengan dukungan multi-cabang, mode offline-first, dan dashboard manajemen owner.

## Fitur Utama
- 🛒 **POS Kasir** — Transaksi cepat dengan barcode scanner, diskon (% atau Rp), dan struk cetak
- 📦 **Stok Barang** — Kelola produk, harga beli/jual, margin keuntungan, dan stok per cabang
- 🔄 **Transfer Stok** — Transfer barang antar cabang dengan otorisasi 2 arah
- 📋 **Berita Acara** — Klaim stok rusak/hilang/expired dengan bukti foto
- 👥 **Manajemen Akun** — Buat akun kasir/owner langsung dari dasbor
- 📊 **Dashboard Owner** — Laporan konsolidasi keuangan, anti-fraud audit, sesi kasir aktif
- 🌐 **Offline-First** — Tetap beroperasi tanpa internet, sinkron otomatis saat online

## Stack Teknologi
- **Frontend**: React + TypeScript + Vite + Dexie (IndexedDB offline)
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (production) / JSON file (development)

## Cara Menjalankan Lokal

### Backend
```bash
cd backend
npm install
cp .env.example .env   # isi variabel yang dibutuhkan
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Akses di: http://localhost:5173

### Akun Default (Development)
| Username | Password | Role |
|---|---|---|
| owner_admin | password123 | Master Admin |
| kasir_senayan | password123 | Kasir |

## Deploy
- **Frontend**: Vercel / Netlify
- **Backend**: Railway / Render
- **Database**: Railway PostgreSQL / Supabase
