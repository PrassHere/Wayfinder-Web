/**
 * ============================================================
 * FILE: map.js
 * PERAN: Mengontrol semua yang terjadi di dalam peta
 * ============================================================
 *
 * File ini bertanggung jawab atas:
 *   1. Menyiapkan peta Leaflet.js saat pertama kali dibuka
 *   2. Menambah dan menghapus marker (pin) di peta
 *   3. Menggambar garis rute antar lokasi
 *   4. Menangani klik user pada peta
 *
 * LEAFLET.JS adalah library JavaScript gratis untuk membuat
 * peta interaktif. Data peta (gambar ubin/tile) diambil dari
 * OpenStreetMap secara otomatis via internet.
 *
 * FILE INI DIPANGGIL OLEH: ui.js
 * FILE INI MEMANGGIL: Tidak ada (hanya menggunakan Leaflet)
 */


// ============================================================
// KONSTANTA: Palet Warna Rute
// ============================================================
/**
 * Daftar warna yang digunakan untuk mewarnai setiap SEGMEN rute.
 * Segmen = garis dari titik A ke titik B.
 *
 * Setiap warna punya dua versi:
 *   stroke → warna garis utama (solid, jelas)
 *   light  → warna glow/bayangan (transparan, untuk efek kedalaman)
 *
 * Warna dipakai secara CYCLIC (berulang):
 *   Titik 1→2: warna index 0 (Biru langit)
 *   Titik 2→3: warna index 1 (Hijau segar)
 *   ...
 *   Titik 9→10: warna index 0 lagi (kembali ke awal)
 *
 * Ini didefinisikan di LUAR MapModule agar bisa diakses
 * dari seluruh file tanpa harus membuka "pintu" modul.
 */
const ROUTE_COLORS = [
  { stroke: "#4a90d9", light: "#c2dcf5" }, // Biru langit   (segmen 1→2)
  { stroke: "#5cb85c", light: "#c5e8c5" }, // Hijau segar   (segmen 2→3)
  { stroke: "#e8a838", light: "#f6e2b4" }, // Oranye hangat (segmen 3→4)
  { stroke: "#9b59b6", light: "#ddc7ec" }, // Ungu elegan   (segmen 4→5)
  { stroke: "#e05c5c", light: "#f5c6c6" }, // Merah muda    (segmen 5→6)
  { stroke: "#1abc9c", light: "#b7ece3" }, // Teal          (segmen 6→7)
  { stroke: "#f39c12", light: "#fce4b0" }, // Kuning amber  (segmen 7→8)
  { stroke: "#2980b9", light: "#b9d9ee" }, // Biru tua      (segmen 8→... dst)
];


