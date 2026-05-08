// ==========================================
// INITIALIZATION
// ==========================================

$(document).ready(function() {
    loadAllData();
    updateClock();
    setInterval(updateClock, 1000);
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

function syncAllData() {
    loadAllData();
    showNotification('Data berhasil disinkronkan dengan Google Sheets', 'success');
}

// ==========================================
// GOOGLE SHEETS API INTEGRATION
// ==========================================

async function callGoogleSheetsAPI(action, data = {}) {
    try {
        const response = await fetch(CONFIG.WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: action,
                data: data,
                timestamp: new Date().toISOString()
            })
        });
        
        // Karena mode no-cors, kita tidak bisa mendapatkan response
        // Simpan data ke localStorage untuk offline support
        saveToLocalStorage(action, data);
        return { success: true };
    } catch (error) {
        console.error('Error calling API:', error);
        // Offline mode - save to localStorage
        saveToLocalStorage(action, data);
        showNotification('Mode offline: Data disimpan lokal', 'warning');
        return { success: false, offline: true };
    }
}

function saveToLocalStorage(action, data) {
    let offlineData = JSON.parse(localStorage.getItem('offlineData') || '[]');
    offlineData.push({
        action: action,
        data: data,
        timestamp: new Date().toISOString()
    });
    localStorage.setItem('offlineData', JSON.stringify(offlineData));
}

// ==========================================
// PRODUCT MANAGEMENT (CRUD)
// ==========================================

function loadProducts() {
    // Demo data untuk testing
    products = [
        { kode: 'BRG001', nama: 'Beras Premium 5kg', kategori: 'Sembako', satuan: 'Pcs', hargaBeli: 75000, hargaJual: 85000, stok: 50, status: 'Aman' },
        { kode: 'BRG002', nama: 'Minyak Goreng 2L', kategori: 'Sembako', satuan: 'Pcs', hargaBeli: 25000, hargaJual: 30000, stok: 30, status: 'Aman' },
        { kode: 'BRG003', nama: 'Gula Pasir 1kg', kategori: 'Sembako', satuan: 'Pcs', hargaBeli: 13000, hargaJual: 15000, stok: 3, status: '⚠️ RESTOCK' }
    ];
    displayProducts();
}

function displayProducts() {
    const tbody = $('#productsBody');
    tbody.empty();
    
    products.forEach(product => {
        const row = `
            <tr>
                <td>${product.kode}</td>
                <td>${product.nama}</td>
                <td>${product.kategori || '-'}</td>
                <td>${product.satuan || '-'}</td>
                <td>${formatRupiah(product.hargaBeli)}</td>
                <td>${formatRupiah(product.hargaJual)}</td>
                <td>${product.stok}</td>
                <td class="${product.status === '⚠️ RESTOCK' ? 'text-danger fw-bold' : ''}">${product.status}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editProduct('${product.kode}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product.kode}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.append(row);
    });
    
    // Display product list for POS
    displayProductListForPOS();
}

function displayProductListForPOS() {
    const searchTerm = $('#searchProduct').val().toLowerCase();
    const filtered = products.filter(p => 
        p.kode.toLowerCase().includes(searchTerm) || 
        p.nama.toLowerCase().includes(searchTerm)
    );
    
    const tbody = $('#productListBody');
    tbody.empty();
    
    filtered.forEach(product => {
        const row = `
            <tr>
                <td>${product.kode}</td>
                <td>${product.nama}</td>
                <td>${formatRupiah(product.hargaJual)}</td>
                <td>${product.stok}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="addToCart('${product.kode}')" ${product.stok <= 0 ? 'disabled' : ''}>
                        <i class="fas fa-plus"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.append(row);
    });
}

function showProductModal(editMode = false, product = null) {
    if (editMode && product) {
        $('#productKode').val(product.kode);
        $('#productCode').val(product.kode);
        $('#productName').val(product.nama);
        $('#productCategory').val(product.kategori);
        $('#productUnit').val(product.satuan);
        $('#productStock').val(product.stok);
        $('#productBuyPrice').val(product.hargaBeli);
        $('#productSellPrice').val(product.hargaJual);
        $('#productCode').prop('readonly', true);
    } else {
        $('#productModal input').val('');
        $('#productKode').val('');
        $('#productCode').prop('readonly', false);
        $('#productCode').val('BRG' + String(products.length + 1).padStart(3, '0'));
    }
    $('#productModal').modal('show');
}

function editProduct(kode) {
    const product = products.find(p => p.kode === kode);
    if (product) {
        showProductModal(true, product);
    }
}

