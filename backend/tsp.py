"""
============================================================
FILE: tsp.py
PERAN: Implementasi algoritma TSP (Travelling Salesman Problem)
============================================================

TSP = "Masalah Pedagang Keliling"
Pertanyaan: "Apa urutan kunjungan kota yang menghasilkan
             jarak total PALING PENDEK dan kembali ke awal?"

Ini adalah masalah KLASIK dalam ilmu komputer / matematika
yang tergolong dalam kategori NP-Hard (sangat sulit diselesaikan
secara sempurna untuk n titik yang besar).

METODE YANG DIGUNAKAN: Brute Force (Mencoba Semua Kemungkinan)
─────────────────────────────────────────────────────────────
Konsep dasar Brute Force:
→ Coba SETIAP kemungkinan urutan perjalanan
→ Hitung total jarak setiap kemungkinan
→ Pilih yang paling pendek

Kompleksitas waktu: O((n-1)!) — faktorial di mana n = jumlah titik
→ 3 titik:  (3-1)! = 2    kemungkinan  → sangat cepat
→ 5 titik:  (5-1)! = 24   kemungkinan  → masih cepat
→ 8 titik:  (8-1)! = 5040 kemungkinan  → agak lambat
→ 10 titik: (10-1)! = 362880 kemungkinan → mendekati batas
→ 12 titik: (12-1)! = 39.916.800 kemungkinan → terlalu lambat!

Itulah kenapa ada batasan MAX_POINTS_BRUTE_FORCE = 10 titik.

KENAPA TITIK PERTAMA TETAP (TIDAK DIPERMUTASI)?
→ Rute A→B→C dan B→C→A dan C→A→B adalah rute yang SAMA
  hanya dimulai dari titik yang berbeda (rotasi).
→ Dengan mengunci titik pertama, kita hindari duplikasi rute.
→ Kemungkinan berkurang dari n! menjadi (n-1)!

HUBUNGAN DENGAN FILE LAIN:
    tsp.py
      ├── memanggil → distance.py (build_distance_matrix, total_route_distance)
      └── dipanggil oleh → routes/api.py (solve_tsp_brute_force)
"""

# itertools.permutations = generator semua kemungkinan urutan
# Contoh: permutations([1,2,3]) → (1,2,3), (1,3,2), (2,1,3), (2,3,1), (3,1,2), (3,2,1)
from itertools import permutations

# Import fungsi dari distance.py (file di folder yang sama)
from distance import build_distance_matrix, total_route_distance


# ── Konstanta ─────────────────────────────────────────────────
# Batas maksimum titik yang aman untuk algoritma Brute Force.
# Di atas ini, server akan terlalu lama merespons.
MAX_POINTS_BRUTE_FORCE = 10


