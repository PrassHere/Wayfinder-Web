/**
 * ui.js — WayFinder
 * ─────────────────────────────────────────────────
 * Mengelola state aplikasi dan semua interaksi UI:
 *   - State daftar lokasi
 *   - Render kartu lokasi di sidebar
 *   - Tombol tambah, hapus, dan clear
 *   - Panggil ApiModule.optimizeRoute
 *   - Update stats, route info
 *   - Toast notification
 *   - Sidebar toggle (mobile)
 * ─────────────────────────────────────────────────
 */

const UIModule = (() => {
  /* ════════════════════════════════════════════════
     STATE
  ════════════════════════════════════════════════ */

  /**
   * @type {Array<{id:string, name:string, lat:number, lng:number}>}
   * Daftar lokasi yang ditambahkan pengguna
   */
  let locations = [];

  /** @type {boolean} Apakah sedang dalam proses optimasi? */
  let isOptimizing = false;

  /** @type {boolean} Sudah pernah klik peta? (untuk hide hint) */
  let mapClickedOnce = false;

  /** Counter untuk ID unik lokasi */
  let locationIdCounter = 0;

  /* ════════════════════════════════════════════════
     DOM REFERENCES — di-cache satu kali saat init
  ════════════════════════════════════════════════ */
  let DOM = {};

  function _cacheDOMRefs() {
    DOM = {
      locationInput: document.getElementById("locationInput"),
      addLocationBtn: document.getElementById("addLocationBtn"),
      optimizeBtn: document.getElementById("optimizeBtn"),
      clearAllBtn: document.getElementById("clearAllBtn"),
      locationList: document.getElementById("locationList"),
      emptyState: document.getElementById("emptyState"),
      locationCount: document.getElementById("locationCount"),
      totalDistance: document.getElementById("totalDistance"),
      estTime: document.getElementById("estTime"),
      routeInfo: document.getElementById("routeInfo"),
      routeOrder: document.getElementById("routeOrder"),
      statusLabel: document.getElementById("statusLabel"),
      statusPill: document.getElementById("statusPill"),
      mapHint: document.getElementById("mapHint"),
      toastContainer: document.getElementById("toastContainer"),
      globalSearch: document.getElementById("globalSearch"),
      sidebarToggle: document.getElementById("sidebarToggle"),
      sidebar: document.getElementById("sidebar"),
    };
  }

  /* ════════════════════════════════════════════════
     PUBLIC: init — Entry point, dipanggil saat DOM ready
  ════════════════════════════════════════════════ */
  function init() {
    _cacheDOMRefs();
    _bindEvents();

    /* Inisialisasi peta */
    MapModule.init();

    /* Render initial state */
    _renderLocationList();
    _updateOptimizeButtonState();

    console.info("[WayFinder UI] UI initialized ✓");
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _bindEvents — Pasang semua event listener
  ════════════════════════════════════════════════ */
  function _bindEvents() {
    /* Tombol tambah lokasi */
    DOM.addLocationBtn?.addEventListener("click", _onAddLocationClick);

    /* Enter di input */
    DOM.locationInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") _onAddLocationClick();
    });

    /* Tombol optimize */
    DOM.optimizeBtn?.addEventListener("click", _onOptimizeClick);

    /* Tombol clear all */
    DOM.clearAllBtn?.addEventListener("click", _onClearAllClick);

    /* Global search (placeholder) */
    DOM.globalSearch?.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        const query = DOM.globalSearch.value.trim();
        if (query) {
          showToast(
            "Fitur pencarian akan tersedia setelah backend aktif",
            "warning",
          );
        }
      }
    });

    /* Sidebar toggle (mobile) */
    DOM.sidebarToggle?.addEventListener("click", _toggleSidebar);

    /* Overlay click tutup sidebar (mobile) */
    document.addEventListener("click", (e) => {
      if (
        DOM.sidebar?.classList.contains("is-open") &&
        !DOM.sidebar.contains(e.target) &&
        e.target !== DOM.sidebarToggle
      ) {
        _closeSidebar();
      }
    });
  }

  /* ════════════════════════════════════════════════
     PUBLIC: addLocationFromMap
     ─────────────────────────────────────────────
     Dipanggil oleh map.js saat user klik peta
     @param {number} lat
     @param {number} lng
     @param {string} customName — nama dari input (bisa kosong)
  ════════════════════════════════════════════════ */
  async function addLocationFromMap(lat, lng, customName = "") {
    /* Hide hint setelah klik pertama */
    if (!mapClickedOnce) {
      mapClickedOnce = true;
      DOM.mapHint?.classList.add("hidden");
    }

    /* Tentukan nama lokasi */
    let name = customName;
    if (!name) {
      /* Coba reverse geocode (dummy) */
      name = await ApiModule.reverseGeocode(lat, lng);
    }

    _addLocation(name, lat, lng);
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _onAddLocationClick
     Tambah lokasi dari tombol (tanpa koordinat peta)
  ════════════════════════════════════════════════ */
  function _onAddLocationClick() {
    const name = DOM.locationInput?.value.trim();
    if (!name) {
      showToast("Masukkan nama lokasi atau klik pada peta", "warning");
      DOM.locationInput?.focus();
      return;
    }

    /* Tanpa klik peta: gunakan koordinat random di sekitar Indonesia */
    const lat = -6.2 + (Math.random() - 0.5) * 4;
    const lng = 106.8 + (Math.random() - 0.5) * 6;

    _addLocation(name, lat, lng);
    if (DOM.locationInput) DOM.locationInput.value = "";

    showToast(`"${name}" ditambahkan ke daftar`, "success");
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _addLocation — Tambah lokasi ke state
  ════════════════════════════════════════════════ */
  function _addLocation(name, lat, lng) {
    const id = `loc_${++locationIdCounter}_${Date.now()}`;

    const location = { id, name, lat, lng };
    locations.push(location);

    /* Tambah marker ke peta */
    const isStart = locations.length === 1;
    MapModule.addMarker(id, lat, lng, name, locations.length, isStart);

    /* Update UI */
    _renderLocationList();
    _updateOptimizeButtonState();
    _updateLocationCount();

    /* Gambar rute sementara (garis putus-putus) jika >= 2 lokasi */
    if (locations.length >= 2) {
      _drawPreviewRoute();
    }

    /* Reset stats jika ada */
    _resetStats();
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _removeLocation
     @param {string} id
  ════════════════════════════════════════════════ */
  function _removeLocation(id) {
    const idx = locations.findIndex((l) => l.id === id);
    if (idx === -1) return;

    const removedName = locations[idx].name;
    locations.splice(idx, 1);

    /* Hapus marker */
    MapModule.removeMarker(id);

    /* Perbarui ikon marker yang tersisa */
    MapModule.refreshMarkerIcons(locations);

    /* Update UI */
    _renderLocationList();
    _updateOptimizeButtonState();
    _updateLocationCount();

    /* Gambar ulang rute preview */
    if (locations.length >= 2) {
      _drawPreviewRoute();
    } else {
      MapModule.clearRoute();
    }

    _resetStats();
    showToast(`"${removedName}" dihapus`, "default");
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _onOptimizeClick — Jalankan optimasi
  ════════════════════════════════════════════════ */
  async function _onOptimizeClick() {
    if (isOptimizing || locations.length < 2) return;

    isOptimizing = true;
    _setStatus("optimizing", "Mengoptimalkan…");
    _setOptimizeButtonLoading(true);

    try {
      const result = await ApiModule.optimizeRoute(locations);

      /* Update state dengan urutan baru */
      locations = result.orderedLocations;

      /* Gambar rute optimal */
      const latlngs = locations.map((l) => [l.lat, l.lng]);
      MapModule.drawRoute(latlngs, true);

      /* Perbarui ikon marker */
      MapModule.refreshMarkerIcons(locations);

      /* Render ulang sidebar list */
      _renderLocationList();

      /* Update stats */
      _updateStats(result.totalDistanceKm, result.estimatedMinutes);

      /* Tampilkan panel urutan rute */
      _renderRouteInfo(locations);

      /* Fit bounds ke semua marker */
      MapModule.fitBoundsToMarkers();

      _setStatus("ready", "Rute optimal");
      showToast("Rute berhasil dioptimalkan!", "success");
    } catch (err) {
      console.error("[WayFinder] Optimize error:", err);
      _setStatus("error", "Gagal");
      showToast(err.message || "Gagal mengoptimalkan rute", "error");
    } finally {
      isOptimizing = false;
      _setOptimizeButtonLoading(false);
    }
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _onClearAllClick
  ════════════════════════════════════════════════ */
  function _onClearAllClick() {
    if (locations.length === 0) return;

    /* Konfirmasi sederhana */
    if (!confirm("Hapus semua lokasi dari daftar?")) return;

    locations = [];
    MapModule.removeAllMarkers();
    MapModule.clearRoute();

    _renderLocationList();
    _updateOptimizeButtonState();
    _updateLocationCount();
    _resetStats();
    _hideRouteInfo();

    _setStatus("ready", "Siap");
    showToast("Semua lokasi dihapus", "default");
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _renderLocationList
     Render ulang daftar kartu lokasi di sidebar
  ════════════════════════════════════════════════ */
  function _renderLocationList() {
    if (!DOM.locationList) return;

    /* Bersihkan isi (kecuali empty state) */
    const existingCards = DOM.locationList.querySelectorAll(".location-card");
    existingCards.forEach((c) => c.remove());

    if (locations.length === 0) {
      /* Tampilkan empty state */
      if (DOM.emptyState) {
        DOM.emptyState.style.display = "flex";
      }
      return;
    }

    /* Sembunyikan empty state */
    if (DOM.emptyState) {
      DOM.emptyState.style.display = "none";
    }

    /* Render setiap kartu */
    locations.forEach((loc, idx) => {
      const card = _createLocationCard(loc, idx + 1);
      DOM.locationList.appendChild(card);
    });
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _createLocationCard
     Buat elemen kartu lokasi
     @param {object} loc    — data lokasi
     @param {number} index  — urutan (dimulai 1)
     @returns {HTMLElement}
  ════════════════════════════════════════════════ */
  function _createLocationCard(loc, index) {
    const card = document.createElement("div");
    card.className = "location-card";
    card.dataset.locationId = loc.id;

    card.innerHTML = `
      <!-- Badge nomor urut -->
      <div class="card-badge">${index}</div>

      <!-- Info lokasi -->
      <div class="card-content">
        <div class="card-name" title="${_escapeHTML(loc.name)}">${_escapeHTML(loc.name)}</div>
        <div class="card-coords">${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</div>
      </div>

      <!-- Tombol hapus -->
      <button class="card-delete" data-id="${loc.id}" title="Hapus lokasi" aria-label="Hapus ${_escapeHTML(loc.name)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    /* Klik kartu → pan ke marker di peta */
    card.addEventListener("click", (e) => {
      if (e.target.closest(".card-delete")) return;

      /* Active state */
      document
        .querySelectorAll(".location-card.is-active")
        .forEach((c) => c.classList.remove("is-active"));
      card.classList.add("is-active");

      MapModule.panToMarker(loc.id);
    });

    /* Klik tombol delete */
    const deleteBtn = card.querySelector(".card-delete");
    deleteBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      _removeLocation(loc.id);
    });

    return card;
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _drawPreviewRoute
     Gambar rute putus-putus sebelum dioptimalkan
  ════════════════════════════════════════════════ */
  function _drawPreviewRoute() {
    const latlngs = locations.map((l) => [l.lat, l.lng]);
    MapModule.drawRoute(latlngs, false);
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _updateOptimizeButtonState
  ════════════════════════════════════════════════ */
  function _updateOptimizeButtonState() {
    if (!DOM.optimizeBtn) return;
    DOM.optimizeBtn.disabled = locations.length < 2 || isOptimizing;
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _setOptimizeButtonLoading
  ════════════════════════════════════════════════ */
  function _setOptimizeButtonLoading(loading) {
    if (!DOM.optimizeBtn) return;

    DOM.optimizeBtn.disabled = loading;

    if (loading) {
      DOM.optimizeBtn.classList.add("is-loading");
      DOM.optimizeBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Memproses…
      `;
    } else {
      DOM.optimizeBtn.classList.remove("is-loading");
      DOM.optimizeBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        Optimalkan Rute
      `;
    }
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _updateLocationCount
  ════════════════════════════════════════════════ */
  function _updateLocationCount() {
    if (!DOM.locationCount) return;
    const n = locations.length;
    DOM.locationCount.textContent = `${n} titik`;
    DOM.locationCount.classList.toggle("has-items", n > 0);
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _updateStats
  ════════════════════════════════════════════════ */
  function _updateStats(distanceKm, minutes) {
    if (DOM.totalDistance) {
      DOM.totalDistance.textContent = `${distanceKm.toLocaleString("id-ID")} km`;
    }
    if (DOM.estTime) {
      DOM.estTime.textContent =
        minutes >= 60
          ? `${Math.floor(minutes / 60)}j ${minutes % 60}m`
          : `${minutes} menit`;
    }
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _resetStats
  ════════════════════════════════════════════════ */
  function _resetStats() {
    if (DOM.totalDistance) DOM.totalDistance.textContent = "— km";
    if (DOM.estTime) DOM.estTime.textContent = "— menit";
    _hideRouteInfo();
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _renderRouteInfo
     Render urutan lokasi dalam panel rute optimal
  ════════════════════════════════════════════════ */
  function _renderRouteInfo(orderedLocations) {
    if (!DOM.routeInfo || !DOM.routeOrder) return;

    DOM.routeOrder.innerHTML = orderedLocations
      .map(
        (loc, idx) => `
        <li>
          <span class="ro-num">${idx + 1}.</span>
          ${_escapeHTML(loc.name)}
        </li>
      `,
      )
      .join("");

    /* Tutup loop */
    if (orderedLocations.length > 0) {
      DOM.routeOrder.innerHTML += `
        <li>
          <span class="ro-num">↩</span>
          ${_escapeHTML(orderedLocations[0].name)} (kembali)
        </li>
      `;
    }

    DOM.routeInfo.style.display = "block";
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _hideRouteInfo
  ════════════════════════════════════════════════ */
  function _hideRouteInfo() {
    if (DOM.routeInfo) DOM.routeInfo.style.display = "none";
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _setStatus
     @param {'ready'|'optimizing'|'error'} type
     @param {string} label
  ════════════════════════════════════════════════ */
  function _setStatus(type, label) {
    if (!DOM.statusPill || !DOM.statusLabel) return;

    DOM.statusPill.className = "status-pill";
    if (type === "optimizing")
      DOM.statusPill.classList.add("status--optimizing");
    if (type === "error") DOM.statusPill.classList.add("status--error");

    DOM.statusLabel.textContent = label;
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _toggleSidebar / _closeSidebar (mobile)
  ════════════════════════════════════════════════ */
  function _toggleSidebar() {
    const isOpen = DOM.sidebar?.classList.toggle("is-open");

    let overlay = document.querySelector(".sidebar-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "sidebar-overlay";
      document.body.appendChild(overlay);
      overlay.addEventListener("click", _closeSidebar);
    }

    overlay.classList.toggle("is-visible", isOpen);
  }

  function _closeSidebar() {
    DOM.sidebar?.classList.remove("is-open");
    document.querySelector(".sidebar-overlay")?.classList.remove("is-visible");
  }

  /* ════════════════════════════════════════════════
     PUBLIC: showToast — Tampilkan notifikasi toast
     @param {string} message
     @param {'default'|'success'|'warning'|'error'} type
     @param {number} duration — ms
  ════════════════════════════════════════════════ */
  function showToast(message, type = "default", duration = 3000) {
    if (!DOM.toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast${type !== "default" ? ` toast--${type}` : ""}`;

    /* Icon sesuai tipe */
    const icons = {
      success:
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      warning:
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      error:
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      default:
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
    };

    toast.innerHTML = `${icons[type] || icons.default} ${_escapeHTML(message)}`;
    DOM.toastContainer.appendChild(toast);

    /* Auto dismiss */
    setTimeout(() => {
      toast.classList.add("toast--out");
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _escapeHTML — Sanitasi teks user
  ════════════════════════════════════════════════ */
  function _escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ── Public API ──────────────────────────────── */
  return {
    init,
    addLocationFromMap,
    showToast,
  };
})();

/* ════════════════════════════════════════════════
   Bootstrap — Mulai saat DOM siap
════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  UIModule.init();
});