// ============================================================
// MapModule: Objek utama pengontrol peta
// Menggunakan pola IIFE (fungsi yang langsung dieksekusi)
// ============================================================
const MapModule = (() => {

  // ----------------------------------------------------------
  // STATE INTERNAL (variabel yang menyimpan kondisi peta)
  // Semua variabel ini hanya bisa diakses dari dalam MapModule
  // ----------------------------------------------------------

  /** Instance peta Leaflet. Null = peta belum dibuat. */
  let mapInstance = null;

  /**
   * LayerGroup = wadah/grup untuk sekumpulan marker.
   * Menggunakan LayerGroup memudahkan operasi massal:
   *   - markerLayerGroup.clearLayers() → hapus semua marker sekaligus
   * (lebih efisien daripada hapus satu-satu)
   */
  let markerLayerGroup = null;

  /**
   * Array yang menyimpan SEMUA polyline (garis rute) yang aktif.
   * Setiap segmen rute berwarna menghasilkan 2 layer:
   *   [glowLine_1, mainLine_1, glowLine_2, mainLine_2, ...]
   *
   * Kenapa disimpan di array?
   * → Agar bisa dihapus semua sekaligus saat rute berubah
   * → Mencegah MEMORY LEAK (layer lama menumpuk di memori)
   */
  let routeSegments = [];

  /**
   * Polyline garis putus-putus saat lokasi belum dioptimalkan.
   * Dipisah dari routeSegments karena penanganannya berbeda.
   */
  let previewPolyline = null;

  /**
   * Registry (direktori) marker: { id → Leaflet Marker object }
   * Contoh: { "loc_1": <MarkerObject>, "loc_2": <MarkerObject> }
   *
   * Kenapa pakai objek (bukan array)?
   * → Pencarian by ID lebih cepat: markerRegistry["loc_1"]
   * → Daripada array yang harus di-loop satu per satu
   */
  const markerRegistry = {};

  // ----------------------------------------------------------
  // KONSTANTA PETA
  // ----------------------------------------------------------

  /** Posisi awal peta saat dibuka: tengah Indonesia */
  const DEFAULT_CENTER = [-2.5, 118.0];

  /** Zoom awal: angka besar = lebih dekat, kecil = lebih jauh */
  const DEFAULT_ZOOM = 5;

  /**
   * URL template untuk tile (ubin gambar peta) OpenStreetMap.
   * {s} = subdomain (a/b/c, digilir untuk performa)
   * {z} = zoom level
   * {x},{y} = koordinat tile
   */
  const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  /** Teks kredit peta yang ditampilkan di pojok bawah. */
  const TILE_ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';


  // ============================================================
  // FUNGSI PUBLIC #1: init
  // ============================================================
  /**
   * Menginisialisasi (menyiapkan) peta Leaflet pertama kali.
   * Dipanggil SEKALI oleh ui.js saat aplikasi dibuka.
   *
   * Langkah yang dilakukan:
   * 1. Buat instance peta di elemen <div id="map">
   * 2. Tambahkan tile layer (gambar peta dari OpenStreetMap)
   * 3. Buat layer group untuk marker
   * 4. Pasang event listener untuk klik peta
   * 5. Inisialisasi tombol FAB (floating action buttons)
   */
  function init() {
    // Guard: jangan inisialisasi dua kali
    // Kalau mapInstance sudah ada, hentikan fungsi
    if (mapInstance) return;

    // Buat peta Leaflet dan tempelkan ke elemen HTML <div id="map">
    mapInstance = L.map("map", {
      center:           DEFAULT_CENTER, // Posisi awal (tengah Indonesia)
      zoom:             DEFAULT_ZOOM,   // Level zoom awal
      zoomControl:      true,           // Tampilkan tombol +/- zoom
      attributionControl: true,         // Tampilkan kredit di pojok bawah
    });

    // Pindahkan tombol zoom dari pojok kiri atas → kiri bawah
    // (agar tidak mengganggu tampilan sidebar)
    mapInstance.zoomControl.setPosition("bottomleft");

    // Tambahkan tile layer dari OpenStreetMap
    // Tanpa ini, peta hanya menampilkan latar belakang kosong
    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIB,
      maxZoom: 19, // Zoom maksimum yang diizinkan
    }).addTo(mapInstance);

    // Buat LayerGroup untuk semua marker dan langsung tambahkan ke peta
    markerLayerGroup = L.layerGroup().addTo(mapInstance);

    // Pasang event: saat user klik di peta, panggil _onMapClick
    mapInstance.on("click", _onMapClick);

    // Inisialisasi tombol FAB (center & fit bounds)
    _initFabControls();

    console.info("[WayFinder Map] Peta berhasil diinisialisasi ✓");
  }


  // ============================================================
  // FUNGSI PRIVATE #1: _onMapClick
  // ============================================================
  /**
   * Handler yang dipanggil SETIAP KALI user mengklik di peta.
   *
   * @param {Event} e - Event objek dari Leaflet
   *   e.latlng = koordinat tempat user mengklik
   */
  function _onMapClick(e) {
    // Ambil koordinat dari event klik
    const { lat, lng } = e.latlng;

    // Cek apakah user sudah mengisi nama lokasi di input
    const nameInput = document.getElementById("locationInput");
    const rawName   = nameInput ? nameInput.value.trim() : "";

    // Teruskan ke UIModule untuk diproses (tambah ke state & render)
    // typeof UIModule !== "undefined" = pastikan ui.js sudah dimuat
    if (typeof UIModule !== "undefined") {
      UIModule.addLocationFromMap(lat, lng, rawName);

      // Kosongkan input setelah digunakan
      if (nameInput) nameInput.value = "";
    }
  }


  // ============================================================
  // FUNGSI PUBLIC #2: addMarker
  // ============================================================
  /**
   * Menambahkan sebuah marker (pin) ke peta dengan tampilan bulat modern.
   *
   * Marker dibuat menggunakan L.divIcon() — artinya ikon marker
   * dibuat dari HTML/CSS biasa, bukan gambar PNG bawaan Leaflet.
   * Ini memberi kita kontrol penuh atas tampilan marker.
   *
   * @param {string}  id      - ID unik lokasi (dari state ui.js)
   * @param {number}  lat     - Latitude
   * @param {number}  lng     - Longitude
   * @param {string}  label   - Nama lokasi (muncul di tooltip/popup)
   * @param {number}  index   - Nomor urutan (ditampilkan di tengah marker)
   * @param {boolean} isStart - Apakah ini titik pertama? (tambah pulse animation)
   */
  function addMarker(id, lat, lng, label, index, isStart = false) {

    // Pilih warna berdasarkan nomor urutan (cyclic)
    // Contoh: index=1 → colorIdx=0, index=9 → colorIdx=0 (mulai lagi)
    const colorIdx = (index - 1) % ROUTE_COLORS.length;
    const color    = ROUTE_COLORS[colorIdx];

    // Buat ikon custom menggunakan DivIcon (HTML marker, bukan gambar)
    const icon = L.divIcon({
      className: "",  // Kosongkan class default Leaflet (agar CSS kita tidak ditimpa)
      html:      _buildMarkerHTML(index, isStart, color), // HTML marker bulat
      iconSize:    [36, 36], // Ukuran area klik marker (px)
      iconAnchor:  [18, 18], // Titik "jarum" marker = tengah lingkaran
      popupAnchor: [0, -22], // Posisi popup relatif terhadap marker
    });

    // Buat marker Leaflet, tambahkan ke LayerGroup (bukan langsung ke peta)
    const marker = L.marker([lat, lng], { icon })
      .addTo(markerLayerGroup)
      // Ikat popup (muncul saat marker diklik)
      .bindPopup(_buildPopupHTML(label, lat, lng, index, color), {
        className:   "wf-popup", // Class CSS custom untuk styling popup
        maxWidth:    240,
        closeButton: true,
      });

    // Simpan marker ke registry menggunakan id sebagai key
    // Nanti digunakan untuk: removeMarker(id), panToMarker(id), dll
    markerRegistry[id] = marker;

    // Ikat tooltip (muncul saat hover marker)
    // Format: "1. Malioboro" — nomor urutan + nama
    marker.bindTooltip(`<b>${index}.</b> ${label}`, {
      permanent:  false,      // Hanya tampil saat hover (bukan terus-menerus)
      direction:  "top",      // Tooltip muncul di atas marker
      offset:     [0, -22],
      className:  "wf-tooltip",
    });

    return marker;
  }


  // ============================================================
  // FUNGSI PUBLIC #3: removeMarker
  // ============================================================
  /**
   * Menghapus satu marker dari peta dan dari registry.
   * Dipanggil saat user menekan tombol ✕ di kartu lokasi sidebar.
   *
   * @param {string} id - ID lokasi yang akan dihapus
   */
  function removeMarker(id) {
    // Cek apakah marker dengan id ini ada di registry
    if (!markerRegistry[id]) return;

    // Hapus dari peta (melalui LayerGroup)
    markerLayerGroup.removeLayer(markerRegistry[id]);

    // Hapus dari registry (bebaskan memori)
    delete markerRegistry[id];
  }


  // ============================================================
  // FUNGSI PUBLIC #4: removeAllMarkers
  // ============================================================
  /**
   * Menghapus SEMUA marker dari peta sekaligus.
   * Dipanggil saat user menekan "Hapus Semua Titik" atau
   * saat memuat template baru.
   *
   * clearLayers() jauh lebih cepat dari menghapus satu per satu.
   */
  function removeAllMarkers() {
    // Hapus semua layer dari LayerGroup (termasuk semua marker)
    markerLayerGroup.clearLayers();

    // Kosongkan registry — penting agar tidak ada referensi "hantu"
    // Object.keys() = ambil semua key, forEach = loop tiap key
    Object.keys(markerRegistry).forEach((k) => delete markerRegistry[k]);
  }


  // ============================================================
  // FUNGSI PUBLIC #5: refreshMarkerIcons
  // ============================================================
  /**
   * Memperbarui tampilan SEMUA marker setelah optimasi TSP.
   *
   * Kenapa perlu?
   * Setelah optimasi, urutan lokasi berubah:
   *   Sebelum: A(1) → B(2) → C(3)
   *   Sesudah: A(1) → C(2) → B(3)
   *
   * Jadi angka di dalam marker B harus berubah dari "2" → "3"
   * dan C dari "3" → "2". Fungsi ini melakukannya.
   *
   * @param {Array} locations - Array lokasi dengan urutan BARU dari TSP
   */
  function refreshMarkerIcons(locations) {
    locations.forEach((loc, idx) => {
      // Ambil marker dari registry menggunakan id lokasi
      const marker = markerRegistry[loc.id];
      if (!marker) return; // Skip jika marker tidak ditemukan

      const isStart  = idx === 0;                          // Titik pertama?
      const colorIdx = idx % ROUTE_COLORS.length;          // Warna cyclic
      const color    = ROUTE_COLORS[colorIdx];

      // Buat ikon baru dengan nomor urutan yang sudah diperbarui
      const icon = L.divIcon({
        className:   "",
        html:        _buildMarkerHTML(idx + 1, isStart, color),
        iconSize:    [36, 36],
        iconAnchor:  [18, 18],
        popupAnchor: [0, -22],
      });

      // Ganti ikon marker yang sudah ada di peta
      marker.setIcon(icon);

      // Perbarui tooltip dengan nomor urutan baru
      marker.unbindTooltip(); // Hapus tooltip lama
      marker.bindTooltip(`<b>${idx + 1}.</b> ${loc.name}`, {
        permanent: false,
        direction: "top",
        offset:    [0, -22],
        className: "wf-tooltip",
      });
    });
  }


  // ============================================================
  // FUNGSI PUBLIC #6: drawRoute ← FUNGSI PALING PENTING
  // ============================================================
  /**
   * Menggambar garis rute di peta.
   *
   * Ada DUA mode:
   * ┌──────────────────────────────────────────────────────────┐
   * │ Mode PREVIEW (isOptimized = false)                       │
   * │   → Satu garis putus-putus abu-abu                       │
   * │   → Digunakan saat lokasi baru ditambah, belum optimal   │
   * │   → Memberi gambaran "rute seadanya"                     │
   * ├──────────────────────────────────────────────────────────┤
   * │ Mode OPTIMIZED (isOptimized = true)                      │
   * │   → Setiap segmen A→B digambar TERPISAH                  │
   * │   → Setiap segmen punya WARNA BERBEDA                    │
   * │   → Digunakan setelah TSP selesai                        │
   * │   → Memudahkan melihat urutan perjalanan                 │
   * └──────────────────────────────────────────────────────────┘
   *
   * @param {Array<[number,number]>} latlngs - Array koordinat [lat, lng]
   * @param {boolean} isOptimized - Mode rute
   */
  function drawRoute(latlngs, isOptimized = false) {
    // Langkah 1: Hapus SEMUA rute lama sebelum menggambar yang baru
    // Ini penting agar tidak terjadi penumpukan layer di peta
    clearRoute();

    // Langkah 2: Validasi — butuh minimal 2 titik untuk membuat garis
    if (!latlngs || latlngs.length < 2) return;

    if (!isOptimized) {
      // Mode Preview: gambar satu garis putus-putus
      _drawPreviewLine(latlngs);
    } else {
      // Mode Optimized: gambar segmen berwarna terpisah
      _drawSegmentedRoute(latlngs);
    }
  }


  // ============================================================
  // FUNGSI PRIVATE #2: _drawPreviewLine
  // ============================================================
  /**
   * Gambar satu polyline putus-putus (preview sebelum optimasi).
   * Warna abu-abu untuk membedakan dari rute yang sudah dioptimalkan.
   *
   * @param {Array} latlngs - Array koordinat
   */
  function _drawPreviewLine(latlngs) {
    // Tutup loop: tambahkan titik pertama di akhir
    // Tujuan: rute kembali ke titik awal (membentuk lingkaran)
    const closedPath = [...latlngs, latlngs[0]];

    previewPolyline = L.polyline(closedPath, {
      color:     "#aaaaaa", // Abu-abu
      weight:    2,         // Ketebalan garis (px)
      opacity:   0.55,      // Transparansi (0=tidak terlihat, 1=solid)
      dashArray: "8, 7",    // Pola putus-putus: 8px garis, 7px spasi
      lineCap:   "round",   // Ujung garis berbentuk bulat
      lineJoin:  "round",   // Sambungan garis berbentuk bulat
    }).addTo(mapInstance);
  }


  // ============================================================
  // FUNGSI PRIVATE #3: _drawSegmentedRoute
  // ============================================================
  /**
   * Gambar rute dengan SEGMEN TERPISAH dan WARNA BERBEDA.
   *
   * Setiap segmen (A→B) digambar dengan DUA layer:
   *
   *   Layer 1 (Glow): Garis tebal dan transparan
   *   → Memberikan efek "bayangan" atau "glow" di bawah garis utama
   *   → Membuat garis terasa lebih dalam/tebal secara visual
   *
   *   Layer 2 (Main): Garis tipis dan solid
   *   → Garis utama yang terlihat jelas
   *   → Memiliki efek hover (menebal saat mouse di atasnya)
   *
   * ANTI MEMORY LEAK:
   * Setiap layer yang dibuat disimpan ke array routeSegments[].
   * Saat clearRoute() dipanggil, semua layer di array ini dihapus.
   * Tanpa ini, layer lama akan terus menumpuk di memori browser!
   *
   * @param {Array} latlngs - Array koordinat
   */
  function _drawSegmentedRoute(latlngs) {
    const total = latlngs.length; // Jumlah total titik

    latlngs.forEach((point, idx) => {
      // Tentukan titik berikutnya
      // (idx + 1) % total → jika idx = titik terakhir, nextPoint = titik pertama
      // Ini yang membuat loop tertutup (kembali ke awal)
      const nextPoint = latlngs[(idx + 1) % total];

      // Pilih warna untuk segmen ini (cyclic dari palet)
      const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];

      // ── Layer 1: Glow Effect ──────────────────────────────
      // Garis tebal & transparan → efek "cahaya" di sekitar garis utama
      const glowLine = L.polyline([point, nextPoint], {
        color:   color.light, // Warna light (lebih pucat)
        weight:  9,           // Sangat tebal (untuk efek glow)
        opacity: 0.35,        // Sangat transparan
        lineCap: "round",
      }).addTo(mapInstance);

      // ── Layer 2: Garis Utama ──────────────────────────────
      const mainLine = L.polyline([point, nextPoint], {
        color:    color.stroke, // Warna utama (lebih gelap/cerah)
        weight:   3.5,          // Ketebalan normal
        opacity:  0.9,          // Hampir solid
        lineCap:  "round",
        lineJoin: "round",
      }).addTo(mapInstance);

      // ── Event Hover ───────────────────────────────────────
      // Saat mouse masuk ke garis → garis menebal
      mainLine.on("mouseover", function () {
        this.setStyle({ weight: 5.5, opacity: 1 });  // Lebih tebal & solid
        glowLine.setStyle({ opacity: 0.55 });          // Glow lebih terang
      });

      // Saat mouse keluar dari garis → kembali ke ukuran normal
      mainLine.on("mouseout", function () {
        this.setStyle({ weight: 3.5, opacity: 0.9 });
        glowLine.setStyle({ opacity: 0.35 });
      });

      // Tooltip saat hover garis → info segmen berapa ke berapa
      mainLine.bindTooltip(
        `<span class="seg-tooltip">Segmen ${idx + 1} → ${(idx + 1) % total + 1}</span>`,
        { sticky: true, className: "wf-seg-tooltip" }
      );

      // SIMPAN KEDUA LAYER ke array routeSegments[]
      // Penting: push dua-duanya agar bisa dihapus bersama saat clearRoute()
      routeSegments.push(glowLine, mainLine);
    });
  }


  // ============================================================
  // FUNGSI PUBLIC #7: clearRoute
  // ============================================================
  /**
   * Menghapus SEMUA garis rute dari peta.
   *
   * Wajib dipanggil sebelum menggambar rute baru.
   * Juga dipanggil saat semua lokasi dihapus.
   *
   * KENAPA PENTING mencegah memory leak?
   * Tanpa clearRoute(), setiap kali rute digambar ulang,
   * layer lama masih ada di memori meski tidak terlihat.
   * Lama-kelamaan browser bisa jadi lambat atau crash.
   */
  function clearRoute() {
    // Hapus setiap polyline yang tersimpan di array routeSegments
    routeSegments.forEach((layer) => {
      // hasLayer() = cek dulu apakah layer ini masih ada di peta
      if (mapInstance.hasLayer(layer)) {
        mapInstance.removeLayer(layer); // Hapus dari peta
      }
    });

    // RESET array ke kosong ← Langkah paling penting!
    // Tanpa ini, array akan terus bertambah dan referensi lama tidak dibebaskan
    routeSegments = [];

    // Hapus juga preview polyline (jika ada)
    if (previewPolyline && mapInstance.hasLayer(previewPolyline)) {
      mapInstance.removeLayer(previewPolyline);
      previewPolyline = null; // Set ke null agar garbage collector bisa bebas
    }
  }


  // ============================================================
  // FUNGSI PUBLIC #8: fitBoundsToMarkers
  // ============================================================
  /**
   * Sesuaikan zoom dan posisi peta agar SEMUA marker terlihat.
   *
   * Contoh penggunaan:
   * → Saat template Jogja dimuat (6 titik tersebar)
   * → Setelah optimasi rute selesai
   *
   * padding: [60, 60] → beri jarak 60px dari tepi layar
   * maxZoom: 14 → jangan zoom terlalu dekat meski titiknya berdekatan
   */
  function fitBoundsToMarkers() {
    const keys = Object.keys(markerRegistry);
    if (keys.length === 0) return; // Tidak ada marker → tidak perlu fit

    // Buat feature group dari semua marker yang ada
    const group = L.featureGroup(keys.map((k) => markerRegistry[k]));

    // Sesuaikan tampilan peta agar semua marker muat dalam layar
    mapInstance.fitBounds(group.getBounds(), {
      padding: [60, 60],
      maxZoom: 14,
    });
  }


  // ============================================================
  // FUNGSI PUBLIC #9: panToMarker
  // ============================================================
  /**
   * Geser (pan) peta agar terpusat pada satu marker tertentu,
   * lalu buka popup marker tersebut.
   *
   * Dipanggil saat user mengklik kartu lokasi di sidebar.
   *
   * @param {string} id - ID lokasi yang dituju
   */
  function panToMarker(id) {
    const marker = markerRegistry[id];
    if (!marker) return; // Jika marker tidak ditemukan, stop

    // Animasikan pergeseran peta selama 0.5 detik
    mapInstance.panTo(marker.getLatLng(), { animate: true, duration: 0.5 });

    // Buka popup marker
    marker.openPopup();
  }


  // ============================================================
  // FUNGSI PUBLIC #10: resetView
  // ============================================================
  /**
   * Kembalikan peta ke posisi awal (tengah Indonesia, zoom 5).
   * Dipanggil saat user menekan tombol FAB "Center" di peta.
   */
  function resetView() {
    mapInstance.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true });
  }


  // ============================================================
  // FUNGSI PRIVATE #4: _initFabControls
  // ============================================================
  /**
   * Pasang event listener ke tombol-tombol FAB (mengambang) di peta.
   * FAB = Floating Action Button
   *
   * Tombol ini ada di pojok kanan bawah peta:
   *   centerMapBtn  → Reset ke posisi Indonesia
   *   fitBoundsBtn  → Sesuaikan zoom ke semua marker
   */
  function _initFabControls() {
    const centerBtn    = document.getElementById("centerMapBtn");
    const fitBoundsBtn = document.getElementById("fitBoundsBtn");

    // Optional chaining (?.) = hanya pasang event jika elemen ditemukan
    centerBtn?.addEventListener("click", resetView);
    fitBoundsBtn?.addEventListener("click", fitBoundsToMarkers);
  }


  // ============================================================
  // FUNGSI PRIVATE #5: _buildMarkerHTML
  // ============================================================
  /**
   * Membuat string HTML untuk custom marker bulat.
   *
   * Menggunakan CSS Custom Properties (variabel CSS inline):
   *   --marker-color → warna background lingkaran
   *   --marker-ring  → warna ring pulse (hanya untuk start marker)
   *
   * Kelas CSS yang digunakan (ada di style.css):
   *   .wf-marker         → wrapper
   *   .wf-marker__circle → lingkaran berwarna
   *   .wf-marker__num    → angka urutan di tengah
   *   .wf-marker__pulse  → animasi ring (hanya start marker)
   *   .wf-marker--start  → style khusus untuk marker pertama
   *
   * @param {number}  index   - Nomor urutan (1, 2, 3, ...)
   * @param {boolean} isStart - Apakah marker pertama?
   * @param {object}  color   - { stroke, light } dari ROUTE_COLORS
   * @returns {string} HTML string
   */
  function _buildMarkerHTML(index, isStart, color) {
    // Warna default jika color tidak tersedia (sebelum optimasi)
    const bg      = color ? color.stroke : "#111110";
    const ringClr = color ? color.light  : "#f0e4bb";

    // Class tambahan khusus marker pertama
    const startClass = isStart ? "wf-marker--start" : "";

    return `
      <div class="wf-marker ${startClass}"
           style="--marker-color: ${bg}; --marker-ring: ${ringClr};">

        <!-- Lingkaran berwarna dengan nomor di tengah -->
        <div class="wf-marker__circle">
          <span class="wf-marker__num">${index}</span>
        </div>

        <!-- Animasi ring pulse — hanya muncul jika isStart = true -->
        ${isStart ? '<div class="wf-marker__pulse"></div>' : ""}
      </div>
    `;
  }


  // ============================================================
  // FUNGSI PRIVATE #6: _buildPopupHTML
  // ============================================================
  /**
   * Membuat konten HTML popup yang muncul saat marker diklik.
   *
   * Popup menampilkan:
   *   - Badge nomor urutan (berwarna sesuai segmen rute)
   *   - Nama lokasi
   *   - Koordinat GPS (dengan presisi 5 desimal)
   *
   * Warna popup disesuaikan dengan warna segmen rute
   * agar tampak kohesif (badge, border, dll satu warna).
   *
   * @param {string} label  - Nama lokasi
   * @param {number} lat    - Latitude
   * @param {number} lng    - Longitude
   * @param {number} index  - Nomor urutan
   * @param {object} color  - { stroke, light } dari ROUTE_COLORS
   * @returns {string} HTML string
   */
  function _buildPopupHTML(label, lat, lng, index, color) {
    // Warna aksen untuk popup (sesuai segmen)
    const accentColor = color ? color.stroke : "#c9a84c";

    return `
      <div class="wf-popup-content">

        <!-- Header: strip warna kiri + badge nomor + nama lokasi -->
        <div class="wf-popup-header" style="border-left-color: ${accentColor};">
          <span class="wf-popup-num" style="background: ${accentColor};">${index}</span>
          <span class="wf-popup-name">${label}</span>
        </div>

        <!-- Koordinat GPS -->
        <div class="wf-popup-coords">
          <!-- Ikon pin kecil (SVG) -->
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          ${lat.toFixed(5)}, ${lng.toFixed(5)}
        </div>

      </div>
    `;
  }


  // ============================================================
  // PUBLIC API — Daftar fungsi yang bisa diakses dari luar
  // ============================================================
  // ui.js hanya bisa memanggil fungsi yang ada di sini.
  // Fungsi dengan nama diawali '_' tetap tersembunyi (private).
  return {
    init,               // Inisialisasi peta (dipanggil sekali)
    addMarker,          // Tambah 1 marker ke peta
    removeMarker,       // Hapus 1 marker dari peta
    removeAllMarkers,   // Hapus semua marker
    refreshMarkerIcons, // Perbarui angka di marker setelah optimasi
    drawRoute,          // Gambar garis rute (preview/optimized)
    clearRoute,         // Hapus semua garis rute
    fitBoundsToMarkers, // Zoom peta agar semua marker terlihat
    panToMarker,        // Geser peta ke 1 marker tertentu
    resetView,          // Kembali ke posisi Indonesia
  };

})(); // ← Tutup dan langsung eksekusi IIFE
