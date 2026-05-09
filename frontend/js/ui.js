/**
 * ============================================================
 * FILE: ui.js
 * PERAN: Otak utama frontend — mengatur state dan tampilan UI
 * ============================================================
 *
 * File ini adalah yang PALING PENTING di frontend karena:
 *   1. Menyimpan data (state) semua lokasi yang ditambahkan
 *   2. Merender daftar lokasi di sidebar
 *   3. Menangani semua interaksi user (klik tombol, input, dll)
 *   4. Mengorkestrasi: memanggil map.js dan api.js pada waktu yang tepat
 *
 * ANALOGI: Ibarat "manajer" yang mengkoordinasikan:
 *   - Kurir data: api.js
 *   - Tampilan peta: map.js
 *   - Tampilan daftar: DOM (HTML)
 *
 * FILE INI DIPANGGIL OLEH: index.html (via DOMContentLoaded)
 * FILE INI MEMANGGIL: map.js (MapModule), api.js (ApiModule)
 */


// ============================================================
// UIModule: Objek utama yang mengontrol seluruh UI aplikasi
// ============================================================
const UIModule = (() => {

  // ----------------------------------------------------------
  // STATE APLIKASI
  // ----------------------------------------------------------
  // "State" = data yang menggambarkan kondisi aplikasi saat ini.
  // Setiap kali state berubah, UI harus di-render ulang.

  /**
   * Daftar semua lokasi yang ditambahkan pengguna.
   * Ini adalah "sumber kebenaran" (single source of truth).
   * Semua komponen UI harus mengacu ke array ini.
   *
   * Struktur setiap lokasi:
   * {
   *   id:   "loc_3_1715000123",  // ID unik (tidak pernah berubah)
   *   name: "Candi Prambanan",   // Nama lokasi
   *   lat:  -7.7520,             // Latitude
   *   lng:  110.4914             // Longitude
   * }
   */
  let locations = [];

  /**
   * Flag (penanda): sedang dalam proses optimasi?
   * Digunakan untuk menonaktifkan tombol selama proses berjalan,
   * agar user tidak bisa menekan tombol berkali-kali.
   */
  let isOptimizing = false;

  /**
   * Apakah user sudah pernah klik di peta?
   * Digunakan untuk menyembunyikan petunjuk "klik peta untuk menambah"
   * setelah user melakukan klik pertama.
   */
  let mapClickedOnce = false;

  /**
   * Counter untuk membuat ID unik setiap lokasi.
   * Setiap lokasi baru mendapat ID: "loc_${counter}_${timestamp}"
   * Contoh: "loc_1_1715000123", "loc_2_1715000456"
   *
   * Kenapa perlu ID unik?
   * → Agar bisa menghapus lokasi TERTENTU dari array dan peta
   * → Tanpa ID, kita harus cari berdasarkan nama (rawan bug jika nama sama)
   */
  let locationIdCounter = 0;


  // ----------------------------------------------------------
  // DATA TEMPLATE: Wisata Jogja
  // ----------------------------------------------------------

  /**
   * Daftar 6 lokasi wisata Yogyakarta dengan koordinat real.
   *
   * Ini adalah "template" yang dimuat saat user menekan
   * tombol "Wisata Jogja". Koordinat sudah dicek ke Google Maps.
   *
   * Dideklarasikan sebagai CONST (tidak berubah-ubah)
   * karena ini data bawaan, bukan input user.
   */
  const TEMPLATE_JOGJA = [
    { name: "Malioboro",          lat: -7.7928,  lng: 110.3653 },
    { name: "Tugu Jogja",         lat: -7.7828,  lng: 110.3671 },
    { name: "Keraton Yogyakarta", lat: -7.8053,  lng: 110.3642 },
    { name: "Tebing Breksi",      lat: -7.7741,  lng: 110.5085 },
    { name: "HeHa Sky View",      lat: -7.8639,  lng: 110.4344 },
    { name: "Candi Prambanan",    lat: -7.7520,  lng: 110.4914 },
  ];


  // ----------------------------------------------------------
  // CACHE REFERENSI DOM
  // ----------------------------------------------------------

  /**
   * Objek yang menyimpan referensi ke elemen-elemen HTML penting.
   *
   * KENAPA di-cache (disimpan)?
   * → document.getElementById() harus "mencari" di seluruh DOM setiap kali dipanggil
   * → Jika dipanggil ratusan kali, ini bisa memperlambat aplikasi
   * → Dengan menyimpan hasilnya sekali, pencarian hanya dilakukan SATU KALI
   *
   * Diisi oleh fungsi _cacheDOMRefs() saat init()
   */
  let DOM = {};


  // ============================================================
  // FUNGSI PUBLIC #1: init ← Entry Point Aplikasi
  // ============================================================
  /**
   * Memulai seluruh aplikasi. Dipanggil SATU KALI oleh DOMContentLoaded.
   *
   * Urutan eksekusi:
   * 1. Cache semua referensi elemen HTML
   * 2. Pasang semua event listener (tombol, input, dll)
   * 3. Inisialisasi peta Leaflet
   * 4. Render tampilan awal (daftar kosong)
   * 5. Update status tombol Optimize (disabled karena belum ada lokasi)
   */
  function init() {
    _cacheDOMRefs();             // Simpan referensi HTML sekali
    _bindEvents();               // Pasang semua event listener
    MapModule.init();            // Mulai peta Leaflet
    _renderLocationList();       // Render daftar (awalnya kosong)
    _updateOptimizeButtonState(); // Disable tombol (belum ada lokasi)

    console.info("[WayFinder UI] Aplikasi berhasil dimulai ✓");
  }


  // ============================================================
  // FUNGSI PRIVATE #1: _cacheDOMRefs
  // ============================================================
  /**
   * Menyimpan semua referensi elemen HTML ke dalam objek DOM.
   *
   * Tanda ? pada DOM.xxx? nanti = Optional Chaining
   * Artinya: gunakan hanya jika elemen tersebut ada di HTML
   * Mencegah error "Cannot read properties of null"
   */
  function _cacheDOMRefs() {
    DOM = {
      // ── Input & Tombol Utama ──
      locationInput:     document.getElementById("locationInput"),     // Input nama lokasi
      addLocationBtn:    document.getElementById("addLocationBtn"),    // Tombol "+"
      optimizeBtn:       document.getElementById("optimizeBtn"),       // Tombol Optimalkan
      clearAllBtn:       document.getElementById("clearAllBtn"),       // Tombol Hapus Semua

      // ── Template ──
      templateJogjaBtn:  document.getElementById("templateJogjaBtn"), // Tombol template
      templateBadge:     document.getElementById("templateBadge"),    // Chip konfirmasi
      templateBadgeText: document.getElementById("templateBadgeText"),// Teks di chip

      // ── Daftar Lokasi ──
      locationList:      document.getElementById("locationList"),      // Container kartu
      emptyState:        document.getElementById("emptyState"),        // Pesan "belum ada"

      // ── Statistik ──
      locationCount:     document.getElementById("locationCount"),     // "X titik"
      totalDistance:     document.getElementById("totalDistance"),     // "XX km"
      estTime:           document.getElementById("estTime"),           // "XX menit"

      // ── Info Rute Optimal ──
      routeInfo:         document.getElementById("routeInfo"),         // Panel urutan rute
      routeOrder:        document.getElementById("routeOrder"),        // List urutannya

      // ── Status & Notifikasi ──
      statusLabel:       document.getElementById("statusLabel"),       // Teks status
      statusPill:        document.getElementById("statusPill"),        // Badge status
      mapHint:           document.getElementById("mapHint"),           // Petunjuk klik peta
      toastContainer:    document.getElementById("toastContainer"),    // Wadah notifikasi toast

      // ── Mobile ──
      globalSearch:      document.getElementById("globalSearch"),      // Search bar topbar
      sidebarToggle:     document.getElementById("sidebarToggle"),     // Tombol X sidebar
      topbarHamburger:   document.getElementById("topbarHamburger"),   // Tombol hamburger ☰
      sidebar:           document.getElementById("sidebar"),           // Elemen sidebar
    };
  }


  // ============================================================
  // FUNGSI PRIVATE #2: _bindEvents
  // ============================================================
  /**
   * Memasang semua event listener (pendengar aksi user) ke elemen HTML.
   *
   * EVENT LISTENER = "petugas" yang menunggu aksi user,
   * lalu memanggil fungsi yang sesuai saat aksi terjadi.
   *
   * Pola yang digunakan:
   *   elemen.addEventListener("jenis-event", fungsiYangDipanggil)
   *
   * Tanda ?. = Optional Chaining: hanya pasang jika elemen ada
   */
  function _bindEvents() {

    // Tombol tambah lokasi (+)
    DOM.addLocationBtn?.addEventListener("click", _onAddLocationClick);

    // Tekan Enter di input = sama seperti klik tombol +
    DOM.locationInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") _onAddLocationClick();
    });

    // Tombol "Optimalkan Rute"
    DOM.optimizeBtn?.addEventListener("click", _onOptimizeClick);

    // Tombol "Hapus Semua Titik"
    DOM.clearAllBtn?.addEventListener("click", _onClearAllClick);

    // Tombol template "Wisata Jogja"
    DOM.templateJogjaBtn?.addEventListener("click", _onLoadTemplateJogja);

    // Search bar — belum berfungsi, tampilkan notifikasi dulu
    DOM.globalSearch?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const query = DOM.globalSearch.value.trim();
        if (query) {
          showToast("Fitur pencarian akan tersedia setelah backend aktif", "warning");
        }
      }
    });

    // Tombol X di dalam sidebar (tutup sidebar — mobile saja)
    DOM.sidebarToggle?.addEventListener("click", _closeSidebar);

    // Tombol hamburger ☰ di topbar (buka sidebar — mobile saja)
    DOM.topbarHamburger?.addEventListener("click", _openSidebar);

    // Klik di luar sidebar = tutup sidebar (khusus mobile)
    document.addEventListener("click", (e) => {
      if (
        DOM.sidebar?.classList.contains("is-open") && // Sidebar sedang terbuka
        !DOM.sidebar.contains(e.target) &&             // Klik bukan di dalam sidebar
        e.target !== DOM.topbarHamburger               // Klik bukan di tombol hamburger
      ) {
        _closeSidebar();
      }
    });
  }


  // ============================================================
  // FUNGSI PUBLIC #2: addLocationFromMap
  // ============================================================
  /**
   * Dipanggil oleh MAP.JS saat user mengklik peta.
   *
   * Alur:
   * 1. Sembunyikan petunjuk "klik peta" setelah klik pertama
   * 2. Jika nama belum diisi → dapatkan nama via geocoding
   * 3. Tambahkan lokasi ke state dan render ulang UI
   *
   * @param {number} lat        - Latitude tempat diklik
   * @param {number} lng        - Longitude tempat diklik
   * @param {string} customName - Nama dari input (bisa kosong "")
   */
  async function addLocationFromMap(lat, lng, customName = "") {

    // Sembunyikan petunjuk "klik peta untuk menambah titik"
    // setelah user pertama kali klik (tidak perlu tampil terus)
    if (!mapClickedOnce) {
      mapClickedOnce = true;
      DOM.mapHint?.classList.add("hidden");
    }

    // Tentukan nama lokasi:
    // Jika user sudah mengetik nama → pakai nama itu
    // Jika kosong → minta ApiModule untuk reverse geocode
    let name = customName;
    if (!name) {
      name = await ApiModule.reverseGeocode(lat, lng);
    }

    _addLocation(name, lat, lng);
  }


  // ============================================================
  // FUNGSI PRIVATE #3: _onAddLocationClick
  // ============================================================
  /**
   * Handler untuk tombol "+" dan Enter di input nama lokasi.
   *
   * Saat tombol diklik TANPA klik peta:
   * → Koordinat tidak diketahui, jadi diberi koordinat RANDOM
   * → Ini hanya untuk testing UI — di produksi harusnya pakai geocoding
   */
  function _onAddLocationClick() {
    const name = DOM.locationInput?.value.trim();

    // Validasi: nama tidak boleh kosong
    if (!name) {
      showToast("Masukkan nama lokasi atau klik pada peta", "warning");
      DOM.locationInput?.focus(); // Fokus kembali ke input
      return;
    }

    // Koordinat random di sekitar Indonesia (untuk testing)
    // lat: -6.2 ± 2, lng: 106.8 ± 3
    const lat = -6.2 + (Math.random() - 0.5) * 4;
    const lng = 106.8 + (Math.random() - 0.5) * 6;

    _addLocation(name, lat, lng);

    // Kosongkan input setelah ditambahkan
    if (DOM.locationInput) DOM.locationInput.value = "";

    showToast(`"${name}" ditambahkan ke daftar`, "success");
  }


  // ============================================================
  // FUNGSI PRIVATE #4: _onLoadTemplateJogja ← Fitur Baru
  // ============================================================
  /**
   * Handler untuk tombol "Wisata Jogja".
   *
   * Fitur ini memuat 6 lokasi wisata Yogyakarta sekaligus.
   *
   * BEHAVIOR PENTING:
   * → Jika sudah ada lokasi sebelumnya: HAPUS dulu, baru load template
   * → Ini mencegah DUPLIKASI jika tombol ditekan berulang kali
   * → User dikonfirmasi sebelum data lama dihapus
   */
  function _onLoadTemplateJogja() {

    // Jika sudah ada lokasi → konfirmasi ke user sebelum menghapus
    if (locations.length > 0) {
      const ok = confirm(
        "Memuat template Wisata Jogja akan menghapus lokasi yang sudah ada. Lanjutkan?"
      );
      if (!ok) return; // User membatalkan → hentikan
    }

    // ── BERSIHKAN STATE LAMA ──────────────────────────────────
    locations = [];                // Kosongkan array state
    MapModule.removeAllMarkers();  // Hapus semua marker dari peta
    MapModule.clearRoute();        // Hapus semua garis rute
    _resetStats();                 // Reset statistik (km & menit)
    _hideRouteInfo();              // Sembunyikan panel urutan rute

    // ── LOAD TEMPLATE ─────────────────────────────────────────
    // Muat setiap lokasi satu per satu menggunakan _addLocation()
    // (yang sudah mengurus render sidebar dan tambah marker ke peta)
    TEMPLATE_JOGJA.forEach((loc) => {
      _addLocation(loc.name, loc.lat, loc.lng);
    });

    // Sesuaikan zoom peta agar semua marker Jogja terlihat
    MapModule.fitBoundsToMarkers();

    // Tampilkan badge konfirmasi di bawah tombol
    if (DOM.templateBadge) {
      DOM.templateBadge.style.display = "flex";
      if (DOM.templateBadgeText) {
        DOM.templateBadgeText.textContent = `${TEMPLATE_JOGJA.length} lokasi Wisata Jogja dimuat`;
      }
    }

    // Sembunyikan petunjuk klik peta (karena lokasi sudah ada)
    if (!mapClickedOnce) {
      mapClickedOnce = true;
      DOM.mapHint?.classList.add("hidden");
    }

    _setStatus("ready", "Template dimuat");
    showToast("Template Wisata Jogja berhasil dimuat!", "info");
  }


  // ============================================================
  // FUNGSI PRIVATE #5: _addLocation ← Fungsi Paling Sering Dipanggil
  // ============================================================
  /**
   * Menambahkan SATU lokasi baru ke aplikasi.
   * Ini adalah fungsi "inti" yang mengurus semuanya sekaligus.
   *
   * Langkah yang dilakukan:
   * 1. Buat ID unik untuk lokasi
   * 2. Simpan ke array state (locations)
   * 3. Tambah marker ke peta (via MapModule)
   * 4. Render ulang daftar di sidebar
   * 5. Update counter & status tombol
   * 6. Gambar garis rute preview (jika ≥ 2 lokasi)
   * 7. Reset statistik (km & menit)
   *
   * @param {string} name - Nama lokasi
   * @param {number} lat  - Latitude
   * @param {number} lng  - Longitude
   */
  function _addLocation(name, lat, lng) {

    // Buat ID unik: "loc_" + counter + "_" + timestamp
    // Timestamp (Date.now()) = angka milidetik sejak 1 Jan 1970
    // Ini memastikan ID tidak pernah duplikat
    const id = `loc_${++locationIdCounter}_${Date.now()}`;

    // Buat objek lokasi dan simpan ke array state
    const location = { id, name, lat, lng };
    locations.push(location);

    // Marker pertama diberi isStart=true (ada pulse animation)
    const isStart = locations.length === 1;

    // Tambah marker ke peta (via MapModule)
    MapModule.addMarker(id, lat, lng, name, locations.length, isStart);

    // Render ulang seluruh daftar lokasi di sidebar
    _renderLocationList();

    // Perbarui counter "X titik" dan status tombol Optimize
    _updateOptimizeButtonState();
    _updateLocationCount();

    // Gambar garis rute preview jika sudah ada minimal 2 titik
    if (locations.length >= 2) {
      _drawPreviewRoute();
    }

    // Reset statistik karena rute berubah (belum dihitung ulang)
    _resetStats();
  }


  // ============================================================
  // FUNGSI PRIVATE #6: _removeLocation
  // ============================================================
  /**
   * Menghapus SATU lokasi dari state, peta, dan sidebar.
   * Dipanggil saat user menekan tombol ✕ di kartu lokasi.
   *
   * @param {string} id - ID lokasi yang akan dihapus
   */
  function _removeLocation(id) {

    // Cari indeks lokasi di array berdasarkan id
    const idx = locations.findIndex((l) => l.id === id);
    if (idx === -1) return; // Tidak ditemukan → berhenti

    const removedName = locations[idx].name; // Simpan nama untuk toast

    // Hapus dari array state menggunakan splice (hapus 1 elemen di index idx)
    locations.splice(idx, 1);

    // Hapus marker dari peta
    MapModule.removeMarker(id);

    // Perbarui angka di SEMUA marker yang tersisa
    // (karena setelah 1 dihapus, nomor urutan bergeser)
    MapModule.refreshMarkerIcons(locations);

    // Render ulang daftar sidebar
    _renderLocationList();
    _updateOptimizeButtonState();
    _updateLocationCount();

    // Gambar ulang rute preview (dengan titik yang sudah dikurangi)
    if (locations.length >= 2) {
      _drawPreviewRoute();
    } else {
      MapModule.clearRoute(); // Kurang dari 2 titik → hapus rute
    }

    // Sembunyikan badge template jika semua lokasi dihapus
    if (locations.length === 0 && DOM.templateBadge) {
      DOM.templateBadge.style.display = "none";
    }

    _resetStats();
    showToast(`"${removedName}" dihapus`, "default");
  }


  // ============================================================
  // FUNGSI PRIVATE #7: _onOptimizeClick ← Aksi Utama Aplikasi
  // ============================================================
  /**
   * Handler saat tombol "Optimalkan Rute" ditekan.
   *
   * Ini adalah fungsi ASYNC karena harus MENUNGGU hasil dari
   * ApiModule.optimizeRoute() yang bisa memakan waktu beberapa detik.
   *
   * Alur sukses:
   * 1. Tampilkan loading spinner
   * 2. Kirim data ke ApiModule (→ api.js → backend)
   * 3. Terima hasil urutan optimal
   * 4. Perbarui state (locations = urutan baru)
   * 5. Gambar rute berwarna di peta
   * 6. Perbarui angka marker
   * 7. Render ulang sidebar
   * 8. Tampilkan statistik jarak & waktu
   * 9. Zoom peta ke semua marker
   *
   * Alur error:
   * → Tampilkan pesan error di toast
   * → Reset tombol ke kondisi normal
   */
  async function _onOptimizeClick() {

    // Cegah double-klik (jika sedang optimasi, abaikan klik baru)
    if (isOptimizing || locations.length < 2) return;

    isOptimizing = true;
    _setStatus("optimizing", "Mengoptimalkan…");
    _setOptimizeButtonLoading(true); // Tampilkan spinner di tombol

    try {
      // Kirim ke api.js dan tunggu hasilnya
      // "await" = berhenti di sini sampai Promise selesai
      const result = await ApiModule.optimizeRoute(locations);

      // Perbarui state dengan urutan lokasi BARU dari TSP
      locations = result.orderedLocations;

      // Gambar rute berwarna (mode optimized = true)
      const latlngs = locations.map((l) => [l.lat, l.lng]);
      MapModule.drawRoute(latlngs, true);

      // Perbarui angka di dalam marker (urutan sudah berubah)
      MapModule.refreshMarkerIcons(locations);

      // Render ulang daftar di sidebar (urutan baru)
      _renderLocationList();

      // Tampilkan statistik di footer sidebar
      _updateStats(result.totalDistanceKm, result.estimatedMinutes);

      // Tampilkan panel urutan rute optimal di sidebar
      _renderRouteInfo(locations);

      // Zoom peta agar semua marker terlihat
      MapModule.fitBoundsToMarkers();

      _setStatus("ready", "Rute optimal");
      showToast("Rute berhasil dioptimalkan!", "success");

    } catch (err) {
      // Jika terjadi error (network, validasi, dll)
      console.error("[WayFinder] Error optimasi:", err);
      _setStatus("error", "Gagal");
      showToast(err.message || "Gagal mengoptimalkan rute", "error");

    } finally {
      // "finally" = SELALU dieksekusi, baik sukses maupun error
      isOptimizing = false;
      _setOptimizeButtonLoading(false); // Hapus spinner dari tombol
    }
  }


  // ============================================================
  // FUNGSI PRIVATE #8: _onClearAllClick
  // ============================================================
  /**
   * Handler saat tombol "Hapus Semua Titik" ditekan.
   * Mereset SELURUH state dan tampilan ke kondisi awal.
   */
  function _onClearAllClick() {
    if (locations.length === 0) return; // Tidak ada yang dihapus

    // Konfirmasi sebelum menghapus semua
    if (!confirm("Hapus semua lokasi dari daftar?")) return;

    // Reset state
    locations = [];

    // Hapus semua dari peta
    MapModule.removeAllMarkers();
    MapModule.clearRoute();

    // Render ulang UI (akan tampilkan empty state)
    _renderLocationList();
    _updateOptimizeButtonState();
    _updateLocationCount();
    _resetStats();
    _hideRouteInfo();

    // Sembunyikan badge template
    if (DOM.templateBadge) {
      DOM.templateBadge.style.display = "none";
    }

    _setStatus("ready", "Siap");
    showToast("Semua lokasi dihapus", "default");
  }


  // ============================================================
  // FUNGSI PRIVATE #9: _renderLocationList
  // ============================================================
  /**
   * Render ulang SELURUH daftar kartu lokasi di sidebar.
   *
   * Strategi: Hapus semua kartu lama, lalu buat ulang dari state.
   * Ini disebut "full re-render" — sederhana dan mudah dipahami.
   * (Alternatif yang lebih efisien: "diff & patch", tapi lebih kompleks)
   *
   * Dipanggil setiap kali:
   * → Lokasi ditambahkan
   * → Lokasi dihapus
   * → Urutan berubah setelah optimasi
   */
  function _renderLocationList() {
    if (!DOM.locationList) return;

    // Hapus hanya elemen .location-card (bukan emptyState)
    const existingCards = DOM.locationList.querySelectorAll(".location-card");
    existingCards.forEach((c) => c.remove());

    // Jika tidak ada lokasi → tampilkan pesan kosong
    if (locations.length === 0) {
      if (DOM.emptyState) DOM.emptyState.style.display = "flex";
      return;
    }

    // Sembunyikan pesan kosong
    if (DOM.emptyState) DOM.emptyState.style.display = "none";

    // Buat dan tambahkan kartu untuk setiap lokasi
    locations.forEach((loc, idx) => {
      // idx + 1 karena idx mulai dari 0, tapi nomor urutan mulai dari 1
      const card = _createLocationCard(loc, idx + 1);
      DOM.locationList.appendChild(card);
    });
  }


  // ============================================================
  // FUNGSI PRIVATE #10: _createLocationCard
  // ============================================================
  /**
   * Membuat elemen HTMLElement untuk satu kartu lokasi.
   *
   * Setiap kartu berisi:
   * - Badge nomor urutan
   * - Nama lokasi (dipotong jika terlalu panjang)
   * - Koordinat GPS (format kecil)
   * - Tombol hapus ✕
   *
   * Event yang dipasang:
   * - Klik kartu → pan peta ke marker tersebut
   * - Klik tombol ✕ → hapus lokasi
   *
   * @param {object} loc   - Data lokasi {id, name, lat, lng}
   * @param {number} index - Nomor urutan (1, 2, 3, ...)
   * @returns {HTMLElement} - Elemen <div> kartu yang siap ditambahkan ke DOM
   */
  function _createLocationCard(loc, index) {

    // Buat elemen <div> baru secara programatik
    const card = document.createElement("div");
    card.className       = "location-card";
    card.dataset.locationId = loc.id; // Simpan id di atribut data

    // Isi HTML kartu menggunakan template literal
    // _escapeHTML() digunakan untuk mencegah XSS (injeksi HTML berbahaya)
    card.innerHTML = `
      <!-- Badge nomor urutan -->
      <div class="card-badge">${index}</div>

      <!-- Informasi lokasi -->
      <div class="card-content">
        <div class="card-name" title="${_escapeHTML(loc.name)}">${_escapeHTML(loc.name)}</div>
        <div class="card-coords">${loc.lat.toFixed(4)}°, ${loc.lng.toFixed(4)}°</div>
      </div>

      <!-- Tombol hapus (✕) -->
      <button class="card-delete"
              data-id="${loc.id}"
              title="Hapus lokasi"
              aria-label="Hapus ${_escapeHTML(loc.name)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    // ── Event: Klik kartu → pan peta ke marker ────────────────
    card.addEventListener("click", (e) => {
      // Jika yang diklik adalah tombol hapus, abaikan event ini
      if (e.target.closest(".card-delete")) return;

      // Tandai kartu ini sebagai "aktif" (styling berbeda)
      document.querySelectorAll(".location-card.is-active")
        .forEach((c) => c.classList.remove("is-active"));
      card.classList.add("is-active");

      // Pindahkan tampilan peta ke marker lokasi ini
      MapModule.panToMarker(loc.id);
    });

    // ── Event: Klik tombol ✕ → hapus lokasi ──────────────────
    const deleteBtn = card.querySelector(".card-delete");
    deleteBtn?.addEventListener("click", (e) => {
      e.stopPropagation(); // Cegah event naik ke parent (kartu)
      _removeLocation(loc.id);
    });

    return card;
  }


  // ============================================================
  // FUNGSI PRIVATE #11: _drawPreviewRoute
  // ============================================================
  /**
   * Gambar rute preview (putus-putus abu-abu) berdasarkan urutan
   * lokasi yang ada saat ini (belum dioptimalkan).
   *
   * Dipanggil setiap kali lokasi ditambah atau dihapus.
   */
  function _drawPreviewRoute() {
    // Ubah array objek lokasi → array koordinat [lat, lng]
    // Ini format yang dibutuhkan oleh MapModule.drawRoute()
    const latlngs = locations.map((l) => [l.lat, l.lng]);
    MapModule.drawRoute(latlngs, false); // false = mode preview
  }


  // ============================================================
  // FUNGSI PRIVATE #12: _updateOptimizeButtonState
  // ============================================================
  /**
   * Nonaktifkan/aktifkan tombol "Optimalkan Rute" sesuai kondisi.
   *
   * Tombol DISABLED (tidak bisa diklik) jika:
   * → Lokasi < 2 (butuh minimal 2 untuk membuat rute)
   * → Sedang dalam proses optimasi (isOptimizing = true)
   *
   * Mencegah user melakukan aksi yang tidak valid.
   */
  function _updateOptimizeButtonState() {
    if (!DOM.optimizeBtn) return;
    DOM.optimizeBtn.disabled = locations.length < 2 || isOptimizing;
  }


  // ============================================================
  // FUNGSI PRIVATE #13: _setOptimizeButtonLoading
  // ============================================================
  /**
   * Ubah tampilan tombol Optimize saat sedang loading.
   *
   * Saat loading=true:
   * → Tombol disabled
   * → Teks berubah jadi "Memproses…"
   * → Ikon berubah jadi spinner (SVG yang berputar via CSS)
   *
   * Saat loading=false:
   * → Tombol kembali normal
   * → Teks kembali jadi "Optimalkan Rute"
   * → Ikon kembali ke petir
   *
   * @param {boolean} loading - true=sedang loading, false=selesai
   */
  function _setOptimizeButtonLoading(loading) {
    if (!DOM.optimizeBtn) return;

    DOM.optimizeBtn.disabled = loading;

    if (loading) {
      DOM.optimizeBtn.classList.add("is-loading");
      DOM.optimizeBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Memproses…
      `;
    } else {
      DOM.optimizeBtn.classList.remove("is-loading");
      DOM.optimizeBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        Optimalkan Rute
      `;
    }
  }


  // ============================================================
  // FUNGSI PRIVATE #14: _updateLocationCount
  // ============================================================
  /**
   * Perbarui teks penghitung lokasi di header sidebar.
   * Contoh: "0 titik" → "3 titik" → "6 titik"
   */
  function _updateLocationCount() {
    if (!DOM.locationCount) return;
    const n = locations.length;
    DOM.locationCount.textContent = `${n} titik`;

    // Tambahkan class 'has-items' jika ada lokasi
    // Bisa dipakai di CSS untuk styling berbeda
    DOM.locationCount.classList.toggle("has-items", n > 0);
  }


  // ============================================================
  // FUNGSI PRIVATE #15: _updateStats
  // ============================================================
  /**
   * Tampilkan statistik rute setelah optimasi selesai.
   *
   * @param {number} distanceKm - Total jarak dalam kilometer
   * @param {number} minutes    - Estimasi waktu tempuh dalam menit
   */
  function _updateStats(distanceKm, minutes) {
    if (DOM.totalDistance) {
      // toLocaleString("id-ID") → format angka Indonesia: 42.500 (bukan 42,500)
      DOM.totalDistance.textContent = `${distanceKm.toLocaleString("id-ID")} km`;
    }
    if (DOM.estTime) {
      // Jika lebih dari 60 menit → tampilkan dalam jam dan menit
      DOM.estTime.textContent =
        minutes >= 60
          ? `${Math.floor(minutes / 60)}j ${minutes % 60}m` // Contoh: "1j 3m"
          : `${minutes} menit`;                               // Contoh: "45 menit"
    }
  }


  // ============================================================
  // FUNGSI PRIVATE #16: _resetStats
  // ============================================================
  /**
   * Reset statistik ke placeholder "—" saat:
   * → Lokasi ditambah/dihapus (rute berubah, perlu hitung ulang)
   * → Semua lokasi dihapus
   */
  function _resetStats() {
    if (DOM.totalDistance) DOM.totalDistance.textContent = "— km";
    if (DOM.estTime)       DOM.estTime.textContent       = "— menit";
    _hideRouteInfo();
  }


  // ============================================================
  // FUNGSI PRIVATE #17: _renderRouteInfo
  // ============================================================
  /**
   * Tampilkan panel "Urutan Rute Optimal" di sidebar footer
   * setelah optimasi TSP selesai.
   *
   * Panel ini menampilkan daftar bernomor:
   *   1. Malioboro
   *   2. Tugu Jogja
   *   3. Keraton Yogyakarta
   *   ...
   *   ↩ Malioboro (kembali)
   *
   * @param {Array} orderedLocations - Lokasi dengan urutan optimal dari TSP
   */
  function _renderRouteInfo(orderedLocations) {
    if (!DOM.routeInfo || !DOM.routeOrder) return;

    // Buat list item untuk setiap lokasi
    DOM.routeOrder.innerHTML = orderedLocations
      .map(
        (loc, idx) => `
        <li>
          <span class="ro-num">${idx + 1}.</span>
          ${_escapeHTML(loc.name)}
        </li>
      `
      )
      .join(""); // Gabungkan semua <li> menjadi satu string

    // Tambahkan item "kembali ke titik awal" untuk menutup loop
    if (orderedLocations.length > 0) {
      DOM.routeOrder.innerHTML += `
        <li>
          <span class="ro-num">↩</span>
          ${_escapeHTML(orderedLocations[0].name)} (kembali)
        </li>
      `;
    }

    // Tampilkan panel
    DOM.routeInfo.style.display = "block";
  }


  // ============================================================
  // FUNGSI PRIVATE #18: _hideRouteInfo
  // ============================================================
  /** Sembunyikan panel urutan rute. */
  function _hideRouteInfo() {
    if (DOM.routeInfo) DOM.routeInfo.style.display = "none";
  }


  // ============================================================
  // FUNGSI PRIVATE #19: _setStatus
  // ============================================================
  /**
   * Perbarui badge status di topbar.
   *
   * @param {'ready'|'optimizing'|'error'} type - Jenis status
   * @param {string} label - Teks yang ditampilkan
   */
  function _setStatus(type, label) {
    if (!DOM.statusPill || !DOM.statusLabel) return;

    // Reset semua class modifier dulu
    DOM.statusPill.className = "status-pill";

    // Tambahkan class sesuai jenis status (untuk warna berbeda)
    if (type === "optimizing") DOM.statusPill.classList.add("status--optimizing");
    if (type === "error")      DOM.statusPill.classList.add("status--error");

    // Update teks
    DOM.statusLabel.textContent = label;
  }


  // ============================================================
  // FUNGSI PRIVATE #20 & #21: _openSidebar / _closeSidebar
  // ============================================================
  /**
   * Buka sidebar (khusus tampilan mobile).
   * Menambahkan class "is-open" ke sidebar → CSS slide-in dari kiri.
   */
  function _openSidebar() {
    DOM.sidebar?.classList.add("is-open");
    _ensureOverlay(); // Tampilkan overlay gelap di belakang sidebar
  }

  /**
   * Tutup sidebar (khusus tampilan mobile).
   * Menghapus class "is-open" → sidebar slide-out kembali.
   */
  function _closeSidebar() {
    DOM.sidebar?.classList.remove("is-open");
    document.querySelector(".sidebar-overlay")?.classList.remove("is-visible");
  }

  /**
   * Buat overlay gelap di belakang sidebar (agar bisa diklik untuk tutup).
   * Dibuat secara JavaScript karena tidak selalu dibutuhkan (hanya mobile).
   */
  function _ensureOverlay() {
    let overlay = document.querySelector(".sidebar-overlay");
    if (!overlay) {
      // Buat elemen overlay jika belum ada
      overlay = document.createElement("div");
      overlay.className = "sidebar-overlay";
      document.body.appendChild(overlay);

      // Klik overlay = tutup sidebar
      overlay.addEventListener("click", _closeSidebar);
    }
    overlay.classList.add("is-visible");
  }


  // ============================================================
  // FUNGSI PUBLIC #3: showToast ← Dipakai di mana saja
  // ============================================================
  /**
   * Tampilkan notifikasi toast (pop-up kecil) di bagian bawah layar.
   *
   * Toast otomatis menghilang setelah beberapa detik.
   *
   * Jenis toast dan warnanya:
   *   'default'  → Hitam (informasi netral)
   *   'success'  → Hijau (berhasil)
   *   'warning'  → Kuning (peringatan)
   *   'error'    → Merah (gagal/error)
   *   'info'     → Biru (informasi penting)
   *
   * Contoh penggunaan:
   *   showToast("Rute dioptimalkan!", "success");
   *   showToast("Terjadi error!", "error", 5000); // hilang setelah 5 detik
   *
   * @param {string} message  - Teks notifikasi
   * @param {string} type     - Jenis/warna toast
   * @param {number} duration - Lama tampil dalam ms (default: 3000 = 3 detik)
   */
  function showToast(message, type = "default", duration = 3000) {
    if (!DOM.toastContainer) return;

    // Buat elemen toast baru
    const toast = document.createElement("div");
    toast.className = `toast${type !== "default" ? ` toast--${type}` : ""}`;

    // Pilih ikon SVG sesuai jenis toast
    const icons = {
      success: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      warning: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      error:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      default: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
    };

    // Isi toast dengan ikon + pesan
    toast.innerHTML = `${icons[type] || icons.default} ${_escapeHTML(message)}`;
    DOM.toastContainer.appendChild(toast);

    // Auto-dismiss: hapus toast setelah `duration` ms
    setTimeout(() => {
      toast.classList.add("toast--out"); // Trigger animasi keluar
      setTimeout(() => toast.remove(), 350); // Hapus dari DOM setelah animasi
    }, duration);
  }


  // ============================================================
  // FUNGSI PRIVATE #22: _escapeHTML
  // ============================================================
  /**
   * Mengamankan teks dari user agar tidak bisa menyuntikkan HTML/JS berbahaya.
   * Ini disebut "sanitasi" untuk mencegah serangan XSS (Cross-Site Scripting).
   *
   * Contoh:
   *   Input:  '<script>alert("hack!")</script>'
   *   Output: '&lt;script&gt;alert("hack!")&lt;/script&gt;'
   *   (Ditampilkan sebagai teks biasa, bukan dieksekusi sebagai kode)
   *
   * Cara kerja:
   * → Buat elemen div sementara
   * → Set textContent (otomatis di-escape oleh browser)
   * → Baca kembali innerHTML (sudah aman)
   *
   * @param {string} str - Teks yang mungkin berbahaya
   * @returns {string}   - Teks yang sudah aman
   */
  function _escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }


  // ============================================================
  // PUBLIC API — Fungsi yang bisa diakses dari file lain
  // ============================================================
  return {
    init,               // map.js → Dipanggil saat DOMContentLoaded
    addLocationFromMap, // map.js → Dipanggil saat user klik peta
    showToast,          // Bisa dipanggil dari mana saja untuk notifikasi
  };

})(); // ← Tutup IIFE dan langsung eksekusi


// ============================================================
// BOOTSTRAP — Mulai aplikasi saat HTML selesai dimuat browser
// ============================================================
/**
 * DOMContentLoaded = event yang terjadi saat browser selesai
 * membaca dan memproses seluruh HTML, tapi SEBELUM gambar/CSS selesai.
 *
 * Kenapa tidak langsung panggil UIModule.init()?
 * → Karena saat script dijalankan, HTML mungkin belum selesai dimuat
 * → Sehingga document.getElementById() bisa mengembalikan null
 * → Menunggu DOMContentLoaded memastikan semua elemen sudah ada
 */
document.addEventListener("DOMContentLoaded", () => {
  UIModule.init();
});
