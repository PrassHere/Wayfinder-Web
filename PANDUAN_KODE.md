# 📖 PANDUAN KODE — WayFinder Route Optimizer

> Dokumen ini menjelaskan **seluruh kode** dalam proyek WayFinder secara detail,
> termasuk cara kerja setiap file, keterkaitan antar file, dan fungsi-fungsi di dalamnya.
> Ditulis agar mudah dipahami oleh mahasiswa.

---

## 🗺️ Gambaran Besar Aplikasi

WayFinder adalah aplikasi **optimasi rute wisata** yang menggunakan algoritma
**TSP (Travelling Salesman Problem)** — yaitu algoritma untuk mencari urutan kunjungan
titik-titik yang menghasilkan jarak total paling pendek.

### Cara Kerja Secara Umum

```
Pengguna klik peta          Pengguna klik
atau pilih template    →    "Optimalkan Rute"   →   Backend Python hitung TSP
     ↓                             ↓                        ↓
Marker muncul di peta    Frontend kirim data          Kirim balik urutan
Sidebar list terisi      ke backend via HTTP          titik yang optimal
                                                            ↓
                                               Peta tampilkan rute berwarna
```

---

## 📁 Struktur Folder Proyek

```
UAS WayFinder/
│
├── frontend/                   ← Antarmuka pengguna (HTML/CSS/JS)
│   ├── index.html              ← Kerangka tampilan (struktur halaman)
│   ├── css/
│   │   └── style.css           ← Semua gaya visual & animasi
│   └── js/
│       ├── api.js              ← Komunikasi dengan backend
│       ├── map.js              ← Kontrol peta Leaflet
│       └── ui.js               ← Kontrol tampilan & state aplikasi
│
└── backend/                    ← Server Python (Flask)
    ├── app.py                  ← Entry point server
    ├── tsp.py                  ← Algoritma TSP Brute Force
    ├── distance.py             ← Perhitungan jarak Haversine
    ├── requirements.txt        ← Daftar library Python
    └── routes/
        └── api.py              ← Endpoint HTTP (GET/POST)
```

---

## 🔗 Diagram Keterkaitan Antar File

```
                    ┌─────────────────┐
                    │   index.html    │  ← Halaman utama browser
                    │  (Kerangka UI)  │
                    └────────┬────────┘
                             │ me-load (berurutan)
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
          api.js          map.js          ui.js
       (Komunikasi)    (Peta Leaflet)  (State & UI)
              │              │              │
              │    ui.js memanggil map.js   │
              │◄─────────────┤◄────────────┘
              │              │
              │  ui.js memanggil api.js
              │◄─────────────────────────────┘
              │
              │  HTTP POST /api/optimize
              ▼
        ┌─────────────┐
        │   app.py    │  ← Flask server
        └──────┬──────┘
               │ mendaftarkan
               ▼
        ┌─────────────┐
        │  routes/    │  ← Endpoint API
        │   api.py    │
        └──────┬──────┘
               │ memanggil
               ▼
          ┌─────────┐
          │  tsp.py │  ← Algoritma TSP
          └────┬────┘
               │ memanggil
               ▼
        ┌──────────────┐
        │ distance.py  │  ← Rumus Haversine
        └──────────────┘
```

### Penjelasan Alur Keterkaitan

| File            | Dipanggil oleh        | Memanggil                          |
| --------------- | --------------------- | ---------------------------------- |
| `index.html`    | Browser               | Memuat `api.js`, `map.js`, `ui.js` |
| `ui.js`         | `index.html`          | `map.js`, `api.js`                 |
| `map.js`        | `index.html`, `ui.js` | —                                  |
| `api.js`        | `index.html`, `ui.js` | Backend HTTP                       |
| `app.py`        | Terminal (python)     | `routes/api.py`                    |
| `routes/api.py` | `app.py`              | `tsp.py`                           |
| `tsp.py`        | `routes/api.py`       | `distance.py`                      |
| `distance.py`   | `tsp.py`              | —                                  |

---

---

# 🌐 FRONTEND

---

## 1. `index.html` — Kerangka Tampilan

**Peran:** File ini adalah "tulang" dari halaman web. Ia mendefinisikan **struktur HTML**
(bagian-bagian halaman) tetapi tidak mengandung logika apapun.

### Struktur Layout

```
<body>
│
├── <header class="topbar">         ← Bar atas: search + status
│
└── <main class="app-layout">
    │
    ├── <aside class="sidebar">     ← Panel kiri
    │   ├── Brand / Logo
    │   ├── .sidebar__body          ← BAGIAN YANG BISA DI-SCROLL
    │   │   ├── Form tambah lokasi
    │   │   ├── Template Wisata Jogja
    │   │   └── Daftar lokasi (location-list)
    │   │
    │   └── .sidebar__footer        ← STICKY DI BAWAH (tidak ikut scroll)
    │       ├── Stats (jarak & waktu)
    │       ├── Info urutan rute
    │       └── Tombol Optimize + Hapus Semua
    │
    └── <section class="map-area">  ← Area peta (kanan)
        ├── #map                    ← Target Leaflet.js
        ├── .map-fab-group          ← Tombol mengambang di peta
        └── .map-hint               ← Petunjuk "klik peta"
```

### Kenapa `.sidebar__body` dan `.sidebar__footer` dipisah?

Ini solusi untuk masalah layout:

- **`.sidebar__body`** → dapat di-scroll (`overflow-y: auto`)
- **`.sidebar__footer`** → selalu terlihat (`flex-shrink: 0`)

Sehingga ketika lokasi banyak dan list panjang, tombol Optimize **tidak akan tertimpa**
oleh daftar lokasi.

### Urutan Loading Script

```html
<script src="js/api.js"></script>
← Dimuat pertama
<script src="js/map.js"></script>
← Dimuat kedua
<script src="js/ui.js"></script>
← Dimuat terakhir, lalu langsung init
```

Urutan ini **penting** karena `ui.js` memanggil `MapModule` (dari `map.js`) dan
`ApiModule` (dari `api.js`), jadi kedua modul itu harus sudah tersedia lebih dulu.

---

## 2. `css/style.css` — Semua Gaya Visual

**Peran:** Mengatur tampilan visual seluruh aplikasi — warna, ukuran, animasi, layout,
dan responsive.

### Sistem CSS Custom Properties (Variabel CSS)

File ini menggunakan variabel CSS yang didefinisikan di `:root {}` agar mudah
diubah dari satu tempat:

```css
:root {
  --color-accent: #c9a84c; /* Warna emas/gold */
  --sidebar-w: 300px; /* Lebar sidebar */
  --topbar-h: 56px; /* Tinggi topbar */
  --transition-smooth: 250ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Bagian-bagian Penting di style.css

| Bagian             | Kelas CSS            | Fungsi                                                 |
| ------------------ | -------------------- | ------------------------------------------------------ |
| Sidebar scrollable | `.sidebar__body`     | `flex:1; overflow-y:auto` — bagian yang bisa di-scroll |
| Sidebar sticky     | `.sidebar__footer`   | `flex-shrink:0` — tetap di bawah                       |
| Marker bulat       | `.wf-marker__circle` | Lingkaran berwarna dari `--marker-color`               |
| Pulse animasi      | `.wf-marker__pulse`  | Ring berputar pada marker pertama                      |
| Popup              | `.wf-popup-*`        | Desain popup saat marker diklik                        |
| Tooltip segmen     | `.wf-seg-tooltip`    | Tooltip saat hover garis rute                          |
| Template button    | `.btn--template`     | Tombol biru untuk template Jogja                       |
| Toast              | `.toast`             | Notifikasi mini yang muncul sementara                  |

### Responsive Design

```css
/* Layar tablet/mobile (≤768px) */
@media (max-width: 768px) {
  .sidebar {
    position: fixed; /* Sidebar jadi overlay */
    transform: translateX(-100%); /* Tersembunyi di kiri */
  }
  .sidebar.is-open {
    transform: translateX(0); /* Muncul saat tombol ditekan */
  }
  .topbar__hamburger {
    display: flex;
  } /* Tampilkan tombol hamburger */
}

/* Layar HP kecil (≤480px) */
@media (max-width: 480px) {
  --sidebar-w: 100vw; /* Sidebar full-screen */
}
```

### Animasi CSS Penting

```css
/* Marker pertama punya efek ring berdenyut */
@keyframes marker-pulse {
  0% {
    transform: scale(0.9);
    opacity: 0.7;
  }
  70% {
    transform: scale(1.5);
    opacity: 0;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

/* Kartu lokasi muncul dari kiri */
@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

---

## 3. `js/api.js` — Komunikasi dengan Backend

**Peran:** Menjadi **perantara (abstraction layer)** antara `ui.js` dan server backend.
Semua panggilan ke backend **melewati file ini dulu**.

### Pola yang Digunakan: IIFE Module Pattern

```javascript
const ApiModule = (() => {
  // Bagian private (tidak bisa diakses dari luar)
  function _privateFunction() { ... }

  // Bagian public (bisa dipanggil dari file lain)
  return {
    optimizeRoute,
    reverseGeocode,
  };
})();
```

Dengan pola ini, hanya fungsi yang ada di `return {}` yang bisa diakses dari luar.
`_privateFunction` (diawali `_`) tidak bisa dipanggil dari `ui.js`.

### Fungsi-fungsi di `api.js`

---

#### `optimizeRoute(locations)` — PUBLIC

**Tugas:** Mengirim daftar lokasi ke backend dan mendapatkan urutan rute terbaik.

**Parameter:**

```javascript
locations = [
  { id: "loc_1", name: "Malioboro", lat: -7.7928, lng: 110.3653 },
  { id: "loc_2", name: "Tugu Jogja", lat: -7.7828, lng: 110.3671 },
  // ...
];
```

**Return (Promise):**

```javascript
{
  orderedLocations: [ /* sama seperti input, tapi sudah diurutkan */ ],
  totalDistanceKm: 42.5,
  estimatedMinutes: 63
}
```

**Cara pakai di `ui.js`:**

```javascript
const result = await ApiModule.optimizeRoute(locations);
```

> ✅ **Status:** Fungsi ini sekarang menggunakan backend Python dengan algoritma Brute Force.
> Kode Nearest Neighbor tetap dipertahankan sebagai komentar untuk referensi pembelajaran.

---

#### `reverseGeocode(lat, lng)` — PUBLIC

**Tugas:** Mengubah koordinat menjadi nama tempat.

**Contoh:**

```javascript
const nama = await ApiModule.reverseGeocode(-7.7928, 110.3653);
// Hasil: "Lokasi (-7.7928, 110.3653)"  ← mode dummy
// Nanti: "Malioboro, Yogyakarta"       ← kalau pakai Nominatim API
```

Fungsi ini dipanggil oleh `ui.js` saat user **klik peta tanpa mengisi nama**.

---

#### `searchLocation(query)` — PUBLIC

**Tugas:** Mencari lokasi berdasarkan teks (belum diimplementasikan).
Saat ini selalu return array kosong `[]`.

---

#### `_fetchWithTimeout(url, options, timeout)` — PRIVATE

**Tugas:** Wrapper untuk fungsi `fetch()` bawaan browser, dengan fitur **timeout otomatis**.

```javascript
// Cara kerjanya:
const controller = new AbortController();
// Jika > 10 detik tidak ada respons, batalkan request
const timerId = setTimeout(() => controller.abort(), 10000);

const response = await fetch(url, { signal: controller.signal });
```

Jika backend tidak merespons dalam 10 detik, akan muncul error:
_"Request timeout — server tidak merespons"_

---

#### `_dummyOptimize(locations)` — PRIVATE

**Tugas:** Simulasi algoritma TSP di browser (tanpa backend).
Menggunakan **Nearest Neighbor Heuristic** — bukan solusi TSP yang sempurna,
tapi cukup untuk demo UI.

**Cara Kerja Nearest Neighbor:**

```
1. Mulai dari titik pertama (index 0)
2. Cari titik yang PALING DEKAT dari posisi sekarang
3. Kunjungi titik tersebut, tandai sebagai "sudah dikunjungi"
4. Ulangi langkah 2-3 sampai semua titik dikunjungi
5. Kembali ke titik pertama (tutup loop)
```

**Contoh visualisasi:**

```
Titik: A, B, C, D
Mulai dari A
→ Terdekat dari A: C → kunjungi C
→ Terdekat dari C: B → kunjungi B
→ Terdekat dari B: D → kunjungi D
→ Kembali ke A
Rute: A → C → B → D → A
```

---

#### `_haversineKm(lat1, lng1, lat2, lng2)` — PRIVATE

**Tugas:** Menghitung jarak antara dua koordinat GPS dalam kilometer.

**Rumus Haversine** memperhitungkan kelengkungan bumi, sehingga lebih akurat
dibanding jarak lurus biasa (Euclidean).

```javascript
function _haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // radius bumi (km)
  const dLat = _deg2rad(lat2 - lat1);
  const dLng = _deg2rad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(_deg2rad(lat1)) *
      Math.cos(_deg2rad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

---

## 4. `js/map.js` — Kontrol Peta Leaflet

**Peran:** Mengurus **semua yang terjadi di dalam peta**:
menambah marker, menggambar rute, mengubah tampilan, mengatur zoom.

### Konstanta Palet Warna Rute

```javascript
const ROUTE_COLORS = [
  { stroke: "#4a90d9", light: "#c2dcf5" }, // Biru langit (segmen 1→2)
  { stroke: "#5cb85c", light: "#c5e8c5" }, // Hijau segar (segmen 2→3)
  { stroke: "#e8a838", light: "#f6e2b4" }, // Oranye hangat (segmen 3→4)
  // ... (8 warna total, diulang cyclic)
];
```

Warna diakses dengan `ROUTE_COLORS[idx % ROUTE_COLORS.length]` sehingga
jika titik lebih dari 8, warna diulang dari awal.

### State Internal `MapModule`

```javascript
let mapInstance = null; // Instance Leaflet map
let markerLayerGroup = null; // Grup layer untuk semua marker
let routeSegments = []; // Array polyline (satu per segmen rute)
let previewPolyline = null; // Garis putus-putus preview
const markerRegistry = {}; // { "loc_1": <Leaflet Marker>, ... }
```

### Fungsi-fungsi di `map.js`

---

#### `init()` — PUBLIC

**Tugas:** Menginisialisasi peta Leaflet. **Hanya boleh dipanggil sekali.**

```javascript
function init() {
  if (mapInstance) return; // Guard: jika sudah diinit, berhenti

  mapInstance = L.map("map", { center: [-2.5, 118.0], zoom: 5 });
  // Tile = "ubin" gambar peta dari OpenStreetMap
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
    mapInstance,
  );

  markerLayerGroup = L.layerGroup().addTo(mapInstance);
  mapInstance.on("click", _onMapClick); // Event: klik peta
}
```

Dipanggil dari `ui.js` saat aplikasi pertama kali dibuka.

---

#### `addMarker(id, lat, lng, label, index, isStart)` — PUBLIC

**Tugas:** Menambahkan satu marker bulat berwarna ke peta.

**Parameter:**

- `id` — ID unik lokasi (mis: `"loc_1_1715000000"`)
- `lat`, `lng` — Koordinat
- `label` — Nama lokasi (untuk tooltip & popup)
- `index` — Nomor urutan (ditampilkan di tengah marker)
- `isStart` — Jika `true`, marker punya animasi pulse (denyut)

**Cara kerja:**

```javascript
// 1. Tentukan warna berdasarkan nomor urutan (cyclic)
const color = ROUTE_COLORS[(index - 1) % ROUTE_COLORS.length];

// 2. Buat ikon custom HTML
const icon = L.divIcon({ html: _buildMarkerHTML(index, isStart, color) });

// 3. Buat marker Leaflet dan tambahkan ke peta
const marker = L.marker([lat, lng], { icon }).addTo(markerLayerGroup);

// 4. Daftarkan marker ke registry (untuk referensi nanti)
markerRegistry[id] = marker;
```

---

#### `removeMarker(id)` — PUBLIC

**Tugas:** Menghapus satu marker dari peta dan dari registry.

```javascript
function removeMarker(id) {
  markerLayerGroup.removeLayer(markerRegistry[id]); // Hapus dari peta
  delete markerRegistry[id]; // Hapus dari registry
}
```

---

#### `removeAllMarkers()` — PUBLIC

**Tugas:** Menghapus **semua** marker sekaligus.

```javascript
markerLayerGroup.clearLayers(); // Hapus semua layer
Object.keys(markerRegistry).forEach((k) => delete markerRegistry[k]); // Kosongkan registry
```

---

#### `refreshMarkerIcons(locations)` — PUBLIC

**Tugas:** Memperbarui tampilan ikon **semua marker** setelah urutan berubah
(dipanggil setelah optimasi TSP mengubah urutan lokasi).

```javascript
locations.forEach((loc, idx) => {
  const marker = markerRegistry[loc.id];
  const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
  marker.setIcon(
    L.divIcon({ html: _buildMarkerHTML(idx + 1, idx === 0, color) }),
  );
});
```

Jika sebelum optimasi urutan adalah `A(1) → B(2) → C(3)`,
setelah optimasi menjadi `A(1) → C(2) → B(3)`,
maka fungsi ini memastikan angka di dalam marker ikut berubah.

---

#### `drawRoute(latlngs, isOptimized)` — PUBLIC ⭐ Fungsi Kunci

**Tugas:** Menggambar garis rute di peta.

**Dua mode:**

**Mode Preview** (`isOptimized = false`):

```javascript
// Satu garis putus-putus abu-abu
L.polyline(closedPath, { color: "#aaaaaa", dashArray: "8, 7" }).addTo(map);
```

Digunakan saat user baru menambah titik, belum dioptimalkan.

**Mode Optimized** (`isOptimized = true`):

```javascript
// Setiap segmen A→B digambar dengan DUA layer:
latlngs.forEach((point, idx) => {
  const nextPoint = latlngs[(idx + 1) % total]; // Titik berikutnya
  const color = ROUTE_COLORS[idx % 8]; // Warna berbeda tiap segmen

  // Layer 1: Glow (tebal, transparan) → efek bayangan/kedalaman
  L.polyline([point, nextPoint], {
    color: color.light,
    weight: 9,
    opacity: 0.35,
  }).addTo(map);

  // Layer 2: Garis utama (tipis, solid)
  L.polyline([point, nextPoint], { color: color.stroke, weight: 3.5 }).addTo(
    map,
  );
});
```

Semua layer disimpan ke array `routeSegments[]` agar bisa dihapus sekaligus.

---

#### `clearRoute()` — PUBLIC

**Tugas:** Menghapus **semua** garis rute dari peta tanpa memory leak.

```javascript
function clearRoute() {
  // Hapus setiap layer yang disimpan di array
  routeSegments.forEach((layer) => mapInstance.removeLayer(layer));
  routeSegments = []; // Reset array (penting! agar tidak menumpuk)

  if (previewPolyline) {
    mapInstance.removeLayer(previewPolyline);
    previewPolyline = null;
  }
}
```

> 📌 **Kenapa pakai array?** Karena setiap segmen rute berwarna adalah layer
> Leaflet yang terpisah. Jika tidak disimpan di array, kita tidak bisa menghapusnya
> nanti dan terjadi **memory leak** (peta penuh dengan layer yang tidak terlihat).

---

#### `_buildMarkerHTML(index, isStart, color)` — PRIVATE

**Tugas:** Membuat string HTML untuk custom marker bulat.

```javascript
return `
  <div class="wf-marker" style="--marker-color: ${color.stroke}; --marker-ring: ${color.light};">
    <div class="wf-marker__circle">
      <span class="wf-marker__num">${index}</span>
    </div>
    ${isStart ? '<div class="wf-marker__pulse"></div>' : ""}
  </div>
`;
```

- `--marker-color` → warna background lingkaran (CSS custom property)
- `--marker-ring` → warna ring pulse (CSS custom property)
- `.wf-marker__pulse` → hanya muncul jika ini marker **pertama** (titik awal)

---

#### `_buildPopupHTML(label, lat, lng, index, color)` — PRIVATE

**Tugas:** Membuat konten HTML popup yang muncul saat marker diklik.

Popup menampilkan:

- Badge nomor urutan (berwarna sesuai segmen)
- Nama lokasi
- Koordinat GPS

---

#### `fitBoundsToMarkers()` — PUBLIC

**Tugas:** Menyesuaikan zoom & posisi peta agar **semua marker terlihat**.

```javascript
const group = L.featureGroup(Object.values(markerRegistry));
mapInstance.fitBounds(group.getBounds(), { padding: [60, 60] });
```

Dipanggil otomatis setelah template Jogja dimuat atau setelah optimasi.

---

#### `panToMarker(id)` — PUBLIC

**Tugas:** Memindahkan tampilan peta ke marker tertentu dan membuka popupnya.
Dipanggil saat user **mengklik kartu lokasi** di sidebar.

---

## 5. `js/ui.js` — Kontrol Tampilan & State Aplikasi

**Peran:** Ini adalah **otak utama frontend**. Ia menyimpan data (state),
merender ulang tampilan, dan menghubungkan semua modul lain.

### State yang Disimpan

```javascript
let locations = []; // Array semua lokasi yang ditambahkan
let isOptimizing = false; // Sedang proses optimasi? (untuk disable tombol)
let mapClickedOnce = false; // Sudah pernah klik peta? (untuk hide hint)
let locationIdCounter = 0; // Counter untuk generate ID unik
```

### Data Lokasi

Setiap lokasi disimpan sebagai objek:

```javascript
{
  id:   "loc_3_1715000123",  // ID unik (tidak berubah)
  name: "Candi Prambanan",
  lat:  -7.7520,
  lng:  110.4914
}
```

### Template Data Wisata Jogja

```javascript
const TEMPLATE_JOGJA = [
  { name: "Malioboro", lat: -7.7928, lng: 110.3653 },
  { name: "Tugu Jogja", lat: -7.7828, lng: 110.3671 },
  { name: "Keraton Yogyakarta", lat: -7.8053, lng: 110.3642 },
  { name: "Tebing Breksi", lat: -7.7741, lng: 110.5085 },
  { name: "HeHa Sky View", lat: -7.8639, lng: 110.4344 },
  { name: "Candi Prambanan", lat: -7.752, lng: 110.4914 },
];
```

### Fungsi-fungsi di `ui.js`

---

#### `init()` — PUBLIC (dipanggil oleh `DOMContentLoaded`)

**Tugas:** Memulai seluruh aplikasi. **Entry point utama.**

```javascript
function init() {
  _cacheDOMRefs(); // Simpan referensi elemen HTML
  _bindEvents(); // Pasang semua event listener
  MapModule.init(); // Inisialisasi peta
  _renderLocationList(); // Render daftar (kosong awalnya)
  _updateOptimizeButtonState(); // Disable tombol optimize (belum ada lokasi)
}
```

Bootstrap (pemicu awal) ada di bagian bawah file:

```javascript
document.addEventListener("DOMContentLoaded", () => {
  UIModule.init(); // Panggil init saat HTML sudah selesai dimuat browser
});
```

---

#### `_cacheDOMRefs()` — PRIVATE

**Tugas:** Menyimpan referensi elemen HTML ke dalam objek `DOM` agar tidak perlu
memanggil `document.getElementById()` berulang kali.

```javascript
DOM = {
  locationList: document.getElementById("locationList"),
  optimizeBtn: document.getElementById("optimizeBtn"),
  templateJogjaBtn: document.getElementById("templateJogjaBtn"),
  // ...semua elemen penting
};
```

---

#### `_bindEvents()` — PRIVATE

**Tugas:** Menghubungkan setiap tombol/input dengan fungsinya.

```javascript
DOM.addLocationBtn?.addEventListener("click", _onAddLocationClick);
DOM.optimizeBtn?.addEventListener("click", _onOptimizeClick);
DOM.clearAllBtn?.addEventListener("click", _onClearAllClick);
DOM.templateJogjaBtn?.addEventListener("click", _onLoadTemplateJogja);
DOM.topbarHamburger?.addEventListener("click", _openSidebar);
```

Tanda `?.` berarti "hanya pasang event jika elemennya ada" (Optional Chaining).

---

#### `addLocationFromMap(lat, lng, customName)` — PUBLIC

**Tugas:** Dipanggil oleh `map.js` saat user **klik di peta**.

```javascript
async function addLocationFromMap(lat, lng, customName = "") {
  // Sembunyikan hint "klik peta" setelah klik pertama
  if (!mapClickedOnce) {
    mapClickedOnce = true;
    DOM.mapHint?.classList.add("hidden");
  }

  // Jika nama tidak diisi, dapatkan nama dari geocoding
  let name = customName || (await ApiModule.reverseGeocode(lat, lng));

  _addLocation(name, lat, lng); // Tambah ke state
}
```

---

#### `_onLoadTemplateJogja()` — PRIVATE ⭐

**Tugas:** Memuat 6 lokasi wisata Jogja sekaligus ke peta.

```javascript
function _onLoadTemplateJogja() {
  // 1. Konfirmasi hapus data lama (jika ada)
  if (locations.length > 0) {
    if (!confirm("Memuat template akan menghapus lokasi yang ada. Lanjutkan?"))
      return;
  }

  // 2. Bersihkan semua
  locations = [];
  MapModule.removeAllMarkers();
  MapModule.clearRoute();

  // 3. Load semua lokasi template
  TEMPLATE_JOGJA.forEach((loc) => _addLocation(loc.name, loc.lat, loc.lng));

  // 4. Zoom peta ke semua marker
  MapModule.fitBoundsToMarkers();

  // 5. Tampilkan badge konfirmasi
  DOM.templateBadge.style.display = "flex";

  showToast("Template Wisata Jogja berhasil dimuat!", "info");
}
```

---

#### `_addLocation(name, lat, lng)` — PRIVATE

**Tugas:** Menambahkan satu lokasi ke **state** dan memperbarui **semua tampilan terkait**.

```javascript
function _addLocation(name, lat, lng) {
  // 1. Buat ID unik
  const id = `loc_${++locationIdCounter}_${Date.now()}`;

  // 2. Tambah ke array state
  locations.push({ id, name, lat, lng });

  // 3. Tambah marker ke peta
  MapModule.addMarker(
    id,
    lat,
    lng,
    name,
    locations.length,
    locations.length === 1,
  );

  // 4. Render ulang daftar di sidebar
  _renderLocationList();

  // 5. Update counter & status tombol
  _updateOptimizeButtonState();
  _updateLocationCount();

  // 6. Gambar rute preview jika ≥ 2 lokasi
  if (locations.length >= 2) _drawPreviewRoute();
}
```

---

#### `_onOptimizeClick()` — PRIVATE ⭐ Fungsi Paling Penting

**Tugas:** Menjalankan proses optimasi rute TSP saat tombol "Optimalkan Rute" diklik.

```javascript
async function _onOptimizeClick() {
  isOptimizing = true;
  _setOptimizeButtonLoading(true); // Tampilkan spinner

  try {
    // 1. Kirim data ke api.js (yang meneruskan ke backend)
    const result = await ApiModule.optimizeRoute(locations);

    // 2. Update state dengan urutan baru
    locations = result.orderedLocations;

    // 3. Gambar rute berwarna di peta
    const latlngs = locations.map((l) => [l.lat, l.lng]);
    MapModule.drawRoute(latlngs, true); // true = mode optimized (berwarna)

    // 4. Perbarui angka di dalam marker
    MapModule.refreshMarkerIcons(locations);

    // 5. Render ulang daftar sidebar sesuai urutan baru
    _renderLocationList();

    // 6. Tampilkan statistik
    _updateStats(result.totalDistanceKm, result.estimatedMinutes);

    // 7. Zoom ke semua marker
    MapModule.fitBoundsToMarkers();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    isOptimizing = false;
    _setOptimizeButtonLoading(false); // Hapus spinner
  }
}
```

---

#### `_renderLocationList()` — PRIVATE

**Tugas:** Menghapus dan menggambar ulang **semua kartu lokasi** di sidebar.

```javascript
function _renderLocationList() {
  // Hapus semua kartu lama
  DOM.locationList
    .querySelectorAll(".location-card")
    .forEach((c) => c.remove());

  if (locations.length === 0) {
    DOM.emptyState.style.display = "flex"; // Tampilkan pesan "belum ada lokasi"
    return;
  }

  DOM.emptyState.style.display = "none";
  locations.forEach((loc, idx) => {
    DOM.locationList.appendChild(_createLocationCard(loc, idx + 1));
  });
}
```

---

#### `_createLocationCard(loc, index)` — PRIVATE

**Tugas:** Membuat elemen HTML untuk **satu kartu lokasi** di sidebar.

Setiap kartu memiliki:

- Badge nomor urutan
- Nama lokasi (terpotong jika terlalu panjang)
- Koordinat (dalam format italic kecil)
- Tombol hapus (✕) yang muncul saat hover

Event yang dipasang di kartu:

```javascript
// Klik kartu → pindah peta ke lokasi tersebut
card.addEventListener("click", () => MapModule.panToMarker(loc.id));

// Klik tombol ✕ → hapus lokasi
deleteBtn.addEventListener("click", () => _removeLocation(loc.id));
```

---

#### `showToast(message, type, duration)` — PUBLIC

**Tugas:** Menampilkan notifikasi kecil yang muncul sementara di bagian bawah layar.

```javascript
showToast("Rute berhasil dioptimalkan!", "success"); // Notifikasi hijau
showToast("Minimal 2 lokasi!", "warning"); // Notifikasi kuning
showToast("Gagal koneksi ke server", "error"); // Notifikasi merah
showToast("Template dimuat", "info"); // Notifikasi biru
```

Toast hilang otomatis setelah 3 detik (bisa diubah via parameter `duration`).

---

---

# 🐍 BACKEND

---

## 6. `backend/app.py` — Entry Point Server Flask

**Peran:** File pertama yang dijalankan untuk menghidupkan server backend.

### Cara Menjalankan

```bash
cd backend
pip install -r requirements.txt   # Install Flask
python app.py                      # Jalankan server
```

Server akan berjalan di: `http://localhost:5000`

### Fungsi `create_app()`

```python
def create_app():
    app = Flask(__name__)

    CORS(app, origins="*") # Izinkan frontend mengakses dari mana saja

    app.register_blueprint(api_bp) # Daftarkan semua endpoint dari routes/api.py

    # Daftarkan handler error 404 dan 405
    @app.errorhandler(404)
    def not_found(e): return jsonify({"status": "error", ...}), 404

    return app
```

**Kenapa `create_app()` dipisah?** Agar memudahkan testing:

```python
# Saat test, bisa buat app khusus testing:
app = create_app()
app.config["TESTING"] = True
```

### Blok `if __name__ == '__main__'`

```python
if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
```

Blok `if __name__ == '__main__'` hanya dieksekusi jika file dijalankan **langsung**
(`python app.py`), bukan saat di-import modul lain.

---

## 7. `backend/routes/api.py` — Endpoint HTTP

**Peran:** Mendefinisikan "pintu masuk" server — URL mana yang menerima request apa.

### Endpoint 1: `GET /api/health`

```python
@api_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({ "status": "ok", "message": "WayFinder API is running" }), 200
```

**Fungsi:** Cek apakah server berjalan. Bisa ditest dari browser:
`http://localhost:5000/api/health`

---

### Endpoint 2: `POST /api/optimize` ⭐ Endpoint Utama

**Fungsi:** Menerima daftar koordinat, menjalankan TSP, mengembalikan rute terbaik.

**Alur validasi (7 tahap):**

```
Request masuk
    │
    ▼
[1] Apakah Content-Type: application/json? → Jika tidak: error 415
    │
    ▼
[2] Apakah ada key "points"? → Jika tidak: error 400
    │
    ▼
[3] Apakah "points" berupa list/array? → Jika tidak: error 400
    │
    ▼
[4] Apakah ada minimal 2 titik? → Jika tidak: error 422
    │
    ▼
[5] Apakah ≤ 10 titik? → Jika lebih: error 422 (batas brute force)
    │
    ▼
[6] Apakah setiap titik valid [lat, lng]? → Jika tidak: error 400
    │ (cek format, tipe data, dan rentang nilai)
    ▼
[7] Jalankan TSP Brute Force → Kembalikan hasil 200
```

**Format request:**

```json
POST /api/optimize
Content-Type: application/json

{
    "points": [
        [-7.7928, 110.3653],
        [-7.7828, 110.3671],
        [-7.8053, 110.3642]
    ]
}
```

**Format respons sukses:**

```json
{
  "status": "success",
  "best_route": [
    [-7.7828, 110.3671],
    [-7.7928, 110.3653],
    [-7.8053, 110.3642]
  ],
  "total_distance": 8.42,
  "total_permutations": 2
}
```

---

#### `_error_response(message, status_code)` — Helper

```python
def _error_response(message, status_code=400):
    return jsonify({ "status": "error", "message": message }), status_code
```

Fungsi kecil ini memastikan semua respons error punya **format yang konsisten**,
sehingga frontend bisa selalu mengecek `data.status === "error"`.

---

## 8. `backend/tsp.py` — Algoritma TSP Brute Force

**Peran:** Inti dari seluruh aplikasi — menyelesaikan Travelling Salesman Problem.

### Apa itu TSP?

> Diberikan sejumlah kota, temukan rute terpendek yang **mengunjungi setiap kota
> tepat satu kali** dan kembali ke kota asal.

### Metode: Brute Force

**Ide:** Coba **semua kemungkinan urutan** perjalanan, pilih yang paling pendek.

**Contoh dengan 4 titik (A, B, C, D):**

```
Titik awal selalu A (untuk hindari duplikasi rotasi).
Permutasikan sisa titik: B, C, D

Kemungkinan:
  A → B → C → D → A  = 45 km
  A → B → D → C → A  = 38 km  ← Terpendek!
  A → C → B → D → A  = 42 km
  A → C → D → B → A  = 38 km  (sama = arah terbalik)
  A → D → B → C → A  = 42 km
  A → D → C → B → A  = 45 km

Hasil: A → B → D → C → A
```

**Jumlah kemungkinan = (n-1)!**

- 3 titik → 2! = 2 kemungkinan
- 5 titik → 4! = 24 kemungkinan
- 8 titik → 7! = 5.040 kemungkinan
- 10 titik → 9! = 362.880 kemungkinan ← Batas maksimum

### Fungsi `solve_tsp_brute_force(points)`

```python
def solve_tsp_brute_force(points):
    n = len(points)

    # Validasi
    if n < 2: raise ValueError("Minimal 2 titik")
    if n > 10: raise ValueError("Maksimal 10 titik untuk brute force")

    # Bangun matriks jarak
    distance_matrix = build_distance_matrix(points)

    # Brute Force
    start_index   = 0              # Titik awal selalu index 0
    other_indices = list(range(1, n))  # [1, 2, 3, ...]
    best_distance = float('inf')   # Mulai dari tak terhingga
    best_order    = []

    for perm in permutations(other_indices): # Coba semua urutan
        current_route    = [start_index] + list(perm) # [0, 2, 1, 3] misalnya
        current_distance = total_route_distance(current_route, distance_matrix)

        if current_distance < best_distance: # Update jika lebih pendek
            best_distance = current_distance
            best_order    = current_route

    # Susun koordinat sesuai urutan terbaik
    best_route_coords = [points[i] for i in best_order]

    return { "best_route": best_route_coords, "total_distance": best_distance, ... }
```

### Fungsi `get_route_summary(points, best_order, total_distance)`

```python
def get_route_summary(points, best_order, total_distance):
    # Menghasilkan teks seperti:
    # Rute Optimal (4 titik):
    #   [1] Titik-1  (-7.7928, 110.3653)
    #   [2] Titik-3  (-7.8053, 110.3642)
    #   [3] Titik-2  (-7.7828, 110.3671)
    #   [4] Kembali ke Titik-1  (...)
    # Total Jarak: 12.3456 km
```

Fungsi ini hanya untuk **logging di konsol server** (debugging), tidak dikirim ke frontend.

---

### Penjelasan Detail Algoritma Brute Force

Algoritma brute force yang digunakan dalam kode ini adalah pendekatan dasar untuk menyelesaikan masalah Travelling Salesman Problem (TSP). Berikut adalah penjelasan lengkap dan mudah dipahami mengenai algoritma ini, disesuaikan dengan implementasi pada kode Python di atas.

#### 1. Pengertian Algoritma Brute Force Secara Umum

Brute force adalah metode penyelesaian masalah dengan cara **mencoba semua kemungkinan solusi yang ada**, kemudian memilih solusi terbaik di antara semuanya. Istilah "brute force" berasal dari kata "brute" yang berarti kasar atau paksa, dan "force" yang berarti kekuatan, sehingga secara harfiah berarti "kekuatan kasar". 

Dalam konteks komputasi, brute force adalah pendekatan yang **sederhana dan langsung** — kita tidak menggunakan trik atau heuristik cerdas, melainkan **memeriksa setiap kemungkinan satu per satu** sampai menemukan yang terbaik.

#### 2. Cara Kerja Brute Force pada Kode Ini Langkah Demi Langkah

Pada kode `solve_tsp_brute_force(points)`, algoritma brute force diterapkan sebagai berikut:

**Langkah 1: Persiapan Awal**
- Terima daftar koordinat titik-titik yang akan dikunjungi
- Validasi jumlah titik (minimal 2, maksimal 10)
- Bangun matriks jarak menggunakan `build_distance_matrix(points)` — ini adalah tabel yang berisi jarak antara setiap pasang titik

**Langkah 2: Menentukan Titik Awal**
- Tetapkan titik pertama (indeks 0) sebagai titik awal yang tetap
- Buat daftar indeks titik lainnya yang akan dipermutasi: `[1, 2, 3, ..., n-1]`

**Langkah 3: Proses Pencarian Utama (Loop Brute Force)**
- Gunakan `itertools.permutations(other_indices)` untuk menghasilkan semua kemungkinan urutan titik lainnya
- Untuk setiap permutasi:
  - Gabungkan titik awal dengan permutasi saat ini: `[0] + list(perm)`
  - Hitung total jarak rute menggunakan `total_route_distance()`
  - Jika jarak ini lebih kecil dari jarak terbaik sebelumnya, simpan sebagai yang terbaik

**Langkah 4: Mengembalikan Hasil**
- Urutkan koordinat sesuai urutan indeks terbaik
- Kembalikan rute optimal, urutan indeks, total jarak, dan jumlah permutasi yang dicoba

#### 3. Bagaimana Proses Pencarian Dilakukan Sampai Menemukan Hasil Terbaik

Proses pencarian dilakukan melalui **iterasi lengkap** atas semua kemungkinan:

1. **Inisialisasi**: Mulai dengan jarak terbaik = tak terhingga (∞), dan rute terbaik = kosong
2. **Iterasi Permutasi**: Untuk setiap urutan yang mungkin dari titik-titik selain awal
3. **Evaluasi**: Hitung jarak total untuk rute tersebut
4. **Pembandingan**: Jika jarak rute ini lebih kecil dari jarak terbaik saat ini, update jarak terbaik dan simpan rute ini
5. **Penyelesaian**: Setelah semua permutasi dicoba, rute dengan jarak terkecil adalah solusi optimal

Contoh dengan 4 titik (A, B, C, D):
- Titik awal: A (tetap)
- Permutasi titik lainnya: B, C, D
- Kemungkinan rute yang dicoba:
  - A → B → C → D → A (jarak: 45 km)
  - A → B → D → C → A (jarak: 38 km) ← **terbaik sementara**
  - A → C → B → D → A (jarak: 42 km)
  - A → C → D → B → A (jarak: 38 km) ← sama dengan terbaik
  - A → D → B → C → A (jarak: 42 km)
  - A → D → C → B → A (jarak: 45 km)
- Hasil: A → B → D → C → A dengan jarak 38 km

#### 4. Kenapa Algoritma Ini Disebut Brute Force

Algoritma ini disebut brute force karena:
- **Tidak ada kecerdasan**: Tidak menggunakan heuristik, pola, atau aturan khusus untuk mempersempit pencarian
- **Mencoba semuanya**: Mengeksplorasi setiap kemungkinan tanpa terkecuali
- **Paksaan kasar**: Mengandalkan kekuatan komputasi murni untuk menyelesaikan masalah
- **Komprehensif**: Dijamin menemukan solusi optimal karena memeriksa semua alternatif

Istilah ini sering digunakan untuk membedakan dari algoritma "cerdas" seperti algoritma greedy atau dynamic programming yang menggunakan strategi optimasi.

#### 5. Kelebihan dan Kekurangan Algoritma Brute Force

**Kelebihan:**
- **Jaminan optimalitas**: Selalu menemukan solusi terbaik karena memeriksa semua kemungkinan
- **Sederhana**: Mudah dipahami dan diimplementasikan
- **Tidak memerlukan pengetahuan domain**: Tidak perlu memahami karakteristik masalah khusus
- **Deterministik**: Hasil selalu sama untuk input yang sama

**Kekurangan:**
- **Kompleksitas waktu tinggi**: Waktu eksekusi tumbuh secara faktorial — O((n-1)!) untuk TSP
- **Tidak scalable**: Hanya praktis untuk masalah kecil (dalam kode ini, maksimal 10 titik)
- **Inefisien**: Banyak komputasi yang sia-sia karena mencoba solusi yang jelas buruk
- **Resource-intensive**: Membutuhkan memori dan CPU yang signifikan untuk masalah besar

#### 6. Analogi Sederhana Agar Mudah Dipahami

Bayangkan Anda ingin mencari kunci yang hilang di rumah. Dengan brute force:
- Anda **memeriksa setiap laci, setiap rak, setiap sudut** satu per satu
- **Tidak ada trik khusus** — hanya teliti dan sistematis
- **Dijamin menemukan** kunci jika memang ada di rumah
- Tapi jika rumah besar, **akan memakan waktu lama**

Sebaliknya, metode cerdas mungkin: "Kunci biasanya di meja depan" — langsung cek tempat yang paling mungkin dulu.

Untuk TSP, brute force seperti: "Coba semua rute bus yang mungkin, pilih yang paling cepat" vs metode cerdas: "Mulai dari pusat kota, kunjungi tempat terdekat berikutnya".

#### 7. Bagian Kode Python yang Berhubungan Langsung dengan Proses Brute Force

Berikut adalah bagian-bagian kode yang langsung terlibat dalam algoritma brute force, dengan komentar penjelasan:

```python
# Persiapan variabel untuk brute force
start_index = 0                  # Titik awal tetap (indeks 0)
other_indices = list(range(1, n))  # Indeks titik lain yang akan dipermutasi
best_distance = float('inf')      # Jarak terbaik dimulai dari tak terhingga
best_order = []                   # Urutan terbaik akan disimpan di sini
count = 0                         # Counter untuk menghitung jumlah percobaan

# Loop utama brute force - mencoba semua permutasi
for perm in permutations(other_indices):  # permutations() menghasilkan semua urutan
    count += 1                            # Hitung setiap rute yang dicoba
    
    # Gabungkan titik awal dengan permutasi saat ini
    current_route = [start_index] + list(perm)  # Contoh: [0, 2, 1, 3]
    
    # Hitung jarak total rute ini (termasuk kembali ke awal)
    current_distance = total_route_distance(current_route, distance_matrix)
    
    # Jika rute ini lebih baik dari yang terbaik sejauh ini
    if current_distance < best_distance:
        best_distance = current_distance  # Update jarak terbaik
        best_order = current_route        # Simpan urutan terbaik
```

#### 8. Ilustrasi Alur Proses Brute Force

```
Input: 4 titik (A, B, C, D)
Titik awal tetap: A

┌─────────────────────────────────────────────────────────────┐
│                    PROSES BRUTE FORCE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Permutasi yang dicoba:                                     │
│  1. A → B → C → D → A     Hitung jarak: 45 km               │
│  2. A → B → D → C → A     Hitung jarak: 38 km  ← Terbaik!   │
│  3. A → C → B → D → A     Hitung jarak: 42 km               │
│  4. A → C → D → B → A     Hitung jarak: 38 km  (sama baik)  │
│  5. A → D → B → C → A     Hitung jarak: 42 km               │
│  6. A → D → C → B → A     Hitung jarak: 45 km               │
│                                                             │
│  Hasil: A → B → D → C → A dengan jarak 38 km                │
│                                                             │
│  Jumlah percobaan: 6 = (4-1)! = 3! = 6                      │
└─────────────────────────────────────────────────────────────┘
```

---

### Perbedaan Proses Optimasi Rute: Frontend vs Backend

Dalam proyek WayFinder ini, terdapat dua cara berbeda untuk melakukan optimasi rute: **optimasi di frontend menggunakan algoritma Nearest Neighbor** (saat backend tidak digunakan) dan **optimasi di backend menggunakan algoritma Brute Force**. Berikut adalah penjelasan detail mengenai perbedaan kedua pendekatan ini.

#### 1. Mengapa Fitur Optimasi Rute Masih Bisa Berjalan Meskipun Backend Tidak Digunakan

Fitur optimasi rute tetap dapat berfungsi tanpa backend karena **seluruh proses perhitungan dilakukan langsung di browser pengguna**. Pada file `api.js`, terdapat fungsi `_dummyOptimize()` yang mensimulasikan algoritma TSP menggunakan JavaScript di sisi klien. Ini berarti aplikasi tidak bergantung pada server eksternal untuk menghitung rute optimal.

#### 2. Algoritma Nearest Neighbor Dijalankan Langsung di Frontend Menggunakan JavaScript

Algoritma Nearest Neighbor dapat dijalankan langsung di browser karena:
- **JavaScript modern** memiliki kemampuan komputasi yang cukup untuk algoritma sederhana
- **Proses perhitungan** dilakukan di perangkat pengguna tanpa perlu komunikasi jaringan
- **Library bawaan browser** seperti `Math` cukup untuk menghitung jarak Haversine
- **Tidak memerlukan instalasi** software tambahan di server

Dalam kode `api.js`, fungsi `_dummyOptimize(locations)` mengimplementasikan Nearest Neighbor sepenuhnya di JavaScript.

#### 3. Bagaimana Frontend Memproses Data Lokasi Tanpa Mengirim ke Server

Proses optimasi di frontend berjalan sebagai berikut:
- **Data lokasi** (koordinat lat/lng) sudah tersedia di memori browser dari input pengguna
- **Perhitungan jarak** dilakukan menggunakan rumus Haversine dalam fungsi `_haversineKm()`
- **Algoritma Nearest Neighbor** diterapkan: mulai dari titik pertama, selalu pilih titik terdekat berikutnya
- **Hasil rute** langsung ditampilkan di UI tanpa delay jaringan

```javascript
// Contoh proses di frontend:
const locations = [{lat: -7.79, lng: 110.36}, {lat: -7.80, lng: 110.37}, ...];
const result = _dummyOptimize(locations); // Hitung langsung di browser
// Hasil langsung muncul tanpa HTTP request
```

#### 4. Perbandingan dengan Penggunaan Backend yang Menjalankan Brute Force

| Aspek | Frontend (Nearest Neighbor) | Backend (Brute Force) |
|-------|-----------------------------|----------------------|
| **Lokasi Perhitungan** | Browser pengguna | Server Python |
| **Algoritma** | Heuristik cepat | Eksak, coba semua |
| **Kecepatan** | Instan (< 1 detik) | Lambat untuk >8 titik |
| **Optimalitas** | Tidak selalu optimal | Selalu optimal |
| **Komunikasi** | Tidak ada jaringan | HTTP POST ke server |
| **Ketergantungan** | Offline-ready | Perlu server aktif |

#### 5. Backend Biasanya Digunakan Untuk

Backend digunakan ketika aplikasi membutuhkan:
- **Perhitungan yang lebih kompleks**: Algoritma yang memerlukan daya komputasi tinggi
- **Pengolahan data besar**: Ribuan titik atau data tambahan (waktu, biaya, dll.)
- **Keamanan data**: Data sensitif diproses di server yang terkontrol
- **Integrasi database**: Menyimpan riwayat rute, preferensi pengguna, dll.
- **Optimasi performa**: Server dedicated dapat menangani beban berat
- **Pemrosesan algoritma berat**: Brute Force, algoritma genetika, atau machine learning

#### 6. Perbedaan Karakteristik Algoritma

**Nearest Neighbor:**
- **Kelebihan**: Sangat cepat, ringan secara komputasi, cocok untuk real-time
- **Kekurangan**: Hasil tidak selalu optimal, bisa terjebak di "jalan buntu"
- **Kompleksitas**: O(n²) - linier terhadap jumlah titik
- **Contoh**: Dalam 10 titik, hasil mungkin 20% lebih panjang dari optimal

**Brute Force:**
- **Kelebihan**: Dijamin menemukan rute terpendek, hasil selalu optimal
- **Kekurangan**: Sangat lambat, kompleksitas faktorial O((n-1)!)
- **Kompleksitas**: Tumbuh eksponensial - tidak praktis untuk >12 titik
- **Contoh**: Dalam 10 titik, mencoba 362.880 kemungkinan

#### 7. Mengapa Nearest Neighbor Cocok Dijalankan di Frontend/Browser

Nearest Neighbor cocok untuk frontend karena:
- **Komputasi sederhana**: Hanya perlu menghitung jarak berulang
- **Responsif**: Pengguna langsung melihat hasil tanpa menunggu server
- **Offline-capable**: Bisa berjalan tanpa koneksi internet
- **Scalable untuk UI**: Cepat untuk preview dan interaksi real-time
- **Resource-efficient**: Tidak membebani server atau bandwidth

#### 8. Kapan Sebuah Project Mulai Membutuhkan Backend untuk Optimasi Rute

Project mulai membutuhkan backend ketika:
- **Jumlah titik > 10**: Brute Force diperlukan untuk optimalitas
- **Data kompleks**: Mempertimbangkan faktor tambahan (jam sibuk, biaya, dll.)
- **Multi-user**: Ribuan pengguna bersamaan membutuhkan server dedicated
- **Data persistence**: Menyimpan dan menganalisis riwayat perjalanan
- **Advanced algorithms**: Machine learning atau optimasi lanjutan
- **Security requirements**: Data bisnis sensitif tidak boleh di browser

#### 9. Analogi Sederhana

**Frontend sebagai "Penghitung Langsung di Perangkat Pengguna":**
Bayangkan Anda memiliki kalkulator di tangan. Untuk menghitung 2+3, Anda langsung tekan tombol dan hasil muncul instan. Tidak perlu telepon ke ahli matematika di kantor pusat. Nearest Neighbor seperti kalkulator pribadi - cepat, pribadi, dan langsung.

**Backend sebagai "Pusat Pemrosesan/Server":**
Sebaliknya, backend seperti menghubungi pusat data besar untuk perhitungan kompleks. Misalnya, untuk menghitung rute optimal di seluruh Indonesia dengan ribuan kota, Anda butuh superkomputer di data center. Brute Force seperti konsultasi dengan ahli yang punya waktu dan resource tak terbatas untuk mencoba semua kemungkinan.

Dalam proyek WayFinder, frontend memberikan "jawaban cepat" untuk demo dan penggunaan sehari-hari, sementara backend menyediakan "jawaban akurat" untuk kebutuhan profesional atau data besar.

---

## 9. `backend/distance.py` — Rumus Haversine

**Peran:** Menghitung jarak antara dua titik koordinat GPS.

### Kenapa Haversine, bukan jarak biasa?

Bumi itu **bulat** (sebenarnya elipsoid). Jarak lurus biasa (Euclidean) tidak
memperhitungkan kelengkungan bumi, sehingga hasilnya tidak akurat untuk jarak jauh.

```
Jarak lurus biasa:  d = √((x2-x1)² + (y2-y1)²)  ← Salah untuk koordinat GPS
Haversine:          Memperhitungkan kelengkungan bumi → Lebih akurat
```

### Fungsi `haversine(coord1, coord2)`

```python
def haversine(coord1, coord2):
    lat1, lon1 = coord1
    lat2, lon2 = coord2

    # Konversi derajat → radian (matematika pakai radian)
    lat1_rad = math.radians(lat1)
    # ...

    # Rumus Haversine
    a = (sin(Δlat/2)² + cos(lat1) × cos(lat2) × sin(Δlng/2)²)
    c = 2 × atan2(√a, √(1-a))
    d = R × c   # R = 6371 km (radius bumi)

    return round(d, 4)  # Dibulatkan 4 desimal
```

### Fungsi `build_distance_matrix(points)`

```python
def build_distance_matrix(points):
    # Untuk 4 titik, menghasilkan matriks 4x4:
    # matrix[i][j] = jarak dari titik i ke titik j
    #
    #        A      B      C      D
    # A  [  0.0,  2.3,  5.1,  8.7 ]
    # B  [  2.3,  0.0,  3.2,  6.4 ]
    # C  [  5.1,  3.2,  0.0,  4.1 ]
    # D  [  8.7,  6.4,  4.1,  0.0 ]
```

Matriks ini bersifat **simetris** (`matrix[i][j] == matrix[j][i]`) karena
jarak A→B sama dengan B→A.

### Fungsi `total_route_distance(route, distance_matrix)`

```python
def total_route_distance(route, distance_matrix):
    # route = [0, 2, 1, 3] (urutan indeks yang dikunjungi)
    # Jumlahkan: jarak(0→2) + jarak(2→1) + jarak(1→3) + jarak(3→0)
    #                                                    ↑ % n = tutup loop

    total = 0
    for i in range(len(route)):
        from_idx = route[i]
        to_idx   = route[(i + 1) % len(route)]  # Loop ke awal
        total   += distance_matrix[from_idx][to_idx]
    return total
```

---

---

# 🔄 Alur Lengkap: User Menekan "Optimalkan Rute"

Berikut perjalanan data dari klik tombol sampai rute berwarna muncul:

```
[1] USER klik "Optimalkan Rute" di browser
         │
         ▼
[2] ui.js: _onOptimizeClick() dipanggil
    → isOptimizing = true
    → Tampilkan spinner di tombol
         │
         ▼
[3] ui.js memanggil: ApiModule.optimizeRoute(locations)
    → locations = [{id, name, lat, lng}, ...]
         │
         ▼
[4] api.js: optimizeRoute() (mode backend)
    → Kirim POST http://localhost:5000/api/optimize
    → Body: { "points": [[-7.79, 110.36], ...] }
    → Backend Python menjalankan algoritma Brute Force
    → Return { orderedLocations, totalDistanceKm, estimatedMinutes }
         │
         ▼
    app.py → routes/api.py: optimize_route()
    → Validasi 7 tahap
    → tsp.py: solve_tsp_brute_force()
        → distance.py: build_distance_matrix()
        → Iterasi semua permutasi
        → Pilih rute terpendek
    → Kembalikan JSON { best_route, total_distance, ... }
         │
         ▼
[5] ui.js menerima result
    → locations = result.orderedLocations  (urutan berubah!)
         │
         ▼
[6] ui.js memanggil: MapModule.drawRoute(latlngs, true)
    → map.js: clearRoute() (hapus rute lama)
    → map.js: _drawSegmentedRoute()
        → Untuk setiap segmen: buat 2 polyline (glow + utama)
        → Simpan ke routeSegments[]
         │
         ▼
[7] ui.js memanggil: MapModule.refreshMarkerIcons(locations)
    → map.js: Update angka di dalam setiap marker
         │
         ▼
[8] ui.js: _renderLocationList()
    → Hapus kartu lama dari sidebar
    → Render ulang kartu dengan urutan baru
         │
         ▼
[9] ui.js: _updateStats(42.5, 63)
    → Tampilkan "42.5 km" dan "1j 3m" di stat cards
         │
         ▼
[10] ui.js: MapModule.fitBoundsToMarkers()
    → Zoom peta agar semua marker terlihat
         │
         ▼
[11] ui.js: showToast("Rute berhasil dioptimalkan!", "success")
    → Notifikasi hijau muncul 3 detik
         │
         ▼
[12] isOptimizing = false, tombol aktif kembali
```

---

# 🚀 Cara Menjalankan Proyek

### Frontend saja (tanpa backend)

Buka file `frontend/index.html` langsung di browser.
Fitur optimasi akan berjalan dalam mode demo (dummy) tanpa perlu backend.

### Frontend + Backend

```bash
# 1. Masuk ke folder backend
cd "d:\PNM\SEMS 2\Struktur Data\UAS WayFinder\backend"

# 2. Buat virtual environment (opsional tapi disarankan)
python -m venv venv
venv\Scripts\activate        # Windows

# 3. Install dependensi
pip install -r requirements.txt

# 4. Jalankan server
python app.py
```

Server berjalan di `http://localhost:5000`

**Status Saat Ini:** Backend sudah diaktifkan di `api.js`. Frontend akan mengirim request ke backend untuk optimasi rute menggunakan algoritma Brute Force. Kode Nearest Neighbor di frontend tetap dipertahankan sebagai komentar untuk referensi pembelajaran.

---

_Dokumen ini dibuat secara otomatis untuk keperluan pembelajaran UAS._
_Terakhir diperbarui: Mei 2026_
