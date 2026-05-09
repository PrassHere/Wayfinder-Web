"""
============================================================
FILE: distance.py
PERAN: Menghitung jarak antara dua titik koordinat GPS
============================================================

File ini berisi RUMUS MATEMATIKA untuk menghitung jarak
antara dua titik di permukaan bumi.

KENAPA PERLU FILE INI?
→ TSP (Travelling Salesman Problem) membutuhkan jarak antar titik
→ Jarak GPS tidak bisa dihitung dengan rumus biasa karena BUMI BULAT
→ Kita perlu rumus Haversine yang memperhitungkan kelengkungan bumi

ANALOGI JARAK BIASA vs HAVERSINE:
┌─────────────────────────────────────────────────────────────┐
│ Jarak biasa (Euclidean): √((x2-x1)² + (y2-y1)²)           │
│ → Anggap bumi DATAR (seperti kertas di meja)                │
│ → Tidak akurat untuk jarak jauh (>100 km)                   │
│                                                             │
│ Rumus Haversine:                                            │
│ → Memperhitungkan bumi sebagai BOLA (lebih akurat)          │
│ → Cocok untuk koordinat GPS (latitude, longitude)           │
│ → Named after: "haversine" fungsi matematika (1-cos(x))/2  │
└─────────────────────────────────────────────────────────────┘

FILE INI DIPANGGIL OLEH: tsp.py
FILE INI MEMANGGIL: math (library bawaan Python)
"""

import math  # Library matematika bawaan Python (sin, cos, sqrt, dll)


# ── Konstanta ─────────────────────────────────────────────────
# Radius bumi dalam kilometer.
# Nilai rata-rata: 6371 km
# (Bumi sebenarnya elipsoid, tapi untuk aplikasi ini cukup pakai nilai rata-rata)
EARTH_RADIUS_KM = 6371.0


def haversine(coord1: tuple, coord2: tuple) -> float:
    """
    Menghitung jarak antara dua titik koordinat GPS menggunakan RUMUS HAVERSINE.

    CARA KERJA RUMUS HAVERSINE:
    ┌─────────────────────────────────────────────────────────┐
    │ 1. Konversi koordinat dari DERAJAT → RADIAN             │
    │    (fungsi trigonometri Python pakai radian)            │
    │                                                         │
    │ 2. Hitung selisih latitude dan longitude                │
    │                                                         │
    │ 3. Terapkan rumus Haversine:                            │
    │    a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlng/2) │
    │    c = 2·atan2(√a, √(1-a))                             │
    │    d = R·c   (R = radius bumi = 6371 km)               │
    └─────────────────────────────────────────────────────────┘

    Parameter:
        coord1 (tuple): Titik pertama  → (latitude, longitude)
                        Contoh: (-7.7928, 110.3653)
        coord2 (tuple): Titik kedua    → (latitude, longitude)
                        Contoh: (-7.7828, 110.3671)

    Return:
        float: Jarak dalam kilometer (dibulatkan 4 angka desimal)
               Contoh: 1.1234

    Contoh penggunaan:
        >>> haversine((-7.6298, 111.5239), (-7.6312, 111.5245))
        0.1648   ← sekitar 165 meter
    """
    # Pisahkan latitude dan longitude dari tuple
    lat1, lon1 = coord1
    lat2, lon2 = coord2

    # ── LANGKAH 1: Konversi Derajat → Radian ─────────────────
    # math.radians() mengalikan dengan (π/180)
    # Contoh: 90° × (π/180) = π/2 radian
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    lon1_rad = math.radians(lon1)
    lon2_rad = math.radians(lon2)

    # ── LANGKAH 2: Hitung Selisih ─────────────────────────────
    delta_lat = lat2_rad - lat1_rad  # Selisih latitude (arah utara-selatan)
    delta_lon = lon2_rad - lon1_rad  # Selisih longitude (arah timur-barat)

    # ── LANGKAH 3: Rumus Haversine ────────────────────────────
    #
    # Komponen 'a':
    # → sin²(Δlat/2) = kuadrat sinus dari setengah selisih latitude
    # → cos(lat1) * cos(lat2) * sin²(Δlon/2) = kompensasi longitude
    # → Nilainya antara 0 (titik identik) sampai 1 (kutub berlawanan)
    a = (
        math.sin(delta_lat / 2) ** 2                # sin²(Δlat/2)
        + math.cos(lat1_rad)                         # cos(lat1)
        * math.cos(lat2_rad)                         # × cos(lat2)
        * math.sin(delta_lon / 2) ** 2               # × sin²(Δlon/2)
    )

    # Komponen 'c':
    # → Sudut pusat bumi antara dua titik (dalam radian)
    # → atan2 lebih aman dari atan untuk nilai edge case
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    # Jarak = radius bumi × sudut pusat
    distance = EARTH_RADIUS_KM * c

    # Bulatkan ke 4 angka desimal untuk kejelasan
    return round(distance, 4)