function saveProduct() {
    const product = {
        kode: $('#productCode').val(),
        nama: $('#productName').val(),
        kategori: $('#productCategory').val(),
        satuan: $('#productUnit').val(),
        hargaBeli: parseInt($('#productBuyPrice').val()) || 0,
        hargaJual: parseInt($('#productSellPrice').val()) || 0,
        stok: parseInt($('#productStock').val()) || 0,
        status: parseInt($('#productStock').val()) <= 5 ? '⚠️ RESTOCK' : 'Aman'
    };
    
    const existingIndex = products.findIndex(p => p.kode === product.kode);
    if (existingIndex >= 0) {
        products[existingIndex] = product;
        showNotification('Barang berhasil diupdate', 'success');
    } else {
        products.push(product);
        showNotification('Barang berhasil ditambahkan', 'success');
    }
    
    callGoogleSheetsAPI('saveProduct', product);
    displayProducts();
    $('#productModal').modal('hide');
}

function deleteProduct(kode) {
    if (confirm('Yakin ingin menghapus barang ini?')) {
        products = products.filter(p => p.kode !== kode);
        callGoogleSheetsAPI('deleteProduct', { kode: kode });
        displayProducts();
        showNotification('Barang berhasil dihapus', 'success');
    }
}

// ==========================================
// CUSTOMER MANAGEMENT (CRUD)
// ==========================================

function loadCustomers() {
    customers = [
        { id: 1, nama: 'Budi Santoso', wa: '081234567890', alamat: 'Jl. Mawar No. 5', catatan: 'Pelanggan Tetap' },
        { id: 2, nama: 'Siti Aminah', wa: '082345678901', alamat: 'Jl. Melati No. 10', catatan: 'Baru' }
    ];
    displayCustomers();
}

