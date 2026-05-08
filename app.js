// ==========================================
// INITIALIZATION
// ==========================================

$(document).ready(function() {
    loadAllData();
    updateClock();
    setInterval(updateClock, 1000);
    $(document).on('keyup', '#searchProduct', function() { displayProductListForPOS(); });
});

function updateClock() {
    const now = new Date();
    $('#currentTime').text(now.toLocaleString('id-ID'));
}

function loadAllData() {
    loadProducts();
    loadCustomers();
    loadSuppliers();
    loadRestocks();
}

function showLoading(show) {
    $('#loadingOverlay').toggle(show);
}

// ==========================================
// GOOGLE SHEETS API - Simplified (No CORS)
// ==========================================

function saveToSheet(sheetName, rowData) {
    // Simpan ke localStorage untuk offline support
    let offlineData = JSON.parse(localStorage.getItem(sheetName) || '[]');
    offlineData.push(rowData);
    localStorage.setItem(sheetName, JSON.stringify(offlineData));
    
    // Gunakan image ping atau form submit untuk bypass CORS
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = CONFIG.WEB_APP_URL;
    form.target = 'hiddenFrame';
    form.style.display = 'none';
    
    const payload = {
        action: 'append',
        sheet: sheetName,
        row: rowData
    };
    
    const input = document.createElement('input');
    input.name = 'data';
    input.value = JSON.stringify(payload);
    form.appendChild(input);
    
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
    
    return true;
}

// Create hidden iframe for form submission
$('body').append('<iframe name="hiddenFrame" style="display:none"></iframe>');

// ==========================================
// PRODUCT MANAGEMENT
// ==========================================

function loadProducts() {
    // Load from localStorage or use sample data
    const saved = localStorage.getItem(CONFIG.SHEET_NAMES.MASTER_BARANG);
    if (saved && JSON.parse(saved).length > 0) {
        dataCache.products = JSON.parse(saved);
    } else {
        // Sample data from your Google Sheets
        dataCache.products = [
            { kode: 'BRG001', nama: 'Beras Premium 5kg', kategori: 'Sembako', satuan: 'Pcs', hargaBeli: 75000, hargaJual: 85000, stokAwal: 50, stokSaatIni: 50, statusStok: '✅ Aman' },
            { kode: 'BRG002', nama: 'Minyak Goreng 2L', kategori: 'Sembako', satuan: 'Pcs', hargaBeli: 25000, hargaJual: 30000, stokAwal: 30, stokSaatIni: 30, statusStok: '✅ Aman' },
            { kode: 'BRG003', nama: 'Gula Pasir 1kg', kategori: 'Sembako', satuan: 'Pcs', hargaBeli: 13000, hargaJual: 15000, stokAwal: 3, stokSaatIni: 3, statusStok: '⚠️ RESTOCK' }
        ];
    }
    displayProducts();
}

function displayProducts() {
    const tbody = $('#productsBody');
    tbody.empty();
    dataCache.products.forEach((product, index) => {
        tbody.append(`
            <tr>
                <td>${product.kode}${product.nama}${product.kategori || '-'}${product.satuan || '-'}${formatRupiah(product.hargaBeli)}${formatRupiah(product.hargaJual)}${product.stokSaatIni}
                <td class="${product.statusStok === '⚠️ RESTOCK' ? 'text-danger fw-bold' : 'text-success'}">${product.statusStok}
                <td>
                    <button class="btn btn-sm btn-warning" onclick='editProduct(${JSON.stringify(product)})'><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product.kode}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `);
    });
    displayProductListForPOS();
}

function displayProductListForPOS() {
    const searchTerm = $('#searchProduct').val().toLowerCase();
    const filtered = dataCache.products.filter(p => p.kode.toLowerCase().includes(searchTerm) || p.nama.toLowerCase().includes(searchTerm));
    const tbody = $('#productListBody');
    tbody.empty();
    filtered.forEach(product => {
        tbody.append(`
            <tr>
                <td>${product.kode}${product.nama}${formatRupiah(product.hargaJual)}${product.stokSaatIni}
                <td><button class="btn btn-sm btn-success" onclick="addToCart('${product.kode}')" ${product.stokSaatIni <= 0 ? 'disabled' : ''}><i class="fas fa-plus"></i></button></td>
            </tr>
        `);
    });
}

