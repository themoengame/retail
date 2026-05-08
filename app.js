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

async function loadAllData() {
    showLoading(true);
    try {
        await Promise.all([
            loadProducts(),
            loadCustomers(),
            loadSuppliers(),
            loadRestocks()
        ]);
        console.log('✅ Semua data berhasil dimuat dari Google Sheets');
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Gagal memuat data dari Google Sheets. Pastikan koneksi internet Anda aktif.');
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    $('#loadingOverlay').toggle(show);
}

// ==========================================
// GOOGLE SHEETS API - LANGSUNG PAKAI JSON
// ==========================================

async function callGoogleSheetsAPI(action, sheetName, data = null, rowIndex = null) {
    try {
        const payload = {
            action: action,
            sheet: sheetName
        };
        
        if (action === 'append' && data) {
            payload.row = data;
        } else if (action === 'update' && data && rowIndex) {
            payload.row = data;
            payload.rowIndex = rowIndex;
        } else if (action === 'delete' && rowIndex) {
            payload.rowIndex = rowIndex;
        }
        
        const response = await fetch(CONFIG.WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

async function fetchSheetData(sheetName) {
    try {
        const response = await fetch(CONFIG.WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'get',
                sheet: sheetName
            })
        });
        
        const result = await response.json();
        if (result.success) {
            return result.data;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error(`Error fetching ${sheetName}:`, error);
        throw error;
    }
}

// ==========================================
// PRODUCT MANAGEMENT - LANGSUNG KE SHEETS
// ==========================================

let products = [];

async function loadProducts() {
    const data = await fetchSheetData(CONFIG.SHEET_NAMES.MASTER_BARANG);
    products = data.map(row => ({
        kode: row['Kode Barang'] || '',
        nama: row['Nama Barang'] || '',
        kategori: row['Kategori'] || '',
        satuan: row['Satuan'] || '',
        hargaBeli: parseInt(row['Harga Beli Modal']) || 0,
        hargaJual: parseInt(row['Harga Jual']) || 0,
        stokAwal: parseInt(row['Stok Awal']) || 0,
        stokSaatIni: parseInt(row['Stok Saat Ini']) || 0,
        statusStok: row['Status Stok'] || '✅ Aman'
    }));
    displayProducts();
}

function displayProducts() {
    const tbody = $('#productsBody');
    tbody.empty();
    
    products.forEach((product) => {
        const row = `
            <tr>
                <td>${product.kode}${product.nama}${product.kategori || '-'}${product.satuan || '-'}${formatRupiah(product.hargaBeli)}${formatRupiah(product.hargaJual)}${product.stokSaatIni}
                <td class="${product.statusStok === '⚠️ RESTOCK' ? 'text-danger fw-bold' : 'text-success'}">${product.statusStok}
                <td>
                    <button class="btn btn-sm btn-warning" onclick='editProduct(${JSON.stringify(product)})'><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product.kode}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
        tbody.append(row);
    });
    
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
                <td>${product.kode}${product.nama}${formatRupiah(product.hargaJual)}${product.stokSaatIni}
                <td>
                    <button class="btn btn-sm btn-success" onclick="addToCart('${product.kode}')" ${product.stokSaatIni <= 0 ? 'disabled' : ''}>
                        <i class="fas fa-plus"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.append(row);
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
        // Generate kode otomatis
        const lastKode = products[products.length - 1]?.kode || 'BRG000';
        const newNum = parseInt(lastKode.replace('BRG', '')) + 1;
        $('#productCode').val('BRG' + String(newNum).padStart(3, '0'));
    }
    $('#productModal').modal('show');
}

async function saveProduct() {
    const kode = $('#productCode').val();
    const stokAwal = parseInt($('#productStock').val()) || 0;
    
    const productData = [
        kode,
        $('#productName').val(),
        $('#productCategory').val(),
        $('#productUnit').val(),
        parseInt($('#productBuyPrice').val()) || 0,
        parseInt($('#productSellPrice').val()) || 0,
        stokAwal,
        stokAwal,
        stokAwal <= 5 ? '⚠️ RESTOCK' : '✅ Aman'
    ];
    
    const existingIndex = products.findIndex(p => p.kode === kode);
    let result;
    
    if (existingIndex >= 0) {
        // Update existing product
        result = await callGoogleSheetsAPI('update', CONFIG.SHEET_NAMES.MASTER_BARANG, productData, existingIndex + 2);
        if (result.success) {
            products[existingIndex] = {
                kode: productData[0], nama: productData[1], kategori: productData[2],
                satuan: productData[3], hargaBeli: productData[4], hargaJual: productData[5],
                stokAwal: productData[6], stokSaatIni: productData[7], statusStok: productData[8]
            };
            alert('Barang berhasil diupdate');
        }
    } else {
        // Add new product
        result = await callGoogleSheetsAPI('append', CONFIG.SHEET_NAMES.MASTER_BARANG, productData);
        if (result.success) {
            products.push({
                kode: productData[0], nama: productData[1], kategori: productData[2],
                satuan: productData[3], hargaBeli: productData[4], hargaJual: productData[5],
                stokAwal: productData[6], stokSaatIni: productData[7], statusStok: productData[8]
            });
            alert('Barang berhasil ditambahkan');
        }
    }
    
    if (result?.success) {
        displayProducts();
        $('#productModal').modal('hide');
    } else {
        alert('Gagal menyimpan data: ' + (result?.error || 'Unknown error'));
    }
}

async function deleteProduct(kode) {
    if (!confirm('Yakin ingin menghapus barang ini?')) return;
    
    const index = products.findIndex(p => p.kode === kode);
    if (index >= 0) {
        const result = await callGoogleSheetsAPI('delete', CONFIG.SHEET_NAMES.MASTER_BARANG, null, index + 2);
        if (result.success) {
            products.splice(index, 1);
            displayProducts();
            alert('Barang berhasil dihapus');
        } else {
            alert('Gagal menghapus data');
        }
    }
}

// ==========================================
// CUSTOMER MANAGEMENT
// ==========================================

let customers = [];

async function loadCustomers() {
    const data = await fetchSheetData(CONFIG.SHEET_NAMES.PELANGGAN);
    customers = data.map(row => ({
        nama: row['Nama'] || '',
        wa: row['No. WA'] || '',
        alamat: row['Alamat'] || '',
        catatan: row['Catatan'] || ''
    }));
    displayCustomers();
}

function displayCustomers() {
    const tbody = $('#customersBody');
    tbody.empty();
    
    customers.forEach((customer, index) => {
        const row = `
            <tr>
                <td>${customer.nama}${customer.wa || '-'}${customer.alamat || '-'}${customer.catatan || '-'}
                <td>
                    <button class="btn btn-sm btn-warning" onclick='editCustomer(${index})'><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCustomer(${index})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
        tbody.append(row);
    });
}

function showCustomerModal(index = null) {
    if (index !== null && customers[index]) {
        $('#customerId').val(index);
        $('#customerName').val(customers[index].nama);
        $('#customerPhone').val(customers[index].wa);
        $('#customerAddress').val(customers[index].alamat);
        $('#customerNote').val(customers[index].catatan);
    } else {
        $('#customerModal input, #customerModal textarea').val('');
        $('#customerId').val('');
    }
    $('#customerModal').modal('show');
}

async function saveCustomer() {
    const customerData = [
        $('#customerName').val(),
        $('#customerPhone').val(),
        $('#customerAddress').val(),
        $('#customerNote').val()
    ];
    
    const id = $('#customerId').val();
    let result;
    
    if (id !== '') {
        // Update existing
        result = await callGoogleSheetsAPI('update', CONFIG.SHEET_NAMES.PELANGGAN, customerData, parseInt(id) + 2);
        if (result.success) {
            customers[parseInt(id)] = {
                nama: customerData[0], wa: customerData[1], alamat: customerData[2], catatan: customerData[3]
            };
            alert('Pelanggan berhasil diupdate');
        }
    } else {
        // Add new
        result = await callGoogleSheetsAPI('append', CONFIG.SHEET_NAMES.PELANGGAN, customerData);
        if (result.success) {
            customers.push({
                nama: customerData[0], wa: customerData[1], alamat: customerData[2], catatan: customerData[3]
            });
            alert('Pelanggan berhasil ditambahkan');
        }
    }
    
    if (result?.success) {
        displayCustomers();
        $('#customerModal').modal('hide');
    } else {
        alert('Gagal menyimpan data');
    }
}

async function deleteCustomer(index) {
    if (!confirm('Yakin ingin menghapus pelanggan ini?')) return;
    
    const result = await callGoogleSheetsAPI('delete', CONFIG.SHEET_NAMES.PELANGGAN, null, index + 2);
    if (result.success) {
        customers.splice(index, 1);
        displayCustomers();
        alert('Pelanggan berhasil dihapus');
    } else {
        alert('Gagal menghapus data');
    }
}

// ==========================================
// SUPPLIER MANAGEMENT
// ==========================================

let suppliers = [];

async function loadSuppliers() {
    const data = await fetchSheetData(CONFIG.SHEET_NAMES.SUPPLIER);
    suppliers = data.map(row => ({
        nama: row['Nama'] || '',
        alamat: row['Alamat'] || '',
        kontak: row['Kontak'] || '',
        catatan: row['Catatan'] || ''
    }));
    displaySuppliers();
}

function displaySuppliers() {
    const tbody = $('#suppliersBody');
    tbody.empty();
    
    suppliers.forEach((supplier, index) => {
        const row = `
            <tr>
                <td>${supplier.nama}${supplier.alamat || '-'}${supplier.kontak || '-'}${supplier.catatan || '-'}
                <td>
                    <button class="btn btn-sm btn-warning" onclick='editSupplier(${index})'><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSupplier(${index})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
        tbody.append(row);
    });
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

function showSupplierModal(index = null) {
    if (index !== null && suppliers[index]) {
        $('#supplierId').val(index);
        $('#supplierName').val(suppliers[index].nama);
        $('#supplierAddress').val(suppliers[index].alamat);
        $('#supplierContact').val(suppliers[index].kontak);
        $('#supplierNote').val(suppliers[index].catatan);
    } else {
        $('#supplierModal input, #supplierModal textarea').val('');
        $('#supplierId').val('');
    }
    $('#supplierModal').modal('show');
}

async function saveSupplier() {
    const supplierData = [
        $('#supplierName').val(),
        $('#supplierAddress').val(),
        $('#supplierContact').val(),
        $('#supplierNote').val()
    ];
    
    const id = $('#supplierId').val();
    let result;
    
    if (id !== '') {
        result = await callGoogleSheetsAPI('update', CONFIG.SHEET_NAMES.SUPPLIER, supplierData, parseInt(id) + 2);
        if (result.success) {
            suppliers[parseInt(id)] = {
                nama: supplierData[0], alamat: supplierData[1], kontak: supplierData[2], catatan: supplierData[3]
            };
            alert('Supplier berhasil diupdate');
        }
    } else {
        result = await callGoogleSheetsAPI('append', CONFIG.SHEET_NAMES.SUPPLIER, supplierData);
        if (result.success) {
            suppliers.push({
                nama: supplierData[0], alamat: supplierData[1], kontak: supplierData[2], catatan: supplierData[3]
            });
            alert('Supplier berhasil ditambahkan');
        }
    }
    
    if (result?.success) {
        displaySuppliers();
        $('#supplierModal').modal('hide');
    } else {
        alert('Gagal menyimpan data');
    }
}

async function deleteSupplier(index) {
    if (!confirm('Yakin ingin menghapus supplier ini?')) return;
    
    const result = await callGoogleSheetsAPI('delete', CONFIG.SHEET_NAMES.SUPPLIER, null, index + 2);
    if (result.success) {
        suppliers.splice(index, 1);
        displaySuppliers();
        alert('Supplier berhasil dihapus');
    } else {
        alert('Gagal menghapus data');
    }
}

// ==========================================
// RESTOCK MANAGEMENT
// ==========================================

let restocks = [];

async function loadRestocks() {
    const data = await fetchSheetData(CONFIG.SHEET_NAMES.PEMBELIAN_RESTOCK);
    restocks = data.map(row => ({
        tanggal: row['Tanggal'] || '',
        kodeBarang: row['Kode Barang'] || '',
        namaBarang: row['Nama Barang'] || '',
        jumlah: parseInt(row['Jumlah Masuk']) || 0,
        hargaBeli: parseInt(row['Harga Beli Satuan']) || 0,
        total: parseInt(row['Total Modal']) || 0,
        supplier: row['Nama Supplier'] || '',
        keterangan: row['Keterangan'] || ''
    }));
    displayRestocks();
}

function displayRestocks() {
    const tbody = $('#restockBody');
    tbody.empty();
    
    restocks.forEach(restock => {
        const row = `
            <tr>
                <td>${restock.tanggal}${restock.kodeBarang}${restock.namaBarang}${restock.jumlah}${formatRupiah(restock.hargaBeli)}${formatRupiah(restock.total)}${restock.supplier || '-'}${restock.keterangan || '-'}
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
        select.append(`<option value="${product.kode}" data-harga="${product.hargaBeli}">${product.kode} - ${product.nama} (Stok: ${product.stokSaatIni})</option>`);
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

async function saveRestock() {
    const kode = $('#restockProduct').val();
    const product = products.find(p => p.kode === kode);
    
    if (!product) {
        alert('Pilih barang terlebih dahulu');
        return;
    }
    
    const jumlah = parseInt($('#restockQuantity').val());
    const hargaBeli = parseInt($('#restockPrice').val());
    const total = jumlah * hargaBeli;
    
    const restockData = [
        new Date().toISOString().split('T')[0],
        kode,
        product.nama,
        jumlah,
        hargaBeli,
        total,
        $('#restockSupplier').val(),
        $('#restockNote').val()
    ];
    
    // Save restock
    const restockResult = await callGoogleSheetsAPI('append', CONFIG.SHEET_NAMES.PEMBELIAN_RESTOCK, restockData);
    
    if (restockResult.success) {
        // Update product stock
        const newStok = product.stokSaatIni + jumlah;
        const statusStok = newStok <= 5 ? '⚠️ RESTOCK' : '✅ Aman';
        
        const productIndex = products.findIndex(p => p.kode === kode);
        const updatedProductData = [
            product.kode, product.nama, product.kategori, product.satuan,
            product.hargaBeli, product.hargaJual, product.stokAwal,
            newStok, statusStok
        ];
        
        const updateResult = await callGoogleSheetsAPI('update', CONFIG.SHEET_NAMES.MASTER_BARANG, updatedProductData, productIndex + 2);
        
        if (updateResult.success) {
            product.stokSaatIni = newStok;
            product.statusStok = statusStok;
            
            restocks.unshift({
                tanggal: restockData[0], kodeBarang: kode, namaBarang: product.nama,
                jumlah: jumlah, hargaBeli: hargaBeli, total: total,
                supplier: restockData[6], keterangan: restockData[7]
            });
            
            displayProducts();
            displayRestocks();
            $('#restockModal').modal('hide');
            alert('Restock berhasil diproses');
        }
    } else {
        alert('Gagal menyimpan data restock');
    }
}

// ==========================================
// POS / CART MANAGEMENT
// ==========================================

let cart = [];

function addToCart(kode) {
    const product = products.find(p => p.kode === kode);
    if (!product || product.stokSaatIni <= 0) {
        alert('Stok tidak tersedia!');
        return;
    }
    
    const existingItem = cart.find(item => item.kode === kode);
    if (existingItem) {
        if (existingItem.qty + 1 <= product.stokSaatIni) {
            existingItem.qty++;
            existingItem.subtotal = existingItem.qty * existingItem.hargaJual;
        } else {
            alert('Stok tidak mencukupi!');
        }
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
                <td>${item.kode}${item.nama}${formatRupiah(item.hargaJual)}
                <td>
                    <input type="number" value="${item.qty}" min="1" 
                           onchange="updateCartQty(${index}, this.value)" 
                           style="width: 70px;" class="form-control form-control-sm">
                  
                <td>${formatRupiah(item.subtotal)}
                <td>
                    <button class="btn btn-sm btn-danger" onclick="removeFromCart(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                 </td>
            </tr>
        `;
        tbody.append(row);
    });
    
    $('#totalAmount').text(formatRupiah(total));
}

function updateCartQty(index, qty) {
    qty = parseInt(qty);
    if (qty > 0) {
        const product = products.find(p => p.kode === cart[index].kode);
        if (product && qty <= product.stokSaatIni) {
            cart[index].qty = qty;
            cart[index].subtotal = qty * cart[index].hargaJual;
            displayCart();
        } else {
            alert('Melebihi stok yang tersedia!');
        }
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    displayCart();
}

async function checkout() {
    if (cart.length === 0) {
        alert('Keranjang kosong!');
        return;
    }
    
    const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const invoice = 'INV-' + Date.now();
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('id-ID');
    const paymentMethod = $('#paymentMethod').val();
    const cashier = $('#cashierName').val();
    
    let allSuccess = true;
    
    for (const item of cart) {
        const transactionData = [
            date, time, invoice, item.kode, item.nama,
            item.hargaJual, item.qty, item.subtotal, paymentMethod, cashier
        ];
        
        const result = await callGoogleSheetsAPI('append', CONFIG.SHEET_NAMES.TRANSAKSI_PENJUALAN, transactionData);
        
        if (!result.success) {
            allSuccess = false;
            break;
        }
        
        // Update stock
        const product = products.find(p => p.kode === item.kode);
        if (product) {
            const newStok = product.stokSaatIni - item.qty;
            const statusStok = newStok <= 5 ? '⚠️ RESTOCK' : '✅ Aman';
            
            const productIndex = products.findIndex(p => p.kode === item.kode);
            const updatedProductData = [
                product.kode, product.nama, product.kategori, product.satuan,
                product.hargaBeli, product.hargaJual, product.stokAwal,
                newStok, statusStok
            ];
            
            const updateResult = await callGoogleSheetsAPI('update', CONFIG.SHEET_NAMES.MASTER_BARANG, updatedProductData, productIndex + 2);
            
            if (updateResult.success) {
                product.stokSaatIni = newStok;
                product.statusStok = statusStok;
            }
        }
    }
    
    if (allSuccess) {
        printReceipt(invoice, date, time, cart, total, paymentMethod, cashier);
        cart = [];
        displayCart();
        displayProducts();
        alert(`Transaksi berhasil! Invoice: ${invoice}`);
    } else {
        alert('Gagal memproses transaksi');
    }
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
                <thead><tr><th>Item</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
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
            </table>
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
    if (!angka) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka);
}

// Edit functions
function editProduct(product) { showProductModal(product); }
function editCustomer(index) { showCustomerModal(index); }
function editSupplier(index) { showSupplierModal(index); }