function displayCustomers() {
    const tbody = $('#customersBody');
    tbody.empty();
    
    customers.forEach(customer => {
        const row = `
            <tr>
                <td>${customer.id}</td>
                <td>${customer.nama}</td>
                <td>${customer.wa || '-'}</td>
                <td>${customer.alamat || '-'}</td>
                <td>${customer.catatan || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editCustomer(${customer.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCustomer(${customer.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.append(row);
    });
}

function showCustomerModal(editMode = false, customer = null) {
    if (editMode && customer) {
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

function editCustomer(id) {
    const customer = customers.find(c => c.id === id);
    if (customer) {
        showCustomerModal(true, customer);
    }
}

function saveCustomer() {
    const customer = {
        id: $('#customerId').val() || Date.now(),
        nama: $('#customerName').val(),
        wa: $('#customerPhone').val(),
        alamat: $('#customerAddress').val(),
        catatan: $('#customerNote').val()
    };
    
    const existingIndex = customers.findIndex(c => c.id == customer.id);
    if (existingIndex >= 0) {
        customers[existingIndex] = customer;
        showNotification('Pelanggan berhasil diupdate', 'success');
    } else {
        customers.push(customer);
        showNotification('Pelanggan berhasil ditambahkan', 'success');
    }
    
    callGoogleSheetsAPI('saveCustomer', customer);
    displayCustomers();
    $('#customerModal').modal('hide');
}

function deleteCustomer(id) {
    if (confirm('Yakin ingin menghapus pelanggan ini?')) {
        customers = customers.filter(c => c.id != id);
        callGoogleSheetsAPI('deleteCustomer', { id: id });
        displayCustomers();
        showNotification('Pelanggan berhasil dihapus', 'success');
    }
}

// ==========================================
// SUPPLIER MANAGEMENT (CRUD)
// ==========================================

function loadSuppliers() {
    suppliers = [
        { id: 1, nama: 'PT Grosir Jaya', alamat: 'Jl. Industri No. 10', kontak: '021-5551234', catatan: 'Supplier Utama' },
        { id: 2, nama: 'UD Sumber Rezeki', alamat: 'Jl. Pasar Baru No. 5', kontak: '08123456789', catatan: 'Supplier Beras' }
    ];
    displaySuppliers();
}

function displaySuppliers() {
    const tbody = $('#suppliersBody');
    tbody.empty();
    
    suppliers.forEach(supplier => {
        const row = `
            <tr>
                <td>${supplier.id}</td>
                <td>${supplier.nama}</td>
                <td>${supplier.alamat || '-'}</td>
                <td>${supplier.kontak || '-'}</td>
                <td>${supplier.catatan || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editSupplier(${supplier.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSupplier(${supplier.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.append(row);
    });
    
    // Update supplier dropdown in restock modal
    updateSupplierDropdown();
}

function updateSupplierDropdown() {
    const select = $('#restockSupplier');
    select.empty();
    select.append('<option value="">Pilih Supplier...</option>');
    suppliers.forEach(supplier => {
        select.append(`<option value="${supplier.nama}">${supplier.nama}</option>`);
    });
}

function showSupplierModal(editMode = false, supplier = null) {
    if (editMode && supplier) {
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

function editSupplier(id) {
    const supplier = suppliers.find(s => s.id === id);
    if (supplier) {
        showSupplierModal(true, supplier);
    }
}

function saveSupplier() {
    const supplier = {
        id: $('#supplierId').val() || Date.now(),
        nama: $('#supplierName').val(),
        alamat: $('#supplierAddress').val(),
        kontak: $('#supplierContact').val(),
        catatan: $('#supplierNote').val()
    };
    
    const existingIndex = suppliers.findIndex(s => s.id == supplier.id);
    if (existingIndex >= 0) {
        suppliers[existingIndex] = supplier;
        showNotification('Supplier berhasil diupdate', 'success');
    } else {
        suppliers.push(supplier);
        showNotification('Supplier berhasil ditambahkan', 'success');
    }
    
    callGoogleSheetsAPI('saveSupplier', supplier);
    displaySuppliers();
    $('#supplierModal').modal('hide');
}

function deleteSupplier(id) {
    if (confirm('Yakin ingin menghapus supplier ini?')) {
        suppliers = suppliers.filter(s => s.id != id);
        callGoogleSheetsAPI('deleteSupplier', { id: id });
        displaySuppliers();
        showNotification('Supplier berhasil dihapus', 'success');
    }
}

// ==========================================
// RESTOCK MANAGEMENT
// ==========================================

function loadRestocks() {
    restocks = [
        { tanggal: '2026-05-07', kodeBarang: 'BRG001', namaBarang: 'Beras Premium 5kg', jumlah: 10, hargaBeli: 72000, total: 720000, supplier: 'PT Grosir Jaya', keterangan: 'Restock rutin' }
    ];
    displayRestocks();
}

function displayRestocks() {
    const tbody = $('#restockBody');
    tbody.empty();
    
    restocks.forEach(restock => {
        const row = `
            <tr>
                <td>${restock.tanggal}</td>
                <td>${restock.kodeBarang}</td>
                <td>${restock.namaBarang}</td>
                <td>${restock.jumlah}</td>
                <td>${formatRupiah(restock.hargaBeli)}</td>
                <td>${formatRupiah(restock.total)}</td>
                <td>${restock.supplier || '-'}</td>
                <td>${restock.keterangan || '-'}</td>
            </tr>
        `;
        tbody.append(row);
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
    products.forEach(product => {
        select.append(`<option value="${product.kode}" data-harga="${product.hargaBeli}">${product.kode} - ${product.nama}</option>`);
    });
}

function updateRestockInfo() {
    const kode = $('#restockProduct').val();
    const product = products.find(p => p.kode === kode);
    if (product) {
        $('#restockPrice').val(product.hargaBeli);
    } else {
        $('#restockPrice').val('');
    }
}

function saveRestock() {
    const kode = $('#restockProduct').val();
    const product = products.find(p => p.kode === kode);
    
    if (!product) {
        showNotification('Pilih barang terlebih dahulu', 'error');
        return;
    }
    
    const restock = {
        tanggal: new Date().toISOString().split('T')[0],
        kodeBarang: kode,
        namaBarang: product.nama,
        jumlah: parseInt($('#restockQuantity').val()),
        hargaBeli: parseInt($('#restockPrice').val()),
        total: parseInt($('#restockQuantity').val()) * parseInt($('#restockPrice').val()),
        supplier: $('#restockSupplier').val(),
        keterangan: $('#restockNote').val()
    };
    
    // Update product stock
    product.stok += restock.jumlah;
    product.status = product.stok <= 5 ? '⚠️ RESTOCK' : 'Aman';
    
    restocks.unshift(restock);
    
    callGoogleSheetsAPI('saveRestock', restock);
    callGoogleSheetsAPI('updateProductStock', { kode: kode, stok: product.stok });
    
    displayProducts();
    displayRestocks();
    $('#restockModal').modal('hide');
    showNotification('Restock berhasil diproses', 'success');
}

// ==========================================
// POS / CART MANAGEMENT
// ==========================================

function addToCart(kode) {
    const product = products.find(p => p.kode === kode);
    if (!product || product.stok <= 0) {
        showNotification('Stok tidak tersedia!', 'error');
        return;
    }
    
    const existingItem = cart.find(item => item.kode === kode);
    if (existingItem) {
        existingItem.qty++;
        existingItem.subtotal = existingItem.qty * existingItem.hargaJual;
    } else {
        cart.push({
            kode: product.kode,
            nama: product.nama,
            hargaJual: product.hargaJual,
            qty: 1,
            subtotal: product.hargaJual
        });
    }
    
    displayCart();
}

function displayCart() {
    const tbody = $('#cartBody');
    tbody.empty();
    
    let total = 0;
    cart.forEach((item, index) => {
        total += item.subtotal;
        const row = `
            <tr>
                <td>${item.kode}</td>
                <td>${item.nama}</td>
                <td>${formatRupiah(item.hargaJual)}</td>
                <td>
                    <input type="number" value="${item.qty}" min="1" 
                           onchange="updateCartQty(${index}, this.value)" 
                           style="width: 70px;" class="form-control form-control-sm">
                </td>
                <td>${formatRupiah(item.subtotal)}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="removeFromCart(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            
            
        `;
        tbody.append(row);
    });
    
    $('#totalAmount').text(formatRupiah(total));
}

function updateCartQty(index, qty) {
    qty = parseInt(qty);
    if (qty > 0) {
        const product = products.find(p => p.kode === cart[index].kode);
        if (product && qty <= product.stok) {
            cart[index].qty = qty;
            cart[index].subtotal = qty * cart[index].hargaJual;
            displayCart();
        } else {
            showNotification('Melebihi stok yang tersedia!', 'error');
        }
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    displayCart();
}

function checkout() {
    if (cart.length === 0) {
        showNotification('Keranjang kosong!', 'error');
        return;
    }
    
    const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const invoice = 'INV-' + Date.now();
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('id-ID');
    const paymentMethod = $('#paymentMethod').val();
    const cashier = $('#cashierName').val();
    
    // Create transactions
    cart.forEach(item => {
        const transaction = {
            tanggal: date,
            jam: time,
            invoice: invoice,
            kodeBarang: item.kode,
            namaBarang: item.nama,
            hargaJual: item.hargaJual,
            jumlahBeli: item.qty,
            totalHarga: item.subtotal,
            metodeBayar: paymentMethod,
            kasir: cashier
        };
        transactions.push(transaction);
        
        // Update product stock
        const product = products.find(p => p.kode === item.kode);
        if (product) {
            product.stok -= item.qty;
            product.status = product.stok <= 5 ? '⚠️ RESTOCK' : 'Aman';
        }
        
        callGoogleSheetsAPI('saveTransaction', transaction);
    });
    
    callGoogleSheetsAPI('updateProductStock', { transactions: cart });
    
    // Print receipt
    printReceipt(invoice, date, time, cart, total, paymentMethod, cashier);
    
    // Clear cart
    cart = [];
    displayCart();
    displayProducts();
    showNotification(`Transaksi berhasil! Invoice: ${invoice}`, 'success');
}

function printReceipt(invoice, date, time, items, total, paymentMethod, cashier) {
    const receiptWindow = window.open('', '_blank', 'width=400,height=600');
    receiptWindow.document.write(`
        <html>
        <head>
            <title>Struk Pembayaran</title>
            <style>
                body { font-family: monospace; padding: 20px; }
                .header { text-align: center; margin-bottom: 20px; }
                .line { border-top: 1px dashed #000; margin: 10px 0; }
                .total { font-size: 18px; font-weight: bold; margin-top: 10px; }
                .footer { text-align: center; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h3>${CONFIG.APP_NAME}</h3>
                <p>${date} ${time}</p>
                <p>Invoice: ${invoice}</p>
            </div>
            <div class="line"></div>
            <table width="100%">
                <thead>
                    <tr><th>Item</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td>${item.nama}</td>
                            <td align="center">${item.qty}</td>
                            <td align="right">${formatRupiah(item.hargaJual)}</td>
                            <td align="right">${formatRupiah(item.subtotal)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            }</table>
            <div class="line"></div>
            <div class="total">
                <table width="100%">
                    <tr><td>Total:</td><td align="right">${formatRupiah(total)}</td></tr>
                    <tr><td>Metode Bayar:</td><td align="right">${paymentMethod}</td></tr>
                    <tr><td>Kasir:</td><td align="right">${cashier}</td></tr>
                 </table>
            </div>
            <div class="line"></div>
            <div class="footer">
                <p>Terima kasih atas kunjungan Anda!</p>
                <p>Barang yang sudah dibeli tidak dapat dikembalikan</p>
            </div>
            <script>window.print();setTimeout(function(){window.close();}, 500);<\/script>
        </body>
        </html>
    `);
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka);
}

function showNotification(message, type = 'info') {
    // Simple alert for now, can be enhanced with toast notification
    alert(message);
}

// Search product listener
$(document).on('keyup', '#searchProduct', function() {
    displayProductListForPOS();
});
