import { CONFIG } from './config.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const formatRp = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);

let DB = {};
let cart = [];
let filter = { start: '', end: '' };

const MASTER_CONFIG = {
  barang:    { title: 'Tambah Barang',    sheet: 'MASTER BARANG',         fields: ['Kode Barang','Nama Barang','Kategori','Satuan','Harga Beli','Harga Jual'] },
  pelanggan: { title: 'Tambah Pelanggan', sheet: 'PELANGGAN',             fields: ['Nama','No. WA'] },
  supplier:  { title: 'Tambah Supplier',  sheet: 'SUPPLIER',              fields: ['Nama','Kontak'] }
};


// 🌐 Fetch Data
async function loadData() {
  $('#loader').style.display = 'block';
  $('#error-msg').style.display = 'none';
  try {
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?v=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DB = await res.json();
    
    // 🛠️ FIX: Hapus baris kosong dari data sheet
    const clean = (arr, key) => arr.filter(r => r[key]?.toString().trim());
    DB.master = clean(DB.master, 'Kode Barang');
    DB.pelanggan = clean(DB.pelanggan || [], 'Nama');
    DB.supplier = clean(DB.supplier || [], 'Nama');

    $('#last-sync').textContent = `Sinkron: ${new Date().toLocaleTimeString('id-ID')}`;
    initUI();
    $('#loader').style.display = 'none';
  } catch (e) {
    $('#loader').style.display = 'none';
    $('#error-msg').textContent = `⚠️ ${e.message}`;
    $('#error-msg').style.display = 'block';
  }
}



// 🎨 Init UI
function initUI() {
  // Set default dates
  const today = new Date().toISOString().slice(0, 10);
  $('#date-start').value = new Date(new Date().setDate(1)).toISOString().slice(0, 10);
  $('#date-end').value = today;
  filter.start = $('#date-start').value;
  filter.end = $('#date-end').value;

  renderStats();
  renderStok();
  renderKasir();
  renderGudang();
  renderMaster();
  renderReport();
  renderCharts();
}

// 📊 Filter & Render
function applyFilter() {
  filter.start = $('#date-start').value;
  filter.end = $('#date-end').value;
  initUI();
}

function getFiltered(arr) {
  return arr.filter(r => r['Tanggal'] >= filter.start && r['Tanggal'] <= filter.end);
}

// 💰 Dashboard & Laporan
function renderStats() {
  const trx = getFiltered(DB.transaksi || []);
  const out = getFiltered(DB.pengeluaran || []);
  const today = new Date().toISOString().slice(0, 10);
  const jualToday = (DB.transaksi || []).filter(t => t['Tanggal'] === today).reduce((s, t) => s + parseFloat(t['Total Harga'] || 0), 0);

  $('#stats-container').innerHTML = `
    <div class="stat-card"><h4>Penjualan Hari Ini</h4><span>${formatRp(jualToday)}</span></div>
    <div class="stat-card"><h4>Total Periode</h4><span>${formatRp(trx.reduce((s,t)=>s+parseFloat(t['Total Harga']||0),0))}</span></div>
    <div class="stat-card"><h4>Pengeluaran</h4><span>${formatRp(out.reduce((s,p)=>s+parseFloat(p['Jumlah Uang']||0),0))}</span></div>
  `;
}

function renderReport() {
  const trx = getFiltered(DB.transaksi || []);
  const beli = getFiltered(DB.pembelian || []);
  const out = getFiltered(DB.pengeluaran || []);
  const totalJual = trx.reduce((s,t)=>s+parseFloat(t['Total Harga']||0),0);
  const totalBeli = beli.reduce((s,b)=>s+parseFloat(b['Total Modal']||0),0);
  const totalOut = out.reduce((s,p)=>s+parseFloat(p['Jumlah Uang']||0),0);

  $('#t-laporan').innerHTML = `
    <tr><td>Total Penjualan</td><td>${formatRp(totalJual)}</td></tr>
    <tr><td>Total Modal Barang</td><td>${formatRp(totalBeli)}</td></tr>
    <tr><td>Pengeluaran Operasional</td><td>${formatRp(totalOut)}</td></tr>
    <tr><td><strong>Laba Bersih</strong></td><td><strong>${formatRp(totalJual - totalBeli - totalOut)}</strong></td></tr>
  `;
}

