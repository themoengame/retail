// ==========================================
// INITIALIZATION
// ==========================================

$(document).ready(function() {
    loadAllData();
    updateClock();
    setInterval(updateClock, 1000);
    
    // Search product listener
    $(document).on('keyup', '#searchProduct', function() {
        displayProductListForPOS();
    });
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
            loadRestocks(),
            loadTransactions()
        ]);
        showNotification('Data berhasil dimuat dari Google Sheets', 'success');
    } catch (error) {
        console.error('Error loading data:', error);
        showNotification('Gagal memuat data dari Google Sheets', 'error');
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    if (show) {
        $('#loadingOverlay').show();
    } else {
        $('#loadingOverlay').hide();
    }
}

// ==========================================
// GOOGLE SHEETS API INTEGRATION
// ==========================================

async function fetchSheetData(sheetName) {
    try {
        const response = await fetch(CONFIG.WEB_APP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'cors',
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
        return [];
    }
}

async function saveToSheet(sheetName, rowData, action = 'append', rowIndex = null) {
    try {
        const payload = {
            action: action,
            sheet: sheetName,
            row: rowData
        };
        
        if (action === 'update' && rowIndex) {
            payload.rowIndex = rowIndex;
        } else if (action === 'delete' && rowIndex) {
            payload.rowIndex = rowIndex;
        }
        
        const response = await fetch(CONFIG.WEB_APP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'cors',
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        return result.success;
    } catch (error) {
        console.error('Error saving to sheet:', error);
        showNotification('Gagal menyimpan data', 'error');
        return false;
    }
}

// ==========================================
// PRODUCT MANAGEMENT (CRUD)
// ==========================================

async function loadProducts() {
    const data = await fetchSheetData(CONFIG.SHEET_NAMES.MASTER_BARANG);
    dataCache.products = data.map(row => ({
        kode: row['Kode Barang'] || '',
        nama: row['Nama Barang'] || '',
        kategori: row['Kategori'] || '',
        satuan: row['Satuan'] || '',
        hargaBeli: parseInt(row['Harga Beli Modal']) || 0,
        hargaJual: parseInt(row['Harga Jual']) || 0,
        stokAwal: parseInt(row['Stok Awal']) || 0,
        stokSaatIni: parseInt(row['Stok Saat Ini']) || 0,
        statusStok: row['Status Stok'] || 'Aman'
    }));
    displayProducts();
}

function displayProducts() {
    const tbody = $('#productsBody');
    tbody.empty();
    
    dataCache.products.forEach((product, index) => {
        const row = `
            <tr>
                <td>${product.kode}</td>
                <td>${product.nama}</td>
                <td>${product.kategori || '-'}</td>
                <td>${product.satuan || '-'}</td>
                <td>${formatRupiah(product.hargaBeli)}</td>
                <td>${formatRupiah(product.hargaJual)}</td>
                <td>${product.stokSaatIni}</td>
                <td class="${product.statusStok === '⚠️ RESTOCK' ? 'text-danger fw-bold' : 'text-success'}">${product.statusStok}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick='editProduct(${JSON.stringify(product)})'>
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
    
    displayProductListForPOS();
}

function displayProductListForPOS() {
    const searchTerm = $('#searchProduct').val().toLowerCase();
    const filtered = dataCache.products.filter(p => 
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
                <td>${product.stokSaatIni}</td>
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
        $('#productStokSaatIni').val(product.stokSaatIni);
        $('#productBuyPrice').val(product.hargaBeli);
        $('#productSellPrice').val(product.hargaJual);
        $('#productCode').prop('readonly', true);
    } else {
        $('#productModal input').val('');
        $('#productKode').val('');
        $('#productCode').prop('readonly', false);
        $('#productCode').val('BRG' + String(dataCache.products.length + 1).padStart(3, '0'));
        $('#productStokSaatIni').val(0);
    }
    $('#productModal').modal('show');
}

async function saveProduct() {
    const kode = $('#productCode').val();
    const stokAwal = parseInt($('#productStock').val()) || 0;
    const stokSaatIni = $('#productStokSaatIni').val() ? parseInt($('#productStokSaatIni').val()) : stokAwal;
    
    const product = {
        'Kode Barang': kode,
        'Nama Barang': $('#productName').val(),
        'Kategori': $('#productCategory').val(),
        'Satuan': $('#productUnit').val(),
        'Harga Beli Modal': parseInt($('#productBuyPrice').val()) || 0,
        'Harga Jual': parseInt($('#productSellPrice').val()) || 0,
        'Stok Awal': stokAwal,
        'Stok Saat Ini': stokSaatIni,
        'Status Stok': stokSaatIni <= 5 ? '⚠️ RESTOCK' : '✅ Aman'
    };
    
    const existingIndex = dataCache.products.findIndex(p => p.kode === kode);
    
    let success;
    if (existingIndex >= 0) {
        // Update existing
        success = await saveToSheet(CONFIG.SHEET_NAMES.MASTER_BARANG, 
            Object.values(product), 'update', existingIndex + 2);
        if (success) {
            dataCache.products[existingIndex] = {
                kode: product['Kode Barang'],
                nama: product['Nama Barang'],
                kategori: product['Kategori'],
                satuan: product['Satuan'],
                hargaBeli: product['Harga Beli Modal'],
                hargaJual: product['Harga Jual'],
                stokAwal: product['Stok Awal'],
                stokSaatIni: product['Stok Saat Ini'],
                statusStok: product['Status Stok']
            };
            showNotification('Barang berhasil diupdate', 'success');
        }
    } else {
        // Add new
        success = await saveToSheet(CONFIG.SHEET_NAMES.MASTER_BARANG, 
            Object.values(product), 'append');
        if (success) {
            dataCache.products.push({
                kode: product['Kode Barang'],
                nama: product['Nama Barang'],
                kategori: product['Kategori'],
                satuan: product['Satuan'],
                hargaBeli: product['Harga Beli Modal'],
                hargaJual: product['Harga Jual'],
                stokAwal: product['Stok Awal'],
                stokSaatIni: product['Stok Saat Ini'],
                statusStok: product['Status Stok']
            });
            showNotification('Barang berhasil ditambahkan', 'success');
        }
    }
    
    if (success) {
        displayProducts();
        $('#productModal').modal('hide');
    }
}

async function deleteProduct(kode) {
    if (confirm('Yakin ingin menghapus barang ini?')) {
        const index = dataCache.products.findIndex(p => p.kode === kode);
        if (index >= 0) {
            const success = await saveToSheet(CONFIG.SHEET_NAMES.MASTER_BARANG, 
                null, 'delete', index + 2);
            if (success) {
                dataCache.products.splice(index, 1);
                displayProducts();
                showNotification('Barang berhasil dihapus', 'success');
            }
        }
    }
}

// ==========================================
// CUSTOMER MANAGEMENT (CRUD)
// ==========================================

async function loadCustomers() {
    const data = await fetchSheetData(CONFIG.SHEET_NAMES.PELANGGAN);
    dataCache.customers = data.map((row, idx) => ({
        id: idx + 1,
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
    
    dataCache.customers.forEach((customer, index) => {
        const row = `
            <tr>
                <td>${customer.id}</td>
                <td>${customer.nama}</td>
                <td>${customer.wa || '-'}</td>
                <td>${customer.alamat || '-'}</td>
                <td>${customer.catatan || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick='editCustomer(${JSON.stringify(customer)})'>
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCustomer(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.append(row);
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

async function saveCustomer() {
    const customer = {
        'Nama': $('#customerName').val(),
        'No. WA': $('#customerPhone').val(),
        'Alamat': $('#customerAddress').val(),
        'Catatan': $('#customerNote').val()
    };
    
    const id = $('#customerId').val();
    let success;
    
    if (id) {
        // Update existing
        const index = parseInt(id) - 1;
        success = await saveToSheet(CONFIG.SHEET_NAMES.PELANGGAN, 
            Object.values(customer), 'update', index + 2);
        if (success) {
            dataCache.customers[index] = {
                id: parseInt(id),
                nama: customer['Nama'],
                wa: customer['No. WA'],
                alamat: customer['Alamat'],
                catatan: customer['Catatan']
            };
            showNotification('Pelanggan berhasil diupdate', 'success');
        }
    } else {
        // Add new
        success = await saveToSheet(CONFIG.SHEET_NAMES.PELANGGAN, 
            Object.values(customer), 'append');
        if (success) {
            dataCache.customers.push({
                id: dataCache.customers.length + 1,
                nama: customer['Nama'],
                wa: customer['No. WA'],
                alamat: customer['Alamat'],
                catatan: customer['Catatan']
            });
            showNotification('Pelanggan berhasil ditambahkan', 'success');
        }
    }
    
    if (success) {
        displayCustomers();
        $('#customerModal').modal('hide');
    }
}

async function deleteCustomer(index) {
    if (confirm('Yakin ingin menghapus pelanggan ini?')) {
        const success = await saveToSheet(CONFIG.SHEET_NAMES.PELANGGAN, 
            null, 'delete', index + 2);
        if (success) {
            dataCache.customers.splice(index, 1);
            // Re-index IDs
            dataCache.customers.forEach((c, i) => c.id = i + 1);
            displayCustomers();
            showNotification('Pelanggan berhasil dihapus', 'success');
        }
    }
}

// ==========================================
// SUPPLIER MANAGEMENT (CRUD)
// ==========================================

async function loadSuppliers() {
    const data = await fetchSheetData(CONFIG.SHEET_NAMES.SUPPLIER);
    dataCache.suppliers = data.map((row, idx) => ({
        id: idx + 1,
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
    
    dataCache.suppliers.forEach((supplier, index) => {
        const row = `
            <tr>
                <td>${supplier.id}</td>
                <td>${supplier.nama}</td>
                <td>${supplier.alamat || '-'}</td>
                <td>${supplier.kontak || '-'}</td>
                <td>${supplier.catatan || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick='editSupplier(${JSON.stringify(supplier)})'>
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSupplier(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
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

async function saveSupplier() {
    const supplier = {
        'Nama': $('#supplierName').val(),
        'Alamat': $('#supplierAddress').val(),
        'Kontak': $('#supplierContact').val(),
        'Catatan': $('#supplierNote').val()
    };
    
    const id = $('#supplierId').val();
    let success;
    
    if (id) {
        // Update existing
        const index = parseInt(id) - 1;
        success = await saveToSheet(CONFIG.SHEET_NAMES.SUPPLIER, 
            Object.values(supplier), 'update', index + 2);
        if (success) {
            dataCache.suppliers[index] = {
                id: parseInt(id),
                nama: supplier['Nama'],
                alamat: supplier['Alamat'],
                kontak: supplier['Kontak'],
                catatan: supplier['Catatan']
            };
            showNotification('Supplier berhasil diupdate', 'success');
        }
    } else {
        // Add new
        success = await saveToSheet(CONFIG.SHEET_NAMES.SUPPLIER, 
            Object.values(supplier), 'append');
        if (success) {
            dataCache.suppliers.push({
                id: dataCache.suppliers.length + 1,
                nama: supplier['Nama'],
                alamat: supplier['Alamat'],
                kontak: supplier['Kontak'],
                catatan: supplier['Catatan']
            });
            showNotification('Supplier berhasil ditambahkan', 'success');
        }
    }
    
    if (success) {
        displaySuppliers();
        $('#supplierModal').modal('hide');
    }
}

async function deleteSupplier(index) {
    if (confirm('Yakin ingin menghapus supplier ini?')) {
        const success = await saveToSheet(CONFIG.SHEET_NAMES.SUPPLIER, 
            null, 'delete', index + 2);
        if (success) {
            dataCache.suppliers.splice(index, 1);
            dataCache.suppliers.forEach((s, i) => s.id = i + 1);
            displaySuppliers();
            showNotification('Supplier berhasil dihapus', 'success');
        }
    }
}

// ==========================================
// RESTOCK MANAGEMENT
// ==========================================

async function loadRestocks() {
    const data = await fetchSheetData(CONFIG.SHEET_NAMES.PEMBELIAN_RESTOCK);
    dataCache.restocks = data.map(row => ({
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
    
    dataCache.restocks.forEach(restock => {
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
    dataCache.products.forEach(product => {
        select.append(`<option value="${product.kode}" data-harga="${product.hargaBeli}">${product.kode} - ${product.nama}</option>`);
    });
}

function updateRestockInfo() {
    const kode = $('#restockProduct').val();
    const product = dataCache.products.find(p => p.kode === kode);
    if (product) {
        $('#restockPrice').val(product.hargaBeli);
    } else {
        $('#restockPrice').val('');
    }
}

async function saveRestock() {
    const kode = $('#restockProduct').val();
    const product = dataCache.products.find(p => p.kode === kode);
    
    if (!product) {
        showNotification('Pilih barang terlebih dahulu', 'error');
        return;
    }
    
    const jumlah = parseInt($('#restockQuantity').val());
    const hargaBeli = parseInt($('#restockPrice').val());
    const total = jumlah * hargaBeli;
    
    const restock = {
        'Tanggal': new Date().toISOString().split('T')[0],
        'Kode Barang': kode,
        'Nama Barang': product.nama,
        'Jumlah Masuk': jumlah,
        'Harga Beli Satuan': hargaBeli,
        'Total Modal': total,
        'Nama Supplier': $('#restockSupplier').val(),
        'Keterangan': $('#restockNote').val()
    };
    
    // Save restock to sheet
    const success = await saveToSheet(CONFIG.SHEET_NAMES.PEMBELIAN_RESTOCK, 
        Object.values(restock), 'append');
    
    if (success) {
        // Update product stock
        const newStok = product.stokSaatIni + jumlah;
        const statusStok = newStok <= 5 ? '⚠️ RESTOCK' : '✅ Aman';
        
        const productUpdate = {
            'Kode Barang': product.kode,
            'Nama Barang': product.nama,
            'Kategori': product.kategori,
            'Satuan': product.satuan,
            'Harga Beli Modal': product.hargaBeli,
            'Harga Jual': product.hargaJual,
            'Stok Awal': product.stokAwal,
            'Stok Saat Ini': newStok,
            'Status Stok': statusStok
        };
        
        const productIndex = dataCache.products.findIndex(p => p.kode === kode);
        const updateSuccess = await saveToSheet(CONFIG.SHEET_NAMES.MASTER_BARANG, 
            Object.values(productUpdate), 'update', productIndex + 2);
        
        if (updateSuccess) {
            product.stokSaatIni = newStok;
            product.statusStok = statusStok;
            
            dataCache.restocks.unshift({
                tanggal: restock['Tanggal'],
                kodeBarang: kode,
                namaBarang: product.nama,
                jumlah: jumlah,
                hargaBeli: hargaBeli,
                total: total,
                supplier: restock['Nama Supplier'],
                keterangan: restock['Keterangan']
            });
            
            displayProducts();
            displayRestocks();
            $('#restockModal').modal('hide');
            showNotification('Restock berhasil diproses', 'success');
        }
    }
}

// ==========================================
// TRANSACTIONS
// ==========================================

async function loadTransactions() {
    const data = await fetchSheetData(CONFIG.SHEET_NAMES.TRANSAKSI_PENJUALAN);
    dataCache.transactions = data.map(row => ({
        tanggal: row['Tanggal'] || '',
        jam: row['Jam'] || '',
        invoice: row['No. Invoice'] || '',
        kodeBarang: row['Kode Barang'] || '',
        namaBarang: row['Nama Barang'] || '',
        hargaJual: parseInt(row['Harga Jual']) || 0,
        jumlahBeli: parseInt(row['Jumlah Beli']) || 0,
        totalHarga: parseInt(row['Total Harga']) || 0,
        metodeBayar: row['Metode Bayar'] || '',
        kasir: row['Kasir'] || ''
    }));
}

// ==========================================
// POS / CART MANAGEMENT
// ==========================================

let cart = [];

function addToCart(kode) {
    const product = dataCache.products.find(p => p.kode === kode);
    if (!product || product.stokSaatIni <= 0) {
        showNotification('Stok tidak tersedia!', 'error');
        return;
    }
    
    const existingItem = cart.find(item => item.kode === kode);
    if (existingItem) {
        if (existingItem.qty + 1 <= product.stokSaatIni) {
            existingItem.qty++;
            existingItem.subtotal = existingItem.qty * existingItem.hargaJual;
        } else {
            showNotification('Stok tidak mencukupi!', 'error');
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
            </tr>
        `;
        tbody.append(row);
    });
    
    $('#totalAmount').text(formatRupiah(total));
}

function updateCartQty(index, qty) {
    qty = parseInt(qty);
    if (qty > 0) {
        const product = dataCache.products.find(p => p.kode === cart[index].kode);
        if (product && qty <= product.stokSaatIni) {
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

async function checkout() {
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
    
    let allSuccess = true;
    
    // Create transactions and update stock
    for (const item of cart) {
        const transaction = [
            date, time, invoice, item.kode, item.nama,
            item.hargaJual, item.qty, item.subtotal, paymentMethod, cashier
        ];
        
        const success = await saveToSheet(CONFIG.SHEET_NAMES.TRANSAKSI_PENJUALAN, 
            transaction, 'append');
        
        if (!success) {
            allSuccess = false;
            break;
        }
        
        // Update product stock in sheet
        const product = dataCache.products.find(p => p.kode === item.kode);
        if (product) {
            const newStok = product.stokSaatIni - item.qty;
            const statusStok = newStok <= 5 ? '⚠️ RESTOCK' : '✅ Aman';
            
            const productUpdate = [
                product.kode, product.nama, product.kategori, product.satuan,
                product.hargaBeli, product.hargaJual, product.stokAwal,
                newStok, statusStok
            ];
            
            const productIndex = dataCache.products.findIndex(p => p.kode === item.kode);
            const updateSuccess = await saveToSheet(CONFIG.SHEET_NAMES.MASTER_BARANG, 
                productUpdate, 'update', productIndex + 2);
            
            if (updateSuccess) {
                product.stokSaatIni = newStok;
                product.statusStok = statusStok;
            }
        }
    }
    
    if (allSuccess) {
        // Print receipt
        printReceipt(invoice, date, time, cart, total, paymentMethod, cashier);
        
        // Clear cart and refresh display
        cart = [];
        displayCart();
        displayProducts();
        showNotification(`Transaksi berhasil! Invoice: ${invoice}`, 'success');
    } else {
        showNotification('Gagal memproses transaksi', 'error');
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

function showNotification(message, type = 'info') {
    // You can replace this with a better toast notification
    alert(message);
}

// Add loading overlay to index.html
$(document).ready(function() {
    $('body').append(`
        <div id="loadingOverlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999;">
            <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); background:white; padding:20px; border-radius:10px;">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
                <p>Memuat data...</p>
            </div>
        </div>
    `);
});