function showProductModal(product = null) {
    if (product) {
        $('#productKode').val(product.kode);
        $('#productCode').val(product.kode);
        $('#productName').val(product.nama);
        $('#productCategory').val(product.kategori);
        $('#productUnit').val(product.satuan);
        $('#productStock').val(product.stokAwal);
        $('#productBuyPrice').val(product.hargaBeli);
        $('#productSellPrice').val(product.hargaJual);
        $('#productCode').prop('readonly', true);
    } else {
        $('#productModal input').val('');
        $('#productKode').val('');
        $('#productCode').prop('readonly', false);
        $('#productCode').val('BRG' + String(dataCache.products.length + 1).padStart(3, '0'));
    }
    $('#productModal').modal('show');
}

function saveProduct() {
    const kode = $('#productCode').val();
    const stokAwal = parseInt($('#productStock').val()) || 0;
    const product = {
        kode: kode,
        nama: $('#productName').val(),
        kategori: $('#productCategory').val(),
        satuan: $('#productUnit').val(),
        hargaBeli: parseInt($('#productBuyPrice').val()) || 0,
        hargaJual: parseInt($('#productSellPrice').val()) || 0,
        stokAwal: stokAwal,
        stokSaatIni: stokAwal,
        statusStok: stokAwal <= 5 ? '⚠️ RESTOCK' : '✅ Aman'
    };
    
    const existingIndex = dataCache.products.findIndex(p => p.kode === kode);
    if (existingIndex >= 0) {
        dataCache.products[existingIndex] = product;
        showNotification('Barang berhasil diupdate', 'success');
    } else {
        dataCache.products.push(product);
        showNotification('Barang berhasil ditambahkan', 'success');
    }
    
    localStorage.setItem(CONFIG.SHEET_NAMES.MASTER_BARANG, JSON.stringify(dataCache.products));
    saveToSheet(CONFIG.SHEET_NAMES.MASTER_BARANG, Object.values(product));
    displayProducts();
    $('#productModal').modal('hide');
}

function deleteProduct(kode) {
    if (confirm('Yakin ingin menghapus barang ini?')) {
        dataCache.products = dataCache.products.filter(p => p.kode !== kode);
        localStorage.setItem(CONFIG.SHEET_NAMES.MASTER_BARANG, JSON.stringify(dataCache.products));
        displayProducts();
        showNotification('Barang berhasil dihapus', 'success');
    }
}

// ==========================================
// CUSTOMER MANAGEMENT
// ==========================================

function loadCustomers() {
    const saved = localStorage.getItem(CONFIG.SHEET_NAMES.PELANGGAN);
    if (saved && JSON.parse(saved).length > 0) {
        dataCache.customers = JSON.parse(saved);
    } else {
        dataCache.customers = [
            { nama: 'Budi Santoso', wa: '081234567890', alamat: 'Jl. Mawar No. 5', catatan: 'Pelanggan Tetap' },
            { nama: 'Siti Aminah', wa: '082345678901', alamat: 'Jl. Melati No. 10', catatan: 'Baru' }
        ];
    }
    displayCustomers();
}

function displayCustomers() {
    const tbody = $('#customersBody');
    tbody.empty();
    dataCache.customers.forEach((customer, index) => {
        tbody.append(`
            <tr>
                <td>${customer.nama}${customer.wa || '-'}${customer.alamat || '-'}${customer.catatan || '-'}
                <td>
                    <button class="btn btn-sm btn-warning" onclick='editCustomer(${JSON.stringify(customer)})'><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCustomer(${index})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `);
    });
}

function showCustomerModal(customer = null) {
    if (customer) {
        $('#customerId').val(customer.id);
        $('#customerName').val(customer.nama);
        $('#customerPhone').val(customer.wa);
        $('#customerAddress').val(customer.alamat);
        $('#customerNote').val(customer.catatan);
    } else {
        $('#customerModal input, #customerModal textarea').val('');
        $('#customerId').val('');
    }
    $('#customerModal').modal('show');
}

function saveCustomer() {
    const customer = {
        nama: $('#customerName').val(),
        wa: $('#customerPhone').val(),
        alamat: $('#customerAddress').val(),
        catatan: $('#customerNote').val()
    };
    
    const id = $('#customerId').val();
    if (id) {
        const index = parseInt(id);
        dataCache.customers[index] = customer;
        showNotification('Pelanggan berhasil diupdate', 'success');
    } else {
        dataCache.customers.push(customer);
        showNotification('Pelanggan berhasil ditambahkan', 'success');
    }
    
    localStorage.setItem(CONFIG.SHEET_NAMES.PELANGGAN, JSON.stringify(dataCache.customers));
    saveToSheet(CONFIG.SHEET_NAMES.PELANGGAN, Object.values(customer));
    displayCustomers();
    $('#customerModal').modal('hide');
}