def build_distance_matrix(points: list) -> list:
    """
    Membuat MATRIKS JARAK antara semua kombinasi titik.

    APA ITU MATRIKS JARAK?
    Bayangkan tabel dengan baris = titik asal, kolom = titik tujuan.
    Setiap sel berisi jarak antara titik baris dan titik kolom.

    Contoh untuk 3 titik (A, B, C):
    ┌─────┬──────┬──────┬──────┐
    │     │  A   │  B   │  C   │
    ├─────┼──────┼──────┼──────┤
    │  A  │  0   │ 2.3  │ 5.1  │ ← jarak A ke semua titik
    │  B  │ 2.3  │  0   │ 3.2  │ ← jarak B ke semua titik
    │  C  │ 5.1  │ 3.2  │  0   │ ← jarak C ke semua titik
    └─────┴──────┴──────┴──────┘

    KENAPA MATRIKS?
    → TSP perlu cepat mengakses jarak antara dua titik mana saja
    → Tanpa matriks: harus hitung Haversine berulang-ulang (lambat)
    → Dengan matriks: cukup akses matrix[i][j] (sangat cepat, O(1))

    Sifat matriks ini:
    → Simetris: matrix[i][j] == matrix[j][i]
      (jarak A→B sama dengan B→A)
    → Diagonal nol: matrix[i][i] == 0
      (jarak titik ke dirinya sendiri = 0)

    Parameter:
        points (list): Daftar koordinat → [[lat, lng], [lat, lng], ...]

    Return:
        list: Matriks 2D berisi jarak (km) antara setiap pasang titik
    """
    n = len(points)  # Jumlah titik

    # Buat matriks n×n diisi nol dulu
    # List comprehension: buat n baris, setiap baris berisi n angka 0.0
    matrix = [[0.0] * n for _ in range(n)]

    # Isi setiap sel matriks dengan jarak antar titik
    for i in range(n):          # Loop baris (titik asal)
        for j in range(n):      # Loop kolom (titik tujuan)
            if i != j:          # Lewati diagonal (jarak ke diri sendiri = 0)
                matrix[i][j] = haversine(points[i], points[j])
                # matrix[i][i] tetap 0 (sudah diinisialisasi di atas)

    return matrix


def total_route_distance(route: list, distance_matrix: list) -> float:
    """
    Menghitung TOTAL JARAK sebuah rute perjalanan.

    Rute adalah urutan indeks titik yang dikunjungi.
    Fungsi ini menjumlahkan jarak setiap langkah,
    termasuk kembali ke titik awal (loop tertutup).

    CONTOH:
        Titik:  A(0)  B(1)  C(2)  D(3)
        Rute:   [0, 2, 1, 3]  ← kunjungi A → C → B → D → (kembali A)
        Jarak:  dist(A,C) + dist(C,B) + dist(B,D) + dist(D,A)

    KENAPA KEMBALI KE AWAL?
    → TSP adalah masalah "tur tertutup" (closed tour)
    → Wisatawan harus kembali ke titik berangkat (hotel/rumah)
    → Ini dilakukan dengan operator modulo (%):
        (i + 1) % n → saat i = titik terakhir, hasil = 0 (indeks awal)

    Parameter:
        route          (list): Urutan indeks titik → [0, 2, 1, 3]
        distance_matrix(list): Hasil dari build_distance_matrix()

    Return:
        float: Total jarak dalam kilometer (dibulatkan 4 desimal)
    """
    total = 0.0       # Akumulator jarak (mulai dari 0)
    n     = len(route)

    for i in range(n):
        from_idx = route[i]              # Titik asal
        to_idx   = route[(i + 1) % n]   # Titik tujuan (% n = kembali ke awal)
        total   += distance_matrix[from_idx][to_idx]  # Tambahkan jarak segmen

    return round(total, 4)  # Bulatkan hasil akhir