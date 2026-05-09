/**
 * api.js — WayFinder
 * ─────────────────────────────────────────────────
 * Layer abstraksi untuk komunikasi dengan backend.
 * Saat ini semua fungsi berjalan dalam mode DUMMY
 * (simulasi frontend-only) dan siap diganti dengan
 * panggilan API nyata ke endpoint backend.
 *
 * Konvensi:
 *  - Semua fungsi mengembalikan Promise
 *  - Gunakan async/await saat memanggil dari ui.js
 *  - Tandai setiap fungsi dummy dengan komentar
 *    // [DUMMY] untuk mudah ditemukan saat integrasi
 * ─────────────────────────────────────────────────
 */

const ApiModule = (() => {
  /* ── Config ──────────────────────────────────── */

  /**
   * Base URL backend (ganti saat backend tersedia).
   * Contoh: 'https://api.wayfinder.app/v1'
   */
  const BASE_URL = "https://api.wayfinder.app/v1"; // TODO: ganti saat backend siap

  /** Timeout default untuk fetch request (ms) */
  const REQUEST_TIMEOUT_MS = 10_000;

  /* ════════════════════════════════════════════════
     PUBLIC: optimizeRoute
     ─────────────────────────────────────────────
     Kirim daftar lokasi ke backend TSP solver dan
     terima urutan lokasi yang optimal.

     @param {Array<{id, name, lat, lng}>} locations
     @returns {Promise<{
       orderedLocations: Array<{id, name, lat, lng}>,
       totalDistanceKm:  number,
       estimatedMinutes: number
     }>}
  ════════════════════════════════════════════════ */
  async function optimizeRoute(locations) {
    // [DUMMY] Simulasi delay network + kalkulasi lokal
    // Ganti blok ini dengan fetch nyata ke backend:
    //
    // const response = await _fetchWithTimeout(`${BASE_URL}/optimize`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ locations })
    // });
    // return await response.json();

    return _dummyOptimize(locations);
  }

  /* ════════════════════════════════════════════════
     PUBLIC: reverseGeocode
     ─────────────────────────────────────────────
     Dapatkan nama tempat dari koordinat lat/lng.
     Saat backend aktif, gunakan endpoint geocoding.

     @param {number} lat
     @param {number} lng
     @returns {Promise<string>} — Nama tempat
  ════════════════════════════════════════════════ */
  async function reverseGeocode(lat, lng) {
    // [DUMMY] Kembalikan label koordinat sederhana
    // Ganti dengan call ke Nominatim atau geocoding backend:
    //
    // const response = await _fetchWithTimeout(
    //   `${BASE_URL}/geocode/reverse?lat=${lat}&lng=${lng}`
    // );
    // const data = await response.json();
    // return data.displayName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    return _dummyReverseGeocode(lat, lng);
  }

  /* ════════════════════════════════════════════════
     PUBLIC: searchLocation
     ─────────────────────────────────────────────
     Cari lokasi berdasarkan query teks.
     Placeholder untuk fitur search bar.

     @param {string} query
     @returns {Promise<Array<{name, lat, lng, address}>>}
  ════════════════════════════════════════════════ */
  async function searchLocation(query) {
    // [DUMMY] Kembalikan array kosong
    // Ganti dengan fetch ke search endpoint:
    //
    // const response = await _fetchWithTimeout(
    //   `${BASE_URL}/search?q=${encodeURIComponent(query)}`
    // );
    // return await response.json();

    console.warn("[ApiModule] searchLocation: dummy mode, query=", query);
    await _simulateDelay(300);
    return [];
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _fetchWithTimeout
     ─────────────────────────────────────────────
     Wrapper fetch dengan timeout otomatis.

     @param {string}  url
     @param {object}  options  — fetch options
     @param {number}  timeout  — ms (default 10_000)
     @returns {Promise<Response>}
  ════════════════════════════════════════════════ */
  async function _fetchWithTimeout(
    url,
    options = {},
    timeout = REQUEST_TIMEOUT_MS,
  ) {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error("Request timeout — server tidak merespons");
      }
      throw err;
    } finally {
      clearTimeout(timerId);
    }
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _dummyOptimize
     ─────────────────────────────────────────────
     Simulasi algoritma TSP sederhana (Nearest
     Neighbor Heuristic) di frontend.
     Ini BUKAN solusi optimal — hanya placeholder UI.

     @param {Array<{id, name, lat, lng}>} locations
     @returns {Promise<object>}
  ════════════════════════════════════════════════ */
  async function _dummyOptimize(locations) {
    await _simulateDelay(1200); // simulasi processing time

    if (!locations || locations.length < 2) {
      throw new Error("Minimal 2 lokasi diperlukan untuk optimasi rute");
    }

    /* Nearest Neighbor Heuristic (dummy TSP) */
    const unvisited = [...locations];
    const ordered = [];
    let current = unvisited.shift(); // mulai dari titik pertama
    ordered.push(current);

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let nearestDist = Infinity;

      unvisited.forEach((loc, idx) => {
        const dist = _haversineKm(current.lat, current.lng, loc.lat, loc.lng);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = idx;
        }
      });

      current = unvisited.splice(nearestIdx, 1)[0];
      ordered.push(current);
    }

    /* Hitung total jarak loop (kembali ke titik awal) */
    let totalKm = 0;
    for (let i = 0; i < ordered.length; i++) {
      const a = ordered[i];
      const b = ordered[(i + 1) % ordered.length];
      totalKm += _haversineKm(a.lat, a.lng, b.lat, b.lng);
    }

    /* Estimasi waktu (asumsi 40 km/jam rata-rata wisata) */
    const AVG_SPEED_KMH = 40;
    const estimatedMinutes = Math.round((totalKm / AVG_SPEED_KMH) * 60);

    return {
      orderedLocations: ordered,
      totalDistanceKm: parseFloat(totalKm.toFixed(2)),
      estimatedMinutes,
    };
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _dummyReverseGeocode
     Nama label default dari koordinat
  ════════════════════════════════════════════════ */
  async function _dummyReverseGeocode(lat, lng) {
    await _simulateDelay(50);
    return `Lokasi (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _haversineKm
     ─────────────────────────────────────────────
     Hitung jarak antara dua koordinat (km)
     menggunakan formula Haversine.

     @param {number} lat1, lng1, lat2, lng2
     @returns {number} jarak dalam kilometer
  ════════════════════════════════════════════════ */
  function _haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371; // radius Bumi dalam km
    const dLat = _deg2rad(lat2 - lat1);
    const dLng = _deg2rad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(_deg2rad(lat1)) *
        Math.cos(_deg2rad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _deg2rad — Konversi derajat ke radian
  ════════════════════════════════════════════════ */
  function _deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _simulateDelay — Simulasi async delay
     @param {number} ms
  ════════════════════════════════════════════════ */
  function _simulateDelay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /* ── Public API ──────────────────────────────── */
  return {
    optimizeRoute,
    reverseGeocode,
    searchLocation,
  };
})();
