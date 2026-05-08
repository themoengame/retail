// Konfigurasi API Google Sheets
const CONFIG = {
    // Web App URL Anda
    WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbwkC8rnCnUjwgWPPj7WE3p6-3Fl36bElA_Tymjp2yTyvg09JRGtP4OyAk86k1w71-YnjA/exec',
    
    // Nama sheet yang digunakan
    SHEET_NAMES: {
        MASTER_BARANG: 'MASTER BARANG',
        PELANGGAN: 'PELANGGAN',
        SUPPLIER: 'SUPPLIER',
        TRANSAKSI_PENJUALAN: 'TRANSAKSI PENJUALAN',
        PEMBELIAN_RESTOCK: 'PEMBELIAN / RESTOCK',
        PENGELUARAN_OPERASIONAL: 'PENGELUARAN OPERASIONAL'
    },
    
    // Konfigurasi aplikasi
    APP_NAME: 'POS Toko Kelontong',
    CURRENCY: 'Rp'
};

// Cache untuk data
let dataCache = {
    products: [],
    customers: [],
    suppliers: [],
    transactions: [],
    restocks: []
};
