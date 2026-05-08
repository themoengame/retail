import { CONFIG } from './config.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const formatRupiah = (n) => new Intl.NumberFormat(CONFIG.CURRENCY_LOCALE, { style: 'currency', currency: CONFIG.CURRENCY_CODE, minimumFractionDigits: 0 }).format(n || 0);

let DB = {};

async function loadAllData() {
  const loader = $('#loader');
  const errorMsg = $('#error-msg');
  try {
    loader.style.display = 'block';
    errorMsg.style.display = 'none';
    
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?v=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DB = await res.json();
    
    $('#last-sync').textContent = `Data sinkron: ${new Date().toLocaleTimeString('id-ID')}`;
    renderAll();
    loader.style.display = 'none';
  } catch (e) {
    loader.style.display = 'none';
    errorMsg.style.display = 'block';
    errorMsg.textContent = `⚠️ ${e.message}. Cek URL config.js & izin Deploy Apps Script.`;
  }
}

function renderAll() {
  const master = DB.master || [];
  const trx = DB.transaksi || [];
  const beli = DB.pembelian || [];
  const out = DB.pengeluaran || [];

  // DASHBOARD
  const low = master.filter(m => (parseInt(m['Stok Saat Ini'])||0) <= CONFIG.STOK_MINIMAL).length;
  $('#d-stok-aman').textContent = master.length - low;
  $('#d-stok-warn').textContent = low;
  const today = new Date().toISOString().slice(0,10);
  const jualToday = trx.filter(t => t['Tanggal']?.startsWith(today)).reduce((s,t)=>s+parseFloat(t['Total Harga']||0),0);
  $('#d-jual').textContent = formatRupiah(jualToday);
  $('#d-out').textContent = formatRupiah(out.reduce((s,p)=>s+parseFloat(p['Jumlah Uang']||0),0));
  $('#t-recent').innerHTML = trx.slice(-5).reverse().map(t=>`<tr><td>${t['Tanggal']}</td><td>${t['Nama Barang']}</td><td>${t['Jumlah Beli']}</td><td>${formatRupiah(t['Total Harga'])}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Belum ada transaksi</td></tr>';

  // STOK
  $('#t-stok').innerHTML = master.map(m=>{
    const st = parseInt(m['Stok Saat Ini'])||0;
    const badge = st <= CONFIG.STOK_MINIMAL ? '<span class="badge warn">Menipis</span>' : '<span class="badge ok">Aman</span>';
    return `<tr><td>${m['Kode Barang']}</td><td>${m['Nama Barang']}</td><td>${m['Kategori']}</td><td>${st}</td><td>${badge}</td></tr>`;
  }).join('');

  // PENJUALAN
  $('#t-jual').innerHTML = trx.map(t=>`<tr><td>${t['Tanggal']}</td><td>${t['No. Invoice']}</td><td>${t['Kode Barang']}</td><td>${t['Nama Barang']}</td><td>${t['Jumlah Beli']}</td><td>${formatRupiah(t['Total Harga'])}</td><td>${t['Metode Bayar']}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Belum ada data</td></tr>';

  // PEMBELIAN
  $('#t-beli').innerHTML = beli.map(b=>`<tr><td>${b['Tanggal']}</td><td>${b['Kode Barang']}</td><td>${b['Nama Barang']}</td><td>${b['Jumlah Masuk']}</td><td>${formatRupiah(b['Harga Beli Satuan'])}</td><td>${formatRupiah(b['Total Modal'])}</td><td>${b['Nama Supplier']}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Belum ada data</td></tr>';

  // LAPORAN
  const totalJual = trx.reduce((s,t)=>s+parseFloat(t['Total Harga']||0),0);
  const totalBeli = beli.reduce((s,b)=>s+parseFloat(b['Total Modal']||0),0);
  const totalOut = out.reduce((s,p)=>s+parseFloat(p['Jumlah Uang']||0),0);
  const laba = totalJual - totalBeli - totalOut;
  $('#t-laporan').innerHTML = `
    <tr><td>Total Penjualan</td><td>${formatRupiah(totalJual)}</td></tr>
    <tr><td>Total Modal Barang</td><td>${formatRupiah(totalBeli)}</td></tr>
    <tr><td>Pengeluaran Operasional</td><td>${formatRupiah(totalOut)}</td></tr>
    <tr><td><strong>Estimasi Laba Bersih</strong></td><td><strong>${formatRupiah(laba)}</strong></td></tr>
    <tr><td>Jumlah Transaksi</td><td>${trx.length} catatan</td></tr>
    <tr><td>Jumlah Stok</td><td>${master.length} item</td></tr>
  `;
}

// 🔄 Tab Navigation
$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab-btn').forEach(b => b.classList.remove('active'));
    $$('.section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    $(`#${btn.dataset.tab}`).classList.add('active');
  });
});

// 🔍 Search Stok
$('#search-stok').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  const rows = $('#t-stok').querySelectorAll('tr');
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(q) ? '' : 'none';
  });
});

// 📥 Export CSV
window.exportCSV = () => {
  const headers = ['Tanggal','Tipe','Kode','Barang','Jumlah','Total'];
  const rows = [
    ...(DB.transaksi||[]).map(t=>[t['Tanggal'],'Penjualan',t['Kode Barang'],t['Nama Barang'],t['Jumlah Beli'],t['Total Harga']]),
    ...(DB.pembelian||[]).map(b=>[b['Tanggal'],'Pembelian',b['Kode Barang'],b['Nama Barang'],b['Jumlah Masuk'],b['Total Modal']])
  ];
  let csv = headers.join(',') + '\n' + rows.map(r=>r.join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `laporan_toko_${new Date().toISOString().slice(0,10)}.csv`; a.click();
};

document.addEventListener('DOMContentLoaded', loadAllData);