function deleteCustomer(index) {
    if (confirm('Yakin ingin menghapus pelanggan ini?')) {
        dataCache.customers.splice(index, 1);
        localStorage.setItem(CONFIG.SHEET_NAMES.PELANGGAN, JSON.stringify(dataCache.customers));
        displayCustomers();
        showNotification('Pelanggan berhasil dihapus', 'success');
    }
}

// ==========================================
// SUPPLIER MANAGEMENT
// ==========================================

function loadSuppliers() {
    const saved = localStorage.getItem(CONFIG.SHEET_NAMES.SUPPLIER);
    if (saved && JSON.parse(saved).length > 0) {
        dataCache.suppliers = JSON.parse(saved);
    } else {
        dataCache.suppliers = [
            { nama: 'PT Grosir Jaya', alamat: 'Jl. Industri No. 10', kontak: '021-5551234', catatan: 'Supplier Utama' },
            { nama: 'UD Sumber Rezeki', alamat: 'Jl. Pasar Baru No. 5', kontak: '08123456789', catatan: 'Supplier Beras' }
        ];
    }
    displaySuppliers();
}

function displaySuppliers() {
    const tbody = $('#suppliersBody');
    tbody.empty();
    dataCache.suppliers.forEach((supplier, index) => {
        tbody.append(`
            <tr>
                <td>${supplier.nama}${supplier.alamat || '-'}${supplier.kontak || '-'}${supplier.catatan || '-'}
                <td>
                    <button class="btn btn-sm btn-warning" onclick='editSupplier(${JSON.stringify(supplier)})'><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSupplier(${index})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `);
    });
    updateSupplierDropdown();
}

function updateSupplierDropdown() {
    const select = $('#restockSupplier');
    select.empty();
    select.append('<option value="">Pilih Supplier...</option>');
    dataCache.suppliers.forEach(supplier => {
        select.append(`<option value="${supplier.nama}">${supplier.nama}</option>`);
    });
}

function showSupplierModal(supplier = null) {
    if (supplier) {
        $('#supplierId').val(supplier.id);
        $('#supplierName').val(supplier.nama);
        $('#supplierAddress').val(supplier.alamat);
        $('#supplierContact').val(supplier.kontak);
        $('#supplierNote').val(supplier.catatan);
    } else {
        $('#supplierModal input, #supplierModal textarea').val('');
        $('#supplierId').val('');
    }
    $('#supplierModal').modal('show');
}

function saveSupplier() {
    const supplier = {
        nama: $('#supplierName').val(),
        alamat: $('#supplierAddress').val(),
        kontak: $('#supplierContact').val(),
        catatan: $('#supplierNote').val()
    };
    
    const id = $('#supplierId').val();
    if (id) {
        dataCache.suppliers[parseInt(id)] = supplier;
        showNotification('Supplier berhasil diupdate', 'success');
    } else {
        dataCache.suppliers.push(supplier);
        showNotification('Supplier berhasil ditambahkan', 'success');
    }
    
    localStorage.setItem(CONFIG.SHEET_NAMES.SUPPLIER, JSON.stringify(dataCache.suppliers));
    saveToSheet(CONFIG.SHEET_NAMES.SUPPLIER, Object.values(supplier));
    displaySuppliers();
    $('#supplierModal').modal('hide');
}

function deleteSupplier(index) {
    if (confirm('Yakin ingin menghapus supplier ini?')) {
        dataCache.suppliers.splice(index, 1);
        localStorage.setItem(CONFIG.SHEET_NAMES.SUPPLIER, JSON.stringify(dataCache.suppliers));
        displaySuppliers();
        showNotification('Supplier berhasil dihapus', 'success');
    }
}

// ==========================================
// RESTOCK MANAGEMENT
// ==========================================