// 📈 Charts
function renderCharts() {
  const trx = getFiltered(DB.transaksi || []);
  const salesByDate = {};
  trx.forEach(t => salesByDate[t['Tanggal']] = (salesByDate[t['Tanggal']]||0) + parseFloat(t['Total Harga']||0));
  
  const topItems = {};
  trx.forEach(t => topItems[t['Nama Barang']] = (topItems[t['Nama Barang']]||0) + parseInt(t['Jumlah Beli']||0));

  renderChart('chart-sales', 'bar', Object.keys(salesByDate).sort(), Object.values(salesByDate), 'Penjualan Harian');
  const topSorted = Object.entries(topItems).sort((a,b)=>b[1]-a[1]).slice(0,5);
  renderChart('chart-top', 'doughnut', topSorted.map(x=>x[0]), topSorted.map(x=>x[1]), 'Top 5 Barang');
}

function renderChart(id, type, labels, data, title) {
  const ctx = $(`#${id}`).getContext('2d');
  if (ctx.chart) ctx.chart.destroy();
  ctx.chart = new Chart(ctx, { type, data: { labels, datasets: [{ label: title, data, backgroundColor: '#2563eb' }] } });
}

// 📋 Stok Table
function renderStok() {
  const q = ($('#search-stok')?.value || '').toLowerCase();
  const filtered = DB.master.filter(m => 
    (m['Nama Barang'] || '').toLowerCase().includes(q) || (m['Kode Barang'] || '').toLowerCase().includes(q)
  );
  $('#t-stok').innerHTML = filtered.length === 0 ? '<tr><td colspan="5" class="empty">Tidak ada data</td></tr>' :
    filtered.map(m => {
      const st = parseInt(m['Stok Saat Ini'] || 0);
      const badge = st <= 5 ? '<span class="badge warn">Menipis</span>' : '<span class="badge ok">Aman</span>';
      return `<tr><td>${m['Kode Barang']}</td><td>${m['Nama Barang']}</td><td>${m['Kategori']}</td><td>${st}</td><td>${badge}</td></tr>`;
    }).join('');
}

// 🛒 Kasir POS
function renderKasir() {
  $('#pos-customer').innerHTML = '<option value="Umum">Pelanggan Umum</option>' + 
    (DB.pelanggan||[]).map(p=>`<option value="${p['Nama']}">${p['Nama']}</option>`).join('');
}

$('#pos-search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  const res = DB.master.filter(m => (m['Nama Barang']||'').toLowerCase().includes(q) || (m['Kode Barang']||'').toLowerCase().includes(q));
  $('#pos-results').innerHTML = res.map(m => `<div style="padding:8px; cursor:pointer; border-bottom:1px solid #eee;" onclick="addToCart('${m['Kode Barang']}')">${m['Kode Barang']} - ${m['Nama Barang']} (${formatRp(m['Harga Jual'])})</div>`).join('');
});

window.addToCart = (kode) => {
  const item = DB.master.find(m => m['Kode Barang'] === kode);
  if (!item) return;
  const existing = cart.find(c => c.kode === kode);
  if (existing) existing.qty++; else cart.push({ ...item, qty: 1 });
  renderCart();
};

function renderCart() {
  $('#cart-list').innerHTML = cart.map((c, i) => `
    <div class="cart-item">
      <span>${c['Nama Barang']} x${c.qty}</span>
      <span>${formatRp(c['Harga Jual'] * c.qty)} <button onclick="cart.splice(${i},1);renderCart()" style="margin-left:5px;">🗑️</button></span>
    </div>
  `).join('') || '<div class="empty">Keranjang kosong</div>';
  $('#cart-total').value = formatRp(cart.reduce((s,c)=>s+(c['Harga Jual']*c.qty),0));
}

window.checkout = async () => {
  if (!cart.length) return alert('Keranjang kosong!');
  const btn = event.target; btn.disabled = true; btn.textContent = '⏳ Memproses...';
  const total = cart.reduce((s,c)=>s+(c['Harga Jual']*c.qty),0);
  const invoice = 'INV-' + Date.now().toString().slice(-6);
  const today = new Date().toISOString().slice(0, 10);
  
  for (const c of cart) {
    const row = [today, new Date().toTimeString().slice(0,5), invoice, c['Kode Barang'], c['Nama Barang'], c['Harga Jual'], c.qty, c['Harga Jual']*c.qty, $('#pay-method').value, $('#pos-customer').value];
    await postData('TRANSAKSI PENJUALAN', 'append', row);
  }
  alert(`✅ Transaksi ${invoice} berhasil!`);
  cart = []; renderCart(); btn.disabled = false; btn.textContent = '✅ Checkout';
};

