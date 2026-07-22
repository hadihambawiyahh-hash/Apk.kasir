// ==========================================
// STATE APLIKASI & DATA LOCALSTORAGE
// ==========================================
let namaToko = localStorage.getItem('toko_nama') || "Toko Saya";
let targetBulananSetting = Number(localStorage.getItem('toko_target')) || 5000000;
let isDarkMode = localStorage.getItem('toko_dark_mode') === 'true';

let produkList = JSON.parse(localStorage.getItem('toko_produk')) || [
    { id: 1, nama: "Minyak Goreng 1L", barcode: "8991001", harga: 19000, stok: 15, foto: "" },
    { id: 2, nama: "Gula Pasir 1kg", barcode: "8991002", harga: 14500, stok: 5, foto: "" },
    { id: 3, nama: "Kopi Sachet", barcode: "8991003", harga: 2000, stok: 40, foto: "" }
];

let keranjang = [];
let keuanganList = JSON.parse(localStorage.getItem('toko_keuangan')) || [];
let html5QrcodeScanner = null;
let currentScannerMode = 'kasir';
let tempBase64Foto = "";

// ==========================================
// INISIALISASI SAAT HALAMAN DIMUAT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Splash Screen Hapus
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 400);
        }
    }, 1200);

    // Mode Malam Init
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }

    // Set Header Info
    document.getElementById('display-nama-toko').innerText = namaToko;

    // Jalankan Jam & Tanggal Real-time
    jalankanJamRealtime();

    // Render Tampilan Utama
    updateDashboard();
    renderProdukList();
    renderRiwayatTransaksi();
});

// Sync Otomatis Jika Membuka Beberapa Tab Browser
window.addEventListener('storage', () => {
    keuanganList = JSON.parse(localStorage.getItem('toko_keuangan')) || [];
    produkList = JSON.parse(localStorage.getItem('toko_produk')) || [];
    updateDashboard();
    renderProdukList();
    renderRiwayatTransaksi();
});

// Jam Real-time di Header Beranda
function jalankanJamRealtime() {
    const elTanggal = document.getElementById('display-tanggal');
    if (!elTanggal) return;

    const updateWaktu = () => {
        const sekarang = new Date();
        const opsiTanggal = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const stringTanggal = sekarang.toLocaleDateString('id-ID', opsiTanggal);
        const stringJam = sekarang.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        elTanggal.innerText = `${stringTanggal} • ${stringJam} WIB`;
    };

    updateWaktu();
    setInterval(updateWaktu, 1000);
}

// ==========================================
// NAVIGASI TAB HALAMAN
// ==========================================
function gantiTab(targetId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    const targetPage = document.getElementById(`page-${targetId}`);
    if (targetPage) targetPage.classList.add('active');

    const targetNav = document.getElementById(`nav-${targetId}`);
    if (targetNav) targetNav.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// DASHBOARD & PERHITUNGAN REAL-TIME (HARI/BULAN)
// ==========================================
function updateDashboard() {
    const sekarang = new Date();
    const bulanIni = sekarang.getMonth(); // 0 - 11
    const tahunIni = sekarang.getFullYear();
    const stringHariIni = sekarang.toLocaleDateString('id-ID');

    let totalPemasukanHariIni = 0;
    let totalPengeluaranHariIni = 0;
    let totalPemasukanBulanIni = 0;

    keuanganList.forEach(item => {
        const parts = item.tanggal.split('/');
        let tglTrans = null;
        if (parts.length === 3) {
            tglTrans = new Date(parts[2], parts[1] - 1, parts[0]);
        }

        const isHariIni = (item.tanggal === stringHariIni);
        const isBulanIni = tglTrans ? (tglTrans.getMonth() === bulanIni && tglTrans.getFullYear() === tahunIni) : false;

        // 1. HITUNG KHUSUS HARI INI (Otomatis Rp 0 saat ganti hari)
        if (isHariIni) {
            if (item.tipe === 'pemasukan') {
                totalPemasukanHariIni += Number(item.nominal);
            } else {
                totalPengeluaranHariIni += Number(item.nominal);
            }
        }

        // 2. HITUNG KHUSUS BULAN INI (Otomatis 0% saat ganti bulan)
        if (isBulanIni && item.tipe === 'pemasukan') {
            totalPemasukanBulanIni += Number(item.nominal);
        }
    });

    // Display Kas Tunai & Pemasukan Harian
    const saldoHariIni = totalPemasukanHariIni - totalPengeluaranHariIni;
    document.getElementById('display-saldo').innerText = formatRupiah(saldoHariIni);
    document.getElementById('display-pemasukan').innerText = formatRupiah(totalPemasukanHariIni);
    document.getElementById('display-pengeluaran').innerText = formatRupiah(totalPengeluaranHariIni);

    // Progress Target Bulanan
    let persentaseBulan = Math.min(Math.round((totalPemasukanBulanIni / targetBulananSetting) * 100), 100);
    document.getElementById('progress-percentage').innerText = persentaseBulan + '%';
    document.getElementById('progress-bar').style.width = persentaseBulan + '%';
    document.getElementById('progress-text').innerText = `${formatRupiah(totalPemasukanBulanIni)} tercapai dari target ${formatRupiah(targetBulananSetting)}`;

    // Ringkasan Produk
    let stokKritisCount = produkList.filter(p => p.stok <= 5).length;
    document.getElementById('summary-total-produk').innerText = produkList.length;
    document.getElementById('summary-stok-kritis').innerText = stokKritisCount;

    // Perbarui Card Penjualan Hari Ini di Menu Laporan
    updateLaporanHariIni();

    // Simpan ke LocalStorage
    try {
        localStorage.setItem('toko_keuangan', JSON.stringify(keuanganList));
        localStorage.setItem('toko_produk', JSON.stringify(produkList));
    } catch (e) {
        console.error("Gagal menyimpan ke LocalStorage:", e);
        tampilkanToast("Peringatan: Penyimpanan browser penuh!");
    }
}

function updateLaporanHariIni() {
    const todayStr = new Date().toLocaleDateString('id-ID');
    let totalItemsToday = 0;
    let totalOmsetToday = 0;

    keuanganList.filter(k => k.tanggal === todayStr && k.tipe === 'pemasukan').forEach(k => {
        totalOmsetToday += Number(k.nominal);
        if (k.totalItem) {
            totalItemsToday += Number(k.totalItem);
        }
    });

    const elTerjual = document.getElementById('laporan-barang-terjual');
    const elOmset = document.getElementById('laporan-omset-hari-ini');

    if (elTerjual) elTerjual.innerText = `${totalItemsToday} Pcs`;
    if (elOmset) elOmset.innerText = formatRupiah(totalOmsetToday);
}

function simpanKeuangan(event) {
    event.preventDefault();
    const tipe = document.getElementById('keuangan-tipe').value;
    const nominal = document.getElementById('keuangan-nominal').value;
    const keterangan = document.getElementById('keuangan-keterangan').value;

    const dataBaru = {
        id: Date.now(),
        tipe,
        nominal: Number(nominal),
        keterangan,
        tanggal: new Date().toLocaleDateString('id-ID')
    };

    keuanganList.unshift(dataBaru);
    updateDashboard();
    renderRiwayatTransaksi();

    document.getElementById('form-keuangan').reset();
    tampilkanToast("Transaksi berhasil disimpan!");
}

function renderRiwayatTransaksi() {
    const container = document.getElementById('riwayat-transaksi-list');
    const filterEl = document.getElementById('filter-periode-laporan');
    const modeFilter = filterEl ? filterEl.value : 'semua';

    if (keuanganList.length === 0) {
        container.innerHTML = `<div class="empty-state">Belum ada riwayat transaksi.</div>`;
        return;
    }

    const sekarang = new Date();
    const stringHariIni = sekarang.toLocaleDateString('id-ID');
    const bulanIni = sekarang.getMonth();
    const tahunIni = sekarang.getFullYear();

    // Filter Data Berdasarkan Dropdown Pilihan
    let dataFiltered = keuanganList.filter(item => {
        if (modeFilter === 'hari-ini') {
            return item.tanggal === stringHariIni;
        } else if (modeFilter === 'bulan-ini') {
            const parts = item.tanggal.split('/');
            if (parts.length === 3) {
                const tglTrans = new Date(parts[2], parts[1] - 1, parts[0]);
                return tglTrans.getMonth() === bulanIni && tglTrans.getFullYear() === tahunIni;
            }
            return true;
        }
        return true; // 'semua'
    });

    if (dataFiltered.length === 0) {
        container.innerHTML = `<div class="empty-state">Tidak ada riwayat transaksi pada periode ini.</div>`;
        return;
    }

    container.innerHTML = dataFiltered.map(item => `
        <div class="item-row">
            <div class="item-info">
                <h5>${item.keterangan}</h5>
                <p>${item.tanggal} • <span style="text-transform:capitalize; color:${item.tipe === 'pemasukan' ? 'var(--green)' : 'var(--primary)'}">${item.tipe}</span></p>
            </div>
            <div style="font-weight:700; color:${item.tipe === 'pemasukan' ? 'var(--green)' : 'var(--primary)'}">
                ${item.tipe === 'pemasukan' ? '+' : '-'} ${formatRupiah(item.nominal)}
            </div>
        </div>
    `).join('');
}

// ==========================================
// MANAJEMEN PRODUK & FOTO
// ==========================================
function renderProdukList(filter = "") {
    const grid = document.getElementById('produk-grid');
    const filtered = produkList.filter(p => 
        p.nama.toLowerCase().includes(filter.toLowerCase()) || 
        p.barcode.includes(filter)
    );

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column: span 2;">Produk tidak ditemukan.</div>`;
        return;
    }

    grid.innerHTML = filtered.map(p => `
        <div class="product-card">
            <div class="product-card-image">
                ${p.foto ? `<img src="${p.foto}" alt="${p.nama}">` : `<span class="material-icons-round no-image-placeholder">image</span>`}
            </div>
            <div class="product-card-info">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; margin-bottom: 4px;">
                    <h5 style="margin: 0; flex: 1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${p.nama}</h5>
                    <span class="product-card-stok-badge ${p.stok <= 5 ? 'stok-kritis' : 'stok-aman'}">
                        Stok: ${p.stok}
                    </span>
                </div>
                <div class="price-tag">${formatRupiah(p.harga)}</div>
                <div class="barcode-sub">SKU: ${p.barcode}</div>
                <div class="product-card-actions">
                    <span class="material-icons-round action-card-btn" style="color:var(--blue);" onclick="tambahKeKeranjangOtomatis('${p.barcode}')">add_shopping_cart</span>
                    <span class="material-icons-round action-card-btn" style="color:var(--text2);" onclick="editProduk(${p.id})">edit</span>
                    <span class="material-icons-round action-card-btn" style="color:var(--primary);" onclick="hapusProduk(${p.id})">delete</span>
                </div>
            </div>
        </div>
    `).join('');
}

function filterProdukList() {
    const keyword = document.getElementById('search-produk-input').value;
    renderProdukList(keyword);
}

function bukaModalTambahProduk() {
    document.getElementById('modal-produk-title').innerText = "Tambah Produk Baru";
    document.getElementById('form-produk').reset();
    document.getElementById('edit-product-id').value = "";
    tempBase64Foto = "";
    const previewBox = document.getElementById('image-preview-container');
    previewBox.style.backgroundImage = "none";
    document.getElementById('preview-placeholder-text').style.display = "block";
    document.getElementById('modal-tambah-produk').classList.add('active');
}

function tutupModalTambahProduk() {
    document.getElementById('modal-tambah-produk').classList.remove('active');
}

function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxDimension = 400;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxDimension) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                }
            } else {
                if (height > maxDimension) {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            tempBase64Foto = canvas.toDataURL('image/jpeg', 0.7);

            const previewBox = document.getElementById('image-preview-container');
            previewBox.style.backgroundImage = `url('${tempBase64Foto}')`;
            previewBox.style.backgroundSize = "cover";
            previewBox.style.backgroundPosition = "center";
            document.getElementById('preview-placeholder-text').style.display = "none";
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function simpanProduk(event) {
    event.preventDefault();
    const idEdit = document.getElementById('edit-product-id').value;
    const nama = document.getElementById('input-nama-produk').value;
    const barcode = document.getElementById('input-barcode').value;
    const harga = Number(document.getElementById('input-harga').value);
    const stok = Number(document.getElementById('input-stok').value);

    if (idEdit) {
        produkList = produkList.map(p => {
            if (p.id == idEdit) {
                return { ...p, nama, barcode, harga, stok, foto: tempBase64Foto !== "" ? tempBase64Foto : p.foto };
            }
            return p;
        });
        tampilkanToast("Produk diperbarui!");
    } else {
        produkList.push({ id: Date.now(), nama, barcode, harga, stok, foto: tempBase64Foto });
        tampilkanToast("Produk ditambahkan!");
    }

    tutupModalTambahProduk();
    updateDashboard();
    renderProdukList();
}

function editProduk(id) {
    const produk = produkList.find(p => p.id === id);
    if (!produk) return;

    document.getElementById('modal-produk-title').innerText = "Edit Produk";
    document.getElementById('edit-product-id').value = produk.id;
    document.getElementById('input-nama-produk').value = produk.nama;
    document.getElementById('input-barcode').value = produk.barcode;
    document.getElementById('input-harga').value = produk.harga;
    document.getElementById('input-stok').value = produk.stok;

    tempBase64Foto = produk.foto || "";
    const previewBox = document.getElementById('image-preview-container');
    
    if (produk.foto) {
        previewBox.style.backgroundImage = `url('${produk.foto}')`;
        previewBox.style.backgroundSize = "cover";
        previewBox.style.backgroundPosition = "center";
        document.getElementById('preview-placeholder-text').style.display = "none";
    } else {
        previewBox.style.backgroundImage = "none";
        document.getElementById('preview-placeholder-text').style.display = "block";
    }

    document.getElementById('modal-tambah-produk').classList.add('active');
}

function hapusProduk(id) {
    if (confirm("Yakin ingin menghapus produk ini?")) {
        produkList = produkList.filter(p => p.id !== id);
        updateDashboard();
        renderProdukList();
        tampilkanToast("Produk dihapus.");
    }
}

// ==========================================
// KASIR & KERANJANG
// ==========================================
function tambahKeKeranjangOtomatis(barcode) {
    const produk = produkList.find(p => p.barcode === barcode);
    if (!produk) {
        tampilkanToast("Produk tidak ditemukan!");
        return;
    }

    if (produk.stok <= 0) {
        tampilkanToast("Stok produk habis!");
        return;
    }

    const itemDiKeranjang = keranjang.find(item => item.barcode === barcode);
    if (itemDiKeranjang) {
        if (itemDiKeranjang.qty < produk.stok) {
            itemDiKeranjang.qty++;
        } else {
            tampilkanToast("Stok tidak mencukupi!");
            return;
        }
    } else {
        keranjang.push({
            barcode: produk.barcode,
            nama: produk.nama,
            harga: produk.harga,
            foto: produk.foto,
            qty: 1
        });
    }

    renderKeranjang();
    tampilkanToast(`${produk.nama} masuk keranjang`);
}

function renderKeranjang() {
    const container = document.getElementById('keranjang-list');
    const badge = document.getElementById('cart-item-count');
    const totalPriceEl = document.getElementById('cart-total-price');

    badge.innerText = `${keranjang.reduce((a, b) => a + b.qty, 0)} Item`;

    if (keranjang.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-icons-round">remove_shopping_cart</span>
                Keranjang masih kosong. Silakan scan produk.
            </div>
        `;
        totalPriceEl.innerText = formatRupiah(0);
        return;
    }

    let totalHarga = 0;
    container.innerHTML = keranjang.map((item, index) => {
        let subtotal = item.harga * item.qty;
        totalHarga += subtotal;
        return `
            <div class="item-row">
                <div class="cart-item-detail">
                    <div class="cart-item-img">
                        ${item.foto ? `<img src="${item.foto}" alt="${item.nama}">` : `<span class="material-icons-round" style="font-size:24px;">image</span>`}
                    </div>
                    <div class="item-info">
                        <h5>${item.nama}</h5>
                        <p>${formatRupiah(item.harga)} x ${item.qty}</p>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-weight:700; font-size:13px;">${formatRupiah(subtotal)}</span>
                    <button class="btn btn-secondary btn-sm" onclick="ubahQtyKeranjang(${index}, -1)">-</button>
                    <span>${item.qty}</span>
                    <button class="btn btn-secondary btn-sm" onclick="ubahQtyKeranjang(${index}, 1)">+</button>
                </div>
            </div>
        `;
    }).join('');

    totalPriceEl.innerText = formatRupiah(totalHarga);
}

function ubahQtyKeranjang(index, delta) {
    const item = keranjang[index];
    const produkRef = produkList.find(p => p.barcode === item.barcode);

    item.qty += delta;
    if (item.qty <= 0) {
        keranjang.splice(index, 1);
    } else if (produkRef && item.qty > produkRef.stok) {
        item.qty = produkRef.stok;
        tampilkanToast("Stok maksimum tercapai.");
    }
    renderKeranjang();
}

function prosesCheckout() {
    if (keranjang.length === 0) {
        tampilkanToast("Keranjang masih kosong!");
        return;
    }

    let totalBelanja = 0;
    let totalQty = 0;

    keranjang.forEach(item => {
        const p = produkList.find(prod => prod.barcode === item.barcode);
        if (p) {
            p.stok -= item.qty;
            totalBelanja += (p.harga * item.qty);
            totalQty += item.qty;
        }
    });

    keuanganList.unshift({
        id: Date.now(),
        tipe: 'pemasukan',
        nominal: totalBelanja,
        totalItem: totalQty,
        keterangan: `Penjualan Kasir (${totalQty} item)`,
        tanggal: new Date().toLocaleDateString('id-ID')
    });
    keranjang = [];
    renderKeranjang();
    updateDashboard();
    renderProdukList();
    renderRiwayatTransaksi();

    tampilkanToast("Pembayaran Berhasil!");
    gantiTab('beranda');
}

function bukaModalCariManual() {
    gantiTab('produk');
}
// ==========================================
// SCANNER KAMERA
// ==========================================
async function bukaKamera(mode = 'kasir') {
    currentScannerMode = mode;
    
    if (mode === 'produk') {
        document.getElementById('modal-tambah-produk').classList.remove('active');
    }

    document.getElementById('scanner-mode-title').innerText = mode === 'kasir' ? 'Scanner Kasir' : 'Scanner Tambah Produk';
    document.getElementById('scanner-container-wrapper').classList.remove('hidden');

    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5Qrcode("interactive-reader");
    }

    try {
        await html5QrcodeScanner.start(
            { facingMode: "environment" },
            {
                fps: 20,
                qrbox: { width: 220, height: 220 },
                aspectRatio: 1.0,
                disableFlip: false
            },
            onScanSuccess,
            onScanFailure
        );
    } catch (err) {
        console.error("Kamera Error:", err);
        tutupKamera();
        alert("Akses kamera ditolak atau tidak didukung. Pastikan izin kamera aktif pada APK / Browser.");
    }
}

function tutupKamera() {
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().then(() => {
            document.getElementById('scanner-container-wrapper').classList.add('hidden');
            if (currentScannerMode === 'produk') {
                document.getElementById('modal-tambah-produk').classList.add('active');
            }
        }).catch(err => {
            console.error(err);
            document.getElementById('scanner-container-wrapper').classList.add('hidden');
        });
    } else {
        document.getElementById('scanner-container-wrapper').classList.add('hidden');
        if (currentScannerMode === 'produk') {
            document.getElementById('modal-tambah-produk').classList.add('active');
        }
    }
}

function onScanSuccess(decodedText) {
    const scannedCode = decodedText.trim();
    tutupKamera();
    if (currentScannerMode === 'kasir') {
        gantiTab('penjualan');
        tambahKeKeranjangOtomatis(scannedCode);
    } else if (currentScannerMode === 'produk') {
        document.getElementById('modal-tambah-produk').classList.add('active');
        document.getElementById('input-barcode').value = scannedCode;
        tampilkanToast("Barcode terdeteksi!");
    }
}

function onScanFailure(error) {
    // Frame tanpa barcode diabaikan
}
// ==========================================
// NOTIFIKASI & PENGATURAN
// ==========================================
function bukaNotifikasi() {
    const listContainer = document.getElementById('notifikasi-list');
    let stokKritis = produkList.filter(p => p.stok <= 5);

    let htmlContent = `
        <div class="item-row">
            <div class="item-info">
                <h5>Status Sistem Toko</h5>
                <p>Total produk terdaftar: ${produkList.length} item.</p>
            </div>
        </div>
    `;

    if (stokKritis.length > 0) {
        htmlContent += stokKritis.map(p => `
            <div class="item-row">
                <div class="item-info">
                    <h5>Stok Menipis!</h5>
                    <p>Produk <b>${p.nama}</b> sisa ${p.stok} pcs.</p>
                </div>
                <span class="badge">Kritis</span>
            </div>
        `).join('');
    } else {
        htmlContent += `
            <div class="item-row">
                <div class="item-info">
                    <h5>Stok Aman</h5>
                    <p>Tidak ada stok yang habis.</p>
                </div>
            </div>
        `;
    }

    listContainer.innerHTML = htmlContent;
    document.getElementById('modal-notifikasi').classList.add('active');
}

function tutupModalNotifikasi() {
    document.getElementById('modal-notifikasi').classList.remove('active');
}

function bukaModalSetting() {
    document.getElementById('setting-nama-toko').value = namaToko;
    document.getElementById('setting-target-bulanan').value = targetBulananSetting;
    document.getElementById('setting-mode-malam').checked = isDarkMode;
    document.getElementById('modal-setting').classList.add('active');
}

function tutupModalSetting() {
    document.getElementById('modal-setting').classList.remove('active');
}
function simpanSetting(event) {
    event.preventDefault();
    namaToko = document.getElementById('setting-nama-toko').value;
    targetBulananSetting = Number(document.getElementById('setting-target-bulanan').value);

    localStorage.setItem('toko_nama', namaToko);
    localStorage.setItem('toko_target', targetBulananSetting);

    document.getElementById('display-nama-toko').innerText = namaToko;
    tutupModalSetting();
    updateDashboard();
    tampilkanToast("Pengaturan disimpan!");
}

function toggleModeMalam(active) {
    isDarkMode = active;
    localStorage.setItem('toko_dark_mode', active);
    if (active) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}
function resetSemuaData() {
    if (confirm("Apakah Anda yakin ingin menghapus SEMUA data toko, transaksi, dan produk? Tindakan ini tidak dapat dibatalkan.")) {
        localStorage.clear();
        location.reload();
    }
}

// ==========================================
// UTILITAS
// ==========================================
function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka);
}

function tampilkanToast(pesan) {
    const toast = document.getElementById('toast');
    toast.innerText = pesan;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}