function loadRestocks() {
    const saved = localStorage.getItem(CONFIG.SHEET_NAMES.PEMBELIAN_RESTOCK);
    if (saved && JSON.parse(saved).length > 0) {
        dataCache.restocks = JSON.parse(saved);
    } else {
        dataCache.restocks = [
            { tanggal: '2026-05-07', kodeBarang: 'BRG001', namaBarang: 'Beras Premium 5kg', jumlah: 10, hargaBeli: 72000, total: 720000, supplier: 'PT Grosir Jaya', keterangan: 'Restock rutin' }
        ];
    }
    displayRestocks();
}

function displayRestocks() {
    const tbody = $('#restockBody');
    tbody.empty();
    dataCache.restocks.forEach(restock => {
        tbody.append(`
            <tr>
                <td>${restock.tanggal}${restock.kodeBarang}${restock.namaBarang}${restock.jumlah}${formatRupiah(restock.hargaBeli)}${formatRupiah(restock.total)}${restock.supplier || '-'}${restock.keterangan || '-'}
            </tr>
        `);
    });
}

function showRestockModal() {
    updateProductDropdown();
    updateSupplierDropdown();
    $('#restockModal').modal('show');
}

function updateProductDropdown() {
    const select = $('#restockProduct');
    select.empty();
    select.append('<option value="">Pilih Barang...</option>');
    dataCache.products.forEach(product => {
        select.append(`<option value="${product.kode}" data-harga="${product.hargaBeli}">${product.kode} - ${product.nama}</option>`);
    });
}

function updateRestockInfo() {
    const kode = $('#restockProduct').val();
    const product = dataCache.products.find(p => p.kode === kode);
    if (product) $('#restockPrice').val(product.hargaBeli);
    else $('#restockPrice').val('');
}

function saveRestock() {
    const kode = $('#restockProduct').val();
    const product = dataCache.products.find(p => p.kode === kode);
    if (!product) { showNotification('Pilih barang terlebih dahulu', 'error'); return; }
    
    const jumlah = parseInt($('#restockQuantity').val());
    const hargaBeli = parseInt($('#restockPrice').val());
    const total = jumlah * hargaBeli;
    
    const restock = {
        tanggal: new Date().toISOString().split('T')[0],
        kodeBarang: kode,
        namaBarang: product.nama,
        jumlah: jumlah,
        hargaBeli: hargaBeli,
        total: total,
        supplier: $('#restockSupplier').val(),
        keterangan: $('#restockNote').val()
    };
    
    // Update product stock
    product.stokSaatIni += jumlah;
    product.statusStok = product.stokSaatIni <= 5 ? '⚠️ RESTOCK' : '✅ Aman';
    
    dataCache.restocks.unshift(restock);
    localStorage.setItem(CONFIG.SHEET_NAMES.MASTER_BARANG, JSON.stringify(dataCache.products));
    localStorage.setItem(CONFIG.SHEET_NAMES.PEMBELIAN_RESTOCK, JSON.stringify(dataCache.restocks));
    saveToSheet(CONFIG.SHEET_NAMES.PEMBELIAN_RESTOCK, Object.values(restock));
    
    displayProducts();
    displayRestocks();
    $('#restockModal').modal('hide');
    showNotification('Restock berhasil diproses', 'success');
}

// ==========================================
// POS / CART
// ==========================================

let cart = [];

function addToCart(kode) {
    const product = dataCache.products.find(p => p.kode === kode);
    if (!product || product.stokSaatIni <= 0) { showNotification('Stok tidak tersedia!', 'error'); return; }
    
    const existingItem = cart.find(item => item.kode === kode);
    if (existingItem) {
        if (existingItem.qty + 1 <= product.stokSaatIni) {
            existingItem.qty++;
            existingItem.subtotal = existingItem.qty * existingItem.hargaJual;
        } else showNotification('Stok tidak mencukupi!', 'error');
    } else {
        cart.push({ kode: product.kode, nama: product.nama, hargaJual: product.hargaJual, qty: 1, subtotal: product.hargaJual });
    }
    displayCart();
}

function displayCart() {
    const tbody = $('#cartBody');
    tbody.empty();
    let total = 0;
    cart.forEach((item, index) => {
        total += item.subtotal;
        tbody.append(`
            <tr>
                <td>${item.kode}${item.nama}${formatRupiah(item.hargaJual)}
                <td><input type="number" value="${item.qty}" min="1" onchange="updateCartQty(${index}, this.value)" style="width:70px;" class="form-control form-control-sm">
                <td>${formatRupiah(item.subtotal)}
                <td><button class="btn btn-sm btn-danger" onclick="removeFromCart(${index})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `);
    });
    $('#totalAmount').text(formatRupiah(total));
}

