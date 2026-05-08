// Konfigurasi API Google Sheets
const CONFIG = {
    // Ganti dengan URL Web App Google Apps Script Anda
    // Cara membuat: Deploy > New deployment > Web app > Execute as "Me" > Who has access "Anyone"
    WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbwkC8rnCnUjwgWPPj7WE3p6-3Fl36bElA_Tymjp2yTyvg09JRGtP4OyAk86k1w71-YnjA/exec',
    
    // Nama sheet yang digunakan
    SHEET_NAMES: {
        MASTER_BARANG: 'MASTER BARANG',
        PELANGGAN: 'PELANGGAN',
        SUPPLIER: 'SUPPLIER',
        TRANSAKSI_PENJUALAN: 'TRANSAKSI PENJUALAN',
        PEMBELIAN_RESTOCK: 'PEMBELIAN / RESTOCK'
    },
    
    // Konfigurasi aplikasi
    APP_NAME: 'POS Toko Kelontong',
    CURRENCY: 'Rp',
    TAX_RATE: 0,
    DISCOUNT_RATE: 0
};

// Global variables
let cart = [];
let products = [];
let customers = [];
let suppliers = [];
let restocks = [];
let transactions = [];
