import { CONFIG } from './config.js';

const $ = (sel) => document.querySelector(sel);
const formatRupiah = (num) => new Intl.NumberFormat(CONFIG.CURRENCY_LOCALE, {
  style: 'currency', currency: CONFIG.CURRENCY_CODE, minimumFractionDigits: 0
}).format(num || 0);

async function fetchData() {
  // Cache-buster agar data selalu fresh
  const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?v=${Date.now()}`);
  if (!res.ok) throw new Error(`Gagal terhubung (${res.status})`);
  return await res.json();
}

function calculateStats(data) {
  const master = data.master || [];
  const transaksi = data.transaksi || [];
  const pengeluaran = data.pengeluaran || [];

  const stokMenipis = master.filter(m => (parseInt(m['Stok Saat Ini']) || 0) <= CONFIG.STOK_MINIMAL);
  const stokAman = master.length - stokMenipis.length;

  const today = new Date().toISOString().slice(0, 10);
  const penjualanHariIni = transaksi
    .filter(t => t['Tanggal'] && t['Tanggal'].startsWith(today))
    .reduce((sum, t) => sum + (parseFloat(t['Total Harga']) || 0), 0);

  const totalPengeluaran = pengeluaran.reduce((sum, p) => sum + (parseFloat(p['Jumlah Uang']) || 0), 0);

  return { stokAman, stokMenipis, penjualanHariIni, totalPengeluaran };
}

function renderDashboard(stats, data) {
  $('#stok-aman').textContent = stats.stokAman;
  $('#stok-menipis').textContent = stats.stokMenipis.length;
  $('#penjualan-hari-ini').textContent = formatRupiah(stats.penjualanHariIni);
  $('#pengeluaran-total').textContent = formatRupiah(stats.totalPengeluaran);
  $('#last-updated').textContent = `Data sinkron: ${new Date().toLocaleTimeString('id-ID')}`;

  renderTable('#body-menipis', stats.stokMenipis,
    m => `<tr><td>${m['Kode Barang']}</td><td>${m['Nama Barang']}</td><td class="text-danger">${m['Stok Saat Ini']}</td></tr>`,
    '✅ Semua stok aman'
  );

  const recent = (data.transaksi || []).slice(-CONFIG.MAX_TRANSAKSI_TAMPIL).reverse();
  renderTable('#body-transaksi', recent,
    t => `<tr><td>${t['Tanggal']}</td><td>${t['Nama Barang']}</td><td>${t['Jumlah Beli']}</td><td>${formatRupiah(t['Total Harga'])}</td></tr>`,
    '📭 Belum ada transaksi'
  );
}

function renderTable(selector, items, rowFn, emptyMsg) {
  const tbody = document.querySelector(selector);
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">${emptyMsg}</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(rowFn).join('');
}

async function init() {
  const loader = $('#loader');
  const errorMsg = $('#error-msg');
  const main = $('#dashboard');

  try {
    loader.style.display = 'block';
    errorMsg.style.display = 'none';
    main.style.display = 'none';

    const data = await fetchData();
    if (data.error) throw new Error(data.error);

    const stats = calculateStats(data);
    renderDashboard(stats, data);

    loader.style.display = 'none';
    main.style.display = 'block';
  } catch (err) {
    console.error(err);
    loader.style.display = 'none';
    errorMsg.style.display = 'block';
    errorMsg.textContent = `⚠️ ${err.message}. Periksa URL config.js & izin Deploy Apps Script.`;
  }
}

document.addEventListener('DOMContentLoaded', init);
setInterval(init, CONFIG.REFRESH_INTERVAL_MS);