function updateCartQty(index, qty) {
    qty = parseInt(qty);
    const product = dataCache.products.find(p => p.kode === cart[index].kode);
    if (product && qty <= product.stokSaatIni) {
        cart[index].qty = qty;
        cart[index].subtotal = qty * cart[index].hargaJual;
        displayCart();
    } else showNotification('Melebihi stok yang tersedia!', 'error');
}

function removeFromCart(index) {
    cart.splice(index, 1);
    displayCart();
}

function checkout() {
    if (cart.length === 0) { showNotification('Keranjang kosong!', 'error'); return; }
    
    const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const invoice = 'INV-' + Date.now();
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('id-ID');
    const paymentMethod = $('#paymentMethod').val();
    const cashier = $('#cashierName').val();
    
    // Process each transaction
    cart.forEach(item => {
        const transaction = [date, time, invoice, item.kode, item.nama, item.hargaJual, item.qty, item.subtotal, paymentMethod, cashier];
        saveToSheet(CONFIG.SHEET_NAMES.TRANSAKSI_PENJUALAN, transaction);
        
        // Update stock
        const product = dataCache.products.find(p => p.kode === item.kode);
        if (product) {
            product.stokSaatIni -= item.qty;
            product.statusStok = product.stokSaatIni <= 5 ? '⚠️ RESTOCK' : '✅ Aman';
        }
    });
    
    localStorage.setItem(CONFIG.SHEET_NAMES.MASTER_BARANG, JSON.stringify(dataCache.products));
    
    // Save transactions to localStorage
    let allTransactions = JSON.parse(localStorage.getItem(CONFIG.SHEET_NAMES.TRANSAKSI_PENJUALAN) || '[]');
    cart.forEach(item => {
        allTransactions.push([date, time, invoice, item.kode, item.nama, item.hargaJual, item.qty, item.subtotal, paymentMethod, cashier]);
    });
    localStorage.setItem(CONFIG.SHEET_NAMES.TRANSAKSI_PENJUALAN, JSON.stringify(allTransactions));
    
    // Print receipt
    printReceipt(invoice, date, time, cart, total, paymentMethod, cashier);
    
    cart = [];
    displayCart();
    displayProducts();
    showNotification(`Transaksi berhasil! Invoice: ${invoice}`, 'success');
}

function printReceipt(invoice, date, time, items, total, paymentMethod, cashier) {
    const w = window.open('', '_blank', 'width=400,height=600');
    w.document.write(`
        <html><head><title>Struk Pembayaran</title>
        <style>
            body { font-family: monospace; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .line { border-top: 1px dashed #000; margin: 10px 0; }
            .total { font-size: 18px; font-weight: bold; margin-top: 10px; }
            .footer { text-align: center; margin-top: 20px; }
        </style></head>
        <body>
            <div class="header"><h3>${CONFIG.APP_NAME}</h3><p>${date} ${time}</p><p>Invoice: ${invoice}</p></div>
            <div class="line"></div>
            <table width="100%"><thead><tr><th>Item</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody>
                ${items.map(item => `<tr><td>${item.nama}</td><td align="center">${item.qty}</td><td align="right">${formatRupiah(item.hargaJual)}</td><td align="right">${formatRupiah(item.subtotal)}</td></tr>`).join('')}
            </tbody></table>
            <div class="line"></div>
            <div class="total"><table width="100%"><tr><td>Total:</td><td align="right">${formatRupiah(total)}</td></tr>
            <tr><td>Metode Bayar:</td><td align="right">${paymentMethod}</td></tr>
            <tr><td>Kasir:</td><td align="right">${cashier}</td></tr></table></div>
            <div class="line"></div>
            <div class="footer"><p>Terima kasih atas kunjungan Anda!</p><p>Barang yang sudah dibeli tidak dapat dikembalikan</p></div>
            <script>window.print();setTimeout(function(){window.close();},500);<\/script>
        </body></html>
    `);
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function formatRupiah(angka) {
    if (!angka) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
}

function showNotification(message, type = 'info') {
    alert(message);
}

function editProduct(product) { showProductModal(product); }
function editCustomer(customer) { showCustomerModal(customer); }
function editSupplier(supplier) { showSupplierModal(supplier); }