def solve_tsp_brute_force(points: list) -> dict:
    """
    Menyelesaikan TSP dengan metode BRUTE FORCE.

    LANGKAH-LANGKAH ALGORITMA:
    ┌─────────────────────────────────────────────────────────────┐
    │ 1. Validasi input (minimal 2, maksimal 10 titik)            │
    │                                                             │
    │ 2. Bangun matriks jarak antar semua titik                   │
    │    (menggunakan build_distance_matrix dari distance.py)     │
    │                                                             │
    │ 3. Ambil titik pertama sebagai START (tidak dipermutasi)    │
    │    Permutasikan semua titik LAINNYA                         │
    │                                                             │
    │ 4. Untuk setiap permutasi urutan:                           │
    │    a. Gabungkan: [start] + permutasi                        │
    │    b. Hitung total jarak rute ini (termasuk balik ke awal)  │
    │    c. Jika lebih pendek dari terbaik sebelumnya → simpan   │
    │                                                             │
    │ 5. Susun koordinat sesuai urutan indeks terbaik             │
    │    dan kembalikan hasilnya                                  │
    └─────────────────────────────────────────────────────────────┘

    CONTOH VISUALISASI (4 titik: 0, 1, 2, 3):

        Start = 0 (tetap)
        Permutasi sisa [1, 2, 3]:
            Rute [0, 1, 2, 3] → hitung jarak → 45.2 km
            Rute [0, 1, 3, 2] → hitung jarak → 38.7 km ← Terbaik!
            Rute [0, 2, 1, 3] → hitung jarak → 41.5 km
            Rute [0, 2, 3, 1] → hitung jarak → 38.7 km (sama = arah balik)
            Rute [0, 3, 1, 2] → hitung jarak → 41.5 km
            Rute [0, 3, 2, 1] → hitung jarak → 45.2 km

        Hasil: [0, 1, 3, 2] dengan total 38.7 km

    Parameter:
        points (list): Daftar koordinat → [[lat, lng], [lat, lng], ...]
                       Minimal 2, Maksimal MAX_POINTS_BRUTE_FORCE (10)

    Return:
        dict: {
            "best_route"        : [[lat, lng], ...],  ← koordinat urutan terbaik
            "best_order"        : [int, ...],          ← urutan indeks terbaik
            "total_distance"    : float,               ← total km (loop tertutup)
            "total_permutations": int                  ← berapa rute yang dicoba
        }

    Raises:
        ValueError: Jika jumlah titik kurang dari 2 atau lebih dari 10
    """
    n = len(points)  # Jumlah titik yang dikirim

    # ── VALIDASI: Minimal 2 titik ─────────────────────────────
    # Tidak bisa membuat rute dengan 0 atau 1 titik
    if n < 2:
        raise ValueError("Minimal 2 titik diperlukan untuk menghitung rute.")

    # ── VALIDASI: Maksimal 10 titik ───────────────────────────
    # Di atas 10 titik, Brute Force terlalu lambat untuk respons real-time
    # (10-1)! = 362.880 kemungkinan, masih bisa dihitung dalam hitungan detik
    if n > MAX_POINTS_BRUTE_FORCE:
        raise ValueError(
            f"Brute Force hanya mendukung maksimal {MAX_POINTS_BRUTE_FORCE} titik. "
            f"Anda memasukkan {n} titik."
        )

    # ── KASUS KHUSUS: Hanya 2 titik ──────────────────────────
    # Dengan 2 titik, hanya ada 1 rute yang mungkin: 0 → 1 → 0
    # Tidak perlu permutasi sama sekali
    if n == 2:
        matrix = build_distance_matrix(points)
        dist   = total_route_distance([0, 1], matrix)
        return {
            "best_route"        : points,  # Urutan sudah optimal (hanya 1 kemungkinan)
            "best_order"        : [0, 1],
            "total_distance"    : dist,
            "total_permutations": 1,       # Hanya 1 kemungkinan yang diperiksa
        }

    # ── LANGKAH 1: Bangun Matriks Jarak ──────────────────────
    # Matriks ini berisi jarak antara setiap pasang titik.
    # Dibangun sekali di sini, lalu dipakai berulang kali dalam loop.
    # (Lebih efisien daripada hitung ulang Haversine di setiap iterasi)
    distance_matrix = build_distance_matrix(points)

    # ── LANGKAH 2: Siapkan Variabel Brute Force ───────────────
    start_index   = 0                  # Indeks titik awal (selalu 0)
    other_indices = list(range(1, n))  # Indeks titik lain: [1, 2, 3, ..., n-1]

    best_distance = float('inf')  # Jarak terbaik → mulai dari tak terhingga (∞)
                                  # float('inf') = bilangan yang selalu kalah
                                  # dibanding kondisi pertama yang diperiksa

    best_order = []   # Urutan indeks untuk rute terpendek
    count      = 0    # Hitung berapa rute yang sudah dicoba

    # ── LANGKAH 3: Coba Semua Permutasi ──────────────────────
    # permutations([1, 2, 3]) menghasilkan:
    # (1,2,3) → (1,3,2) → (2,1,3) → (2,3,1) → (3,1,2) → (3,2,1)
    for perm in permutations(other_indices):
        count += 1  # Hitung setiap rute yang dicoba

        # Gabungkan titik awal + urutan permutasi saat ini
        # Contoh: start=0, perm=(2,1,3) → current_route=[0,2,1,3]
        current_route = [start_index] + list(perm)

        # Hitung total jarak rute ini (termasuk balik ke titik awal)
        current_distance = total_route_distance(current_route, distance_matrix)

        # Jika rute ini lebih pendek dari yang terbaik sejauh ini → update
        if current_distance < best_distance:
            best_distance = current_distance
            best_order    = current_route

    # ── LANGKAH 4: Susun Koordinat Sesuai Urutan Terbaik ─────
    # best_order berisi: [0, 2, 1, 3]  ← urutan indeks
    # Kita perlu ubah ke: [points[0], points[2], points[1], points[3]]
    best_route_coords = [points[i] for i in best_order]

    # Kembalikan semua informasi yang dibutuhkan
    return {
        "best_route"        : best_route_coords,         # Koordinat urutan optimal
        "best_order"        : best_order,                 # Indeks urutan optimal
        "total_distance"    : round(best_distance, 4),   # Total km (4 desimal)
        "total_permutations": count,                      # Berapa rute yang dicoba
    }


def get_route_summary(points: list, best_order: list, total_distance: float) -> str:
    """
    Membuat teks ringkasan rute optimal untuk ditampilkan di konsol.

    Fungsi ini TIDAK dikirim ke frontend — hanya untuk logging
    di terminal server agar developer bisa melihat hasil optimasi.

    Contoh output:
        Rute Optimal (4 titik):
          [1] Titik-1  (-7.7928, 110.3653)
          [2] Titik-3  (-7.8053, 110.3642)
          [3] Titik-2  (-7.7828, 110.3671)
          [4] Titik-4  (-7.7741, 110.5085)
          [5] Kembali ke Titik-1  (-7.7928, 110.3653)
        Total Jarak: 42.1234 km

    Parameter:
        points        (list) : Daftar koordinat asli [[lat, lng], ...]
        best_order    (list) : Urutan indeks terbaik [0, 2, 1, 3]
        total_distance(float): Total jarak dalam km

    Return:
        str: Teks ringkasan yang siap di-print
    """
    steps = []
    n     = len(best_order)

    # Buat daftar langkah perjalanan
    for i, idx in enumerate(best_order):
        lat, lng = points[idx]
        # Tampilkan nomor langkah (1-based), nomor titik (1-based), dan koordinat
        steps.append(f"  [{i + 1}] Titik-{idx + 1}  ({lat:.4f}, {lng:.4f})")

    # Tambahkan langkah "kembali ke titik awal"
    start_lat, start_lng = points[best_order[0]]
    steps.append(
        f"  [{n + 1}] Kembali ke Titik-{best_order[0] + 1}"
        f"  ({start_lat:.4f}, {start_lng:.4f})"
    )

    # Gabungkan semua langkah menjadi satu teks
    summary = (
        f"Rute Optimal ({n} titik):\n"
        + "\n".join(steps)
        + f"\nTotal Jarak: {total_distance} km"
    )

    return summary