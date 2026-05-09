/**
 * ============================================================
 * FILE: api.js
 * PERAN: Lapisan komunikasi antara frontend dan backend
 * ============================================================
 *
 * Bayangkan file ini seperti "kurir" antara tampilan web (ui.js)
 * dan server Python (backend). Semua pengiriman data ke server
 * harus melewati file ini.
 *
 * SAAT INI: Berjalan dalam mode DUMMY (simulasi tanpa server).
 * Artinya semua perhitungan dilakukan di browser sendiri.
 * Kalau backend sudah aktif, tinggal ganti beberapa baris saja.
 *
 * POLA DESAIN yang digunakan: Module Pattern (IIFE)
 * → Semua kode dibungkus dalam fungsi yang langsung dipanggil
 * → Tujuannya: variabel di dalam tidak bisa diakses dari luar
 * → Ibarat "ruangan tertutup" — hanya pintu tertentu yang terbuka
 */

// ============================================================
// ApiModule: objek yang berisi semua fungsi komunikasi dengan server
// Menggunakan IIFE = Immediately Invoked Function Expression
// Artinya: fungsi ini langsung dieksekusi saat file dimuat
// ============================================================
const ApiModule = (() => {

  // ----------------------------------------------------------
  // KONFIGURASI
  // ----------------------------------------------------------

  /**
   * URL dasar server backend.
   * Saat backend sudah jalan, ganti ini dengan URL yang benar.
   * Contoh: "http://localhost:5000"
   */
  const BASE_URL = "https://api.wayfinder.app/v1"; // TODO: ganti saat backend siap

  /**
   * Batas waktu menunggu respons server (dalam milidetik).
   * 10_000 ms = 10 detik.
   * Kalau server tidak merespons dalam 10 detik → otomatis batal.
   */
  const REQUEST_TIMEOUT_MS = 10_000;


  // ============================================================
  // FUNGSI PUBLIC #1: optimizeRoute
  // ============================================================
  /**
   * Fungsi ini bertugas MENGIRIM daftar lokasi ke server
   * dan MENERIMA urutan lokasi yang sudah dioptimalkan (TSP).
   *
   * @param {Array} locations - Array objek lokasi dari ui.js
   *   Contoh isi:
   *   [
   *     { id: "loc_1", name: "Malioboro", lat: -7.79, lng: 110.36 },
   *     { id: "loc_2", name: "Tugu Jogja", lat: -7.78, lng: 110.37 },
   *   ]
   *
   * @returns {Promise<object>} - Hasil dari server (atau simulasi):
   *   {
   *     orderedLocations: [...], // Lokasi yang sudah urut optimal
   *     totalDistanceKm: 42.5,  // Total jarak perjalanan (km)
   *     estimatedMinutes: 63    // Estimasi waktu tempuh (menit)
   *   }
   *
   * CATATAN: Fungsi ini adalah "async" karena menunggu respons
   * dari server/simulasi yang bisa memakan waktu beberapa detik.
   */
  async function optimizeRoute(locations) {

    // [MODE DUMMY] ─────────────────────────────────────────────
    // Saat ini tidak benar-benar ke server, tapi ke fungsi simulasi.
    // Hapus baris ini dan aktifkan kode di bawah saat backend siap.
    return _dummyOptimize(locations);

    // [MODE BACKEND] ─────────────────────────────────────────────
    // Aktifkan ini saat backend sudah berjalan:
    //
    // const response = await _fetchWithTimeout(`${BASE_URL}/optimize`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     // Backend hanya butuh koordinat (tanpa id/name)
    //     points: locations.map(l => [l.lat, l.lng])
    //   }),
    // });
    // return await response.json();
  }


  // ============================================================
  // FUNGSI PUBLIC #2: reverseGeocode
  // ============================================================
  /**
   * "Reverse Geocode" = mengubah koordinat (angka) → nama tempat (teks).
   *
   * Contoh:
   *   Input:  lat=-7.7928, lng=110.3653
   *   Output: "Malioboro, Yogyakarta" (kalau pakai API sungguhan)
   *           "Lokasi (-7.7928, 110.3653)" (mode dummy)
   *
   * Dipanggil oleh ui.js saat user klik peta tanpa mengisi nama lokasi.
   *
   * @param {number} lat - Latitude (garis lintang)
   * @param {number} lng - Longitude (garis bujur)
   * @returns {Promise<string>} - Nama tempat
   */
  async function reverseGeocode(lat, lng) {

    // [MODE DUMMY] ─────────────────────────────────────────────
    // Kembalikan label koordinat sederhana sebagai nama default.
    return _dummyReverseGeocode(lat, lng);

    // [MODE BACKEND / NOMINATIM] ─────────────────────────────────
    // Aktifkan ini untuk geocoding sungguhan:
    //
    // const response = await _fetchWithTimeout(
    //   `${BASE_URL}/geocode/reverse?lat=${lat}&lng=${lng}`
    // );
    // const data = await response.json();
    // return data.displayName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }


  // ============================================================
  // FUNGSI PUBLIC #3: searchLocation
  // ============================================================
  /**
   * Mencari lokasi berdasarkan teks yang diketik user di search bar.
   * Saat ini belum diimplementasikan (selalu return kosong).
   *
   * @param {string} query - Teks pencarian, contoh: "Malioboro"
   * @returns {Promise<Array>} - Daftar hasil pencarian (kosong untuk sekarang)
   */
  async function searchLocation(query) {
    // Tampilkan peringatan di konsol browser (buka F12 untuk melihat)
    console.warn("[ApiModule] searchLocation: dummy mode, query=", query);

    // Simulasi delay jaringan kecil
    await _simulateDelay(300);

    // Kembalikan array kosong (belum ada implementasi)
    return [];
  }


  // ============================================================
  // FUNGSI PRIVATE #1: _fetchWithTimeout
  // Diawali _ artinya PRIVATE (hanya dipakai di dalam file ini)
  // ============================================================
  /**
   * Wrapper (pembungkus) untuk fungsi fetch() bawaan browser.
   * Ditambahkan fitur: otomatis BATALKAN jika server terlalu lama.
   *
   * Kenapa perlu ini?
   * → fetch() biasa tidak punya batas waktu.
   * → Kalau server mati, halaman web bisa "loading selamanya".
   * → Fungsi ini memastikan maksimal hanya menunggu 10 detik.
   *
   * Cara kerja AbortController:
   * 1. Buat "remote control" (controller)
   * 2. Mulai hitung mundur (setTimeout)
   * 3. Kirim fetch() sambil beri signal dari remote control
   * 4. Jika countdown selesai → tekan tombol "cancel" di remote
   * 5. fetch() otomatis berhenti
   *
   * @param {string} url     - URL tujuan fetch
   * @param {object} options - Opsi fetch (method, headers, body, dll)
   * @param {number} timeout - Batas waktu dalam ms (default: 10 detik)
   * @returns {Promise<Response>} - Objek Response dari fetch
   */
  async function _fetchWithTimeout(url, options = {}, timeout = REQUEST_TIMEOUT_MS) {

    // AbortController = alat untuk membatalkan fetch dari luar
    const controller = new AbortController();

    // Atur timer: setelah `timeout` ms, batalkan request
    const timerId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,                    // Spread opsi yang dikirim
        signal: controller.signal,     // Pasang "remote control"
      });

      // Jika server merespons dengan kode error (4xx, 5xx)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;

    } catch (err) {
      // Jika error karena timeout (bukan error lain)
      if (err.name === "AbortError") {
        throw new Error("Request timeout — server tidak merespons");
      }
      // Lemparkan error lain apa adanya ke pemanggil
      throw err;

    } finally {
      // SELALU bersihkan timer, baik sukses maupun gagal
      // (mencegah timer terus berjalan dan menyebabkan bug)
      clearTimeout(timerId);
    }
  }


  // ============================================================
  // FUNGSI PRIVATE #2: _dummyOptimize
  // ============================================================
  /**
   * Simulasi algoritma TSP di browser (tanpa server).
   * Menggunakan "Nearest Neighbor Heuristic" (Heuristik Tetangga Terdekat).
   *
   * PENTING: Ini BUKAN solusi TSP yang optimal!
   * Ini hanya perkiraan cepat untuk keperluan demo UI.
   * Solusi TSP yang benar-benar optimal ada di backend (tsp.py).
   *
   * CARA KERJA Nearest Neighbor:
   * ┌─────────────────────────────────────────────────────┐
   * │ 1. Mulai dari titik pertama                         │
   * │ 2. Cari titik yang PALING DEKAT dari posisi saat ini │
   * │ 3. Kunjungi titik tersebut                          │
   * │ 4. Ulangi langkah 2-3 sampai semua titik dikunjungi │
   * │ 5. Kembali ke titik pertama (menutup loop perjalanan)│
   * └─────────────────────────────────────────────────────┘
   *
   * @param {Array} locations - Daftar lokasi
   * @returns {Promise<object>} - Hasil optimasi dummy
   */
  async function _dummyOptimize(locations) {

    // Simulasikan "waktu proses" server (1.2 detik)
    // Ini agar UI terasa realistis (ada spinner loading)
    await _simulateDelay(1200);

    // Validasi: minimal 2 titik
    if (!locations || locations.length < 2) {
      throw new Error("Minimal 2 lokasi diperlukan untuk optimasi rute");
    }

    // ── Nearest Neighbor Heuristic ──────────────────────────

    // Buat salinan array (agar array asli tidak berubah)
    const unvisited = [...locations]; // Titik yang belum dikunjungi
    const ordered   = [];            // Titik yang sudah diurutkan

    // Mulai dari titik pertama
    let current = unvisited.shift(); // Ambil dan hapus elemen pertama
    ordered.push(current);

    // Selama masih ada titik yang belum dikunjungi
    while (unvisited.length > 0) {
      let nearestIdx  = 0;        // Indeks titik terdekat
      let nearestDist = Infinity; // Jarak terdekat (mulai dari tak terhingga)

      // Cari titik yang paling dekat dari posisi sekarang
      unvisited.forEach((loc, idx) => {
        const dist = _haversineKm(current.lat, current.lng, loc.lat, loc.lng);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx  = idx;
        }
      });

      // Pindah ke titik terdekat
      current = unvisited.splice(nearestIdx, 1)[0]; // splice = ambil & hapus dari array
      ordered.push(current);
    }

    // ── Hitung total jarak (loop tertutup) ─────────────────

    let totalKm = 0;
    for (let i = 0; i < ordered.length; i++) {
      const a = ordered[i];
      const b = ordered[(i + 1) % ordered.length]; // % = modulo, menutup loop ke awal

      totalKm += _haversineKm(a.lat, a.lng, b.lat, b.lng);
    }

    // ── Estimasi waktu tempuh ───────────────────────────────
    // Asumsi kecepatan rata-rata kendaraan wisata = 40 km/jam
    const AVG_SPEED_KMH  = 40;
    const estimatedMinutes = Math.round((totalKm / AVG_SPEED_KMH) * 60);

    // Kembalikan hasil
    return {
      orderedLocations: ordered,
      totalDistanceKm:  parseFloat(totalKm.toFixed(2)), // Bulatkan 2 desimal
      estimatedMinutes,
    };
  }


  // ============================================================
  // FUNGSI PRIVATE #3: _dummyReverseGeocode
  // ============================================================
  /**
   * Versi dummy dari reverse geocode.
   * Hanya mengembalikan teks koordinat sebagai nama lokasi.
   */
  async function _dummyReverseGeocode(lat, lng) {
    await _simulateDelay(50); // Sedikit delay agar terasa realistis
    return `Lokasi (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }


  // ============================================================
  // FUNGSI PRIVATE #4: _haversineKm
  // ============================================================
  /**
   * Menghitung jarak antara dua titik koordinat GPS dalam kilometer.
   *
   * Menggunakan RUMUS HAVERSINE yang memperhitungkan kelengkungan bumi.
   * (Berbeda dengan jarak lurus biasa yang mengasumsikan bumi datar)
   *
   * Rumus matematikanya:
   *   a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlng/2)
   *   c = 2 × atan2(√a, √(1-a))
   *   d = R × c   ← R = 6371 km (radius bumi)
   *
   * @param {number} lat1 - Latitude titik pertama
   * @param {number} lng1 - Longitude titik pertama
   * @param {number} lat2 - Latitude titik kedua
   * @param {number} lng2 - Longitude titik kedua
   * @returns {number} - Jarak dalam kilometer
   */
  function _haversineKm(lat1, lng1, lat2, lng2) {
    const R    = 6371; // Radius bumi dalam km
    const dLat = _deg2rad(lat2 - lat1); // Selisih latitude → radian
    const dLng = _deg2rad(lng2 - lng1); // Selisih longitude → radian

    // Komponen "a" dari rumus Haversine
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(_deg2rad(lat1)) *
        Math.cos(_deg2rad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    // Komponen "c" = sudut pusat bumi
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Jarak = radius × sudut
    return R * c;
  }


  // ============================================================
  // FUNGSI PRIVATE #5: _deg2rad
  // ============================================================
  /**
   * Konversi satuan sudut dari DERAJAT ke RADIAN.
   *
   * Kenapa perlu? Math.sin(), Math.cos() dll di JavaScript
   * menggunakan RADIAN, tapi koordinat GPS ditulis dalam DERAJAT.
   * Jadi harus dikonversi dulu sebelum dihitung.
   *
   * Rumus: radian = derajat × (π / 180)
   */
  function _deg2rad(deg) {
    return deg * (Math.PI / 180);
  }


  // ============================================================
  // FUNGSI PRIVATE #6: _simulateDelay
  // ============================================================
  /**
   * Membuat delay (jeda) buatan dalam milidetik.
   * Dipakai untuk mensimulasikan "waktu tunggu server".
   *
   * Cara kerjanya:
   * → Mengembalikan Promise yang baru resolve setelah X ms
   * → Digunakan dengan: await _simulateDelay(1000)
   * → Eksekusi kode akan berhenti sementara sebanyak 1000ms
   *
   * @param {number} ms - Durasi jeda dalam milidetik
   */
  function _simulateDelay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }


  // ============================================================
  // PUBLIC API — Fungsi yang bisa diakses dari file lain
  // ============================================================
  // Hanya fungsi yang terdaftar di sini yang bisa dipanggil
  // dari ui.js. Fungsi dengan nama diawali '_' tetap tersembunyi.
  return {
    optimizeRoute,   // Dipanggil ui.js saat tombol "Optimalkan" diklik
    reverseGeocode,  // Dipanggil ui.js saat user klik peta tanpa nama
    searchLocation,  // Placeholder — belum diimplementasikan
  };

})(); // ← Tutup IIFE dan langsung panggil (() => {...})()
