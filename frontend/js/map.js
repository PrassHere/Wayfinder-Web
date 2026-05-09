/**
 * map.js — WayFinder
 * ─────────────────────────────────────────────────
 * Handles all Leaflet map interactions:
 *   - Map initialization
 *   - Click to add marker
 *   - Custom marker rendering
 *   - Polyline route drawing
 *   - Map utility controls (center, fitBounds)
 * ─────────────────────────────────────────────────
 */

/* ── Map state ─────────────────────────────────── */
const MapModule = (() => {
  /** @type {L.Map} Leaflet map instance */
  let mapInstance = null;

  /** @type {L.LayerGroup} Layer group for all markers */
  let markerLayerGroup = null;

  /** @type {L.Polyline|null} Active route polyline */
  let routePolyline = null;

  /** @type {Object.<string, L.Marker>} Map of locationId → Leaflet marker */
  const markerRegistry = {};

  /* ── Default center: Indonesia (tengah) ──────── */
  const DEFAULT_CENTER = [-2.5, 118.0];
  const DEFAULT_ZOOM = 5;

  /* ── Tile layer URL (OpenStreetMap) ──────────── */
  const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const TILE_ATTRIB =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  /* ════════════════════════════════════════════════
     PUBLIC: init — Inisialisasi peta Leaflet
  ════════════════════════════════════════════════ */
  function init() {
    if (mapInstance) return; // guard: jangan init dua kali

    mapInstance = L.map("map", {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });

    /* Posisi tombol zoom ke kiri bawah */
    mapInstance.zoomControl.setPosition("bottomleft");

    /* Tile layer */
    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIB,
      maxZoom: 19,
    }).addTo(mapInstance);

    /* Layer group untuk marker */
    markerLayerGroup = L.layerGroup().addTo(mapInstance);

    /* Event: klik pada peta */
    mapInstance.on("click", _onMapClick);

    /* Event listener tombol FAB */
    _initFabControls();

    console.info("[WayFinder Map] Map initialized ✓");
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _onMapClick — Tangani klik peta
  ════════════════════════════════════════════════ */
  function _onMapClick(e) {
    const { lat, lng } = e.latlng;

    /* Ambil nama dari input (opsional) */
    const nameInput = document.getElementById("locationInput");
    const rawName = nameInput ? nameInput.value.trim() : "";

    /* Kirim ke UIModule untuk diproses */
    if (typeof UIModule !== "undefined") {
      UIModule.addLocationFromMap(lat, lng, rawName);
      if (nameInput) nameInput.value = "";
    }
  }

  /* ════════════════════════════════════════════════
     PUBLIC: addMarker — Tambah marker ke peta
     @param {string} id       — ID unik lokasi
     @param {number} lat
     @param {number} lng
     @param {string} label    — Label teks
     @param {number} index    — Urutan (dimulai dari 1)
     @param {boolean} isStart — Marker pertama?
  ════════════════════════════════════════════════ */
  function addMarker(id, lat, lng, label, index, isStart = false) {
    /* Buat custom icon menggunakan DivIcon */
    const icon = L.divIcon({
      className: "", // reset class default Leaflet
      html: _buildMarkerHTML(index, isStart),
      iconSize: [32, 42],
      iconAnchor: [16, 42],
      popupAnchor: [0, -44],
    });

    const marker = L.marker([lat, lng], { icon })
      .addTo(markerLayerGroup)
      .bindPopup(_buildPopupHTML(label, lat, lng), {
        className: "wf-popup",
        maxWidth: 220,
        closeButton: true,
      });

    /* Simpan ke registry */
    markerRegistry[id] = marker;

    /* Hover tooltip */
    marker.bindTooltip(label, {
      permanent: false,
      direction: "top",
      offset: [0, -44],
      className: "wf-tooltip",
    });

    return marker;
  }

  /* ════════════════════════════════════════════════
     PUBLIC: removeMarker — Hapus marker dari peta
     @param {string} id
  ════════════════════════════════════════════════ */
  function removeMarker(id) {
    if (!markerRegistry[id]) return;
    markerLayerGroup.removeLayer(markerRegistry[id]);
    delete markerRegistry[id];
  }

  /* ════════════════════════════════════════════════
     PUBLIC: removeAllMarkers — Hapus semua marker
  ════════════════════════════════════════════════ */
  function removeAllMarkers() {
    markerLayerGroup.clearLayers();
    Object.keys(markerRegistry).forEach((k) => delete markerRegistry[k]);
  }

  /* ════════════════════════════════════════════════
     PUBLIC: refreshMarkerIcons
     Perbarui semua ikon marker (setelah urutan berubah)
     @param {Array} locations — Array lokasi terurut
  ════════════════════════════════════════════════ */
  function refreshMarkerIcons(locations) {
    locations.forEach((loc, idx) => {
      const marker = markerRegistry[loc.id];
      if (!marker) return;

      const isStart = idx === 0;
      const icon = L.divIcon({
        className: "",
        html: _buildMarkerHTML(idx + 1, isStart),
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -44],
      });
      marker.setIcon(icon);
    });
  }

  /* ════════════════════════════════════════════════
     PUBLIC: drawRoute — Gambar polyline rute
     @param {Array<[number,number]>} latlngs — Array koordinat
     @param {boolean} isOptimized — Gaya garis
  ════════════════════════════════════════════════ */
  function drawRoute(latlngs, isOptimized = false) {
    /* Hapus polyline lama */
    clearRoute();

    if (!latlngs || latlngs.length < 2) return;

    /* Tutup loop kembali ke titik awal */
    const closedPath = [...latlngs, latlngs[0]];

    routePolyline = L.polyline(closedPath, {
      color: isOptimized ? "#c9a84c" : "#333333",
      weight: isOptimized ? 3.5 : 2.5,
      opacity: isOptimized ? 0.85 : 0.5,
      dashArray: isOptimized ? null : "8, 6",
      lineCap: "round",
      lineJoin: "round",
    }).addTo(mapInstance);
  }

  /* ════════════════════════════════════════════════
     PUBLIC: clearRoute — Hapus polyline rute
  ════════════════════════════════════════════════ */
  function clearRoute() {
    if (routePolyline) {
      mapInstance.removeLayer(routePolyline);
      routePolyline = null;
    }
  }

  /* ════════════════════════════════════════════════
     PUBLIC: fitBounds — Sesuaikan zoom ke semua marker
  ════════════════════════════════════════════════ */
  function fitBoundsToMarkers() {
    const keys = Object.keys(markerRegistry);
    if (keys.length === 0) return;

    const group = L.featureGroup(keys.map((k) => markerRegistry[k]));
    mapInstance.fitBounds(group.getBounds(), {
      padding: [60, 60],
      maxZoom: 14,
    });
  }

  /* ════════════════════════════════════════════════
     PUBLIC: panToMarker — Pindahkan peta ke marker
     @param {string} id
  ════════════════════════════════════════════════ */
  function panToMarker(id) {
    const marker = markerRegistry[id];
    if (!marker) return;
    mapInstance.panTo(marker.getLatLng(), { animate: true, duration: 0.5 });
    marker.openPopup();
  }

  /* ════════════════════════════════════════════════
     PUBLIC: resetView — Kembali ke posisi awal
  ════════════════════════════════════════════════ */
  function resetView() {
    mapInstance.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true });
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _initFabControls
  ════════════════════════════════════════════════ */
  function _initFabControls() {
    const centerBtn = document.getElementById("centerMapBtn");
    const fitBoundsBtn = document.getElementById("fitBoundsBtn");

    if (centerBtn) {
      centerBtn.addEventListener("click", resetView);
    }

    if (fitBoundsBtn) {
      fitBoundsBtn.addEventListener("click", fitBoundsToMarkers);
    }
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _buildMarkerHTML — HTML custom marker
  ════════════════════════════════════════════════ */
  function _buildMarkerHTML(index, isStart) {
    const startClass = isStart ? "wf-marker--start" : "";
    return `
      <div class="wf-marker ${startClass}">
        <div class="wf-marker__pin">
          <span class="wf-marker__pin-inner">${index}</span>
        </div>
        <div class="wf-marker__shadow"></div>
      </div>
    `;
  }

  /* ════════════════════════════════════════════════
     PRIVATE: _buildPopupHTML — Konten popup marker
  ════════════════════════════════════════════════ */
  function _buildPopupHTML(label, lat, lng) {
    return `
      <div style="
        font-family: 'DM Sans', sans-serif;
        padding: 4px 2px;
        min-width: 160px;
      ">
        <div style="
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 13px;
          color: #0e0e0d;
          margin-bottom: 4px;
        ">${label}</div>
        <div style="
          font-size: 11px;
          color: #9e9e98;
          font-style: italic;
        ">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
      </div>
    `;
  }

  /* ── Public API ──────────────────────────────── */
  return {
    init,
    addMarker,
    removeMarker,
    removeAllMarkers,
    refreshMarkerIcons,
    drawRoute,
    clearRoute,
    fitBoundsToMarkers,
    panToMarker,
    resetView,
  };
})();