// 📦 Gudang
function renderGudang() {
  $('#beli-supplier').innerHTML = '<option value="">Pilih Supplier</option>' + (DB.supplier||[]).map(s=>`<option value="${s['Nama']}">${s['Nama']}</option>`).join('');
  $('#beli-tanggal').value = new Date().toISOString().slice(0, 10);
}

window.submitRestock = async () => {
  const row = [$('#beli-tanggal').value, $('#beli-kode').value, '', $('#beli-qty').value, $('#beli-harga').value, $('#beli-qty').value * $('#beli-harga').value, $('#beli-supplier').value, ''];
  await postData('PEMBELIAN / RESTOCK', 'append', row);
  alert('📥 Restock tersimpan! Stok akan update otomatis.');
  $('#beli-kode').value = ''; $('#beli-qty').value = ''; $('#beli-harga').value = '';
};

// 👥 Master CRUD
function renderMaster() {
  $('#list-barang').innerHTML    = renderList(DB.master, MASTER_CONFIG.barang.fields, MASTER_CONFIG.barang.sheet);
  $('#list-pelanggan').innerHTML = renderList(DB.pelanggan, MASTER_CONFIG.pelanggan.fields, MASTER_CONFIG.pelanggan.sheet);
  $('#list-supplier').innerHTML  = renderList(DB.supplier, MASTER_CONFIG.supplier.fields, MASTER_CONFIG.supplier.sheet);
}

// 📋 Ganti fungsi renderList() yang lama
function renderList(arr, fields, sheetName) {
  if (!arr || arr.length === 0) return '<div class="empty">Belum ada data</div>';
  return arr.map((r, i) => `
    <div class="list-item">
      <span>${fields.map(f => r[f] || '-').join(' | ')}</span>
      <button class="btn btn-danger" style="padding:2px 8px; font-size:0.8rem;" 
              onclick="postData('${sheetName}', 'delete', [], ${i + 2})">🗑️</button>
    </div>
  `).join('');
}

window.openCRUD = (type) => {
  const cfg = MASTER_CONFIG[type];
  if (!cfg) return;
  
  $('#modal-title').textContent = cfg.title;
  $('#crud-form').innerHTML = cfg.fields.map(f => `
    <div class="form-group">
      <label>${f}</label>
      <input type="text" id="f-${f.replace(/\s/g, '-')}" class="form-control" placeholder="${f}">
    </div>
  `).join('') + `<button type="button" class="btn btn-primary" style="width:100%; margin-top:10px;" onclick="submitCRUD('${type}')">💾 Simpan</button>`;
  
  $('#crud-modal').style.display = 'flex';
};

window.submitCRUD = async (type) => {
  const cfg = MASTER_CONFIG[type];
  const row = cfg.fields.map(f => {
    const id = `f-${f.replace(/\s/g, '-')}`;
    return $(`#${id}`)?.value || '';
  });

  const btn = $('#crud-form button');
  btn.disabled = true; btn.textContent = '⏳ Menyimpan...';

  try {
    await postData(cfg.sheet, 'append', row);
    closeModal(); loadData(); // Reload data dari sheet
  } catch (e) {
    alert('Gagal menyimpan: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '💾 Simpan';
  }
};

window.closeModal = () => $('#crud-modal').style.display = 'none';

// 🌐 POST Handler
async function postData(sheet, action, row = [], rowIndex = 0) {
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ sheet, action, row, rowIndex })
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json;
}

// 🔄 Navigation & Init
$$('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
  $$('.tab-btn').forEach(b => b.classList.remove('active'));
  $$('.section').forEach(s => s.classList.remove('active'));
  btn.classList.add('active'); $(`#${btn.dataset.tab}`).classList.add('active');
}));

$('#search-stok')?.addEventListener('input', renderStok);
document.addEventListener('DOMContentLoaded', loadData);
