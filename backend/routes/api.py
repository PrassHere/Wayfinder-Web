"""
============================================================
FILE: routes/api.py
PERAN: Mendefinisikan semua endpoint (URL) yang bisa diakses
       oleh frontend melalui HTTP request
============================================================

ENDPOINT = "alamat" di server yang bisa dipanggil.
Seperti halaman web, tapi didesain untuk diterima oleh kode
(bukan manusia), dan selalu mengembalikan data dalam format JSON.

DAFTAR ENDPOINT DI FILE INI:
    GET  /api/health   → Cek apakah server berjalan
    POST /api/optimize → Jalankan TSP dan kembalikan rute terbaik

APA ITU BLUEPRINT?
    Blueprint = cara Flask mengelompokkan kumpulan endpoint.
    Ibarat "modul" atau "folder" untuk route/URL.
    Keuntungan:
    → Memisahkan kode routing dari app utama (app.py)
    → Bisa memberikan prefix URL (/api/) ke semua endpoint sekaligus
    → Memudahkan pengujian (testing) secara terpisah

APA ITU JSON?
    JSON (JavaScript Object Notation) = format data yang ringan
    dan mudah dibaca oleh manusia dan mesin.
    Contoh JSON:
        { "status": "success", "total_distance": 42.5 }
    Frontend JavaScript bisa langsung membaca format ini.

FORMAT HTTP STATUS CODE yang digunakan:
    200 → OK (request berhasil)
    400 → Bad Request (data yang dikirim tidak valid)
    415 → Unsupported Media Type (bukan JSON)
    422 → Unprocessable Entity (data valid tapi tidak bisa diproses)
    500 → Internal Server Error (error di dalam server)

FILE INI DIPANGGIL OLEH: app.py (via register_blueprint)
FILE INI MEMANGGIL: tsp.py (solve_tsp_brute_force)
"""

# ── Import yang dibutuhkan ────────────────────────────────────

# Blueprint  = alat untuk mengelompokkan routes di Flask
# request    = objek berisi data dari request HTTP masuk
# jsonify    = mengubah dict Python → response JSON
from flask import Blueprint, request, jsonify

# Import fungsi TSP dan konstanta dari tsp.py
from tsp import solve_tsp_brute_force, get_route_summary, MAX_POINTS_BRUTE_FORCE


# ── Buat Blueprint dengan prefix URL '/api' ───────────────────
# Semua route yang didaftarkan ke api_bp akan otomatis punya prefix /api
# Contoh: @api_bp.route('/health') → URL jadi /api/health
api_bp = Blueprint('api', __name__, url_prefix='/api')


# ============================================================
# ENDPOINT #1: GET /api/health
# ============================================================
@api_bp.route('/health', methods=['GET'])
def health_check():
    """
    Endpoint untuk mengecek apakah server berjalan dengan normal.

    Dekorator @api_bp.route mendaftarkan fungsi ini sebagai handler
    untuk URL /api/health dengan method GET.

    KAPAN DIGUNAKAN?
    → Frontend bisa call ini pertama kali untuk cek koneksi ke backend
    → Testing: buka http://localhost:5000/api/health di browser
    → Monitoring: tools seperti Uptime Robot bisa pantau endpoint ini

    HTTP METHOD GET:
    → Digunakan untuk MEMBACA data (tidak mengubah apapun)
    → Bisa langsung dibuka di browser
    → Tidak memiliki request body

    Response yang dikembalikan (HTTP 200):
        {
            "status":  "ok",
            "message": "WayFinder API is running"
        }
    """
    # jsonify() mengubah dict Python → JSON response dengan header yang benar
    # , 200 = HTTP status code (OK)
    return jsonify({
        "status":  "ok",
        "message": "WayFinder API is running",
    }), 200


# ============================================================
# ENDPOINT #2: POST /api/optimize ← ENDPOINT UTAMA
# ============================================================
@api_bp.route('/optimize', methods=['POST'])
def optimize_route():
    """
    Endpoint utama: menerima koordinat dari frontend,
    menjalankan TSP Brute Force, dan mengembalikan rute optimal.

    HTTP METHOD POST:
    → Digunakan untuk MENGIRIM DATA ke server
    → Data dikirim dalam request body (bukan di URL)
    → Tidak bisa dibuka langsung di browser (perlu tools seperti Postman)

    FORMAT REQUEST YANG DIHARAPKAN:
        POST /api/optimize
        Content-Type: application/json      ← header wajib
        Body:
        {
            "points": [
                [-7.7928, 110.3653],        ← [latitude, longitude]
                [-7.7828, 110.3671],
                [-7.8053, 110.3642]
            ]
        }

    PROSES VALIDASI (7 TAHAP):
        [1] Cek Content-Type: application/json
        [2] Cek key 'points' ada
        [3] Cek 'points' berupa list
        [4] Cek minimal 2 titik
        [5] Cek maksimal 10 titik
        [6] Cek setiap titik valid [lat, lng]
        [7] Jalankan TSP Brute Force

    FORMAT RESPONSE SUKSES (HTTP 200):
        {
            "status"            : "success",
            "best_route"        : [[-7.7828, 110.3671], ...],
            "total_distance"    : 8.42,
            "total_permutations": 2
        }

    FORMAT RESPONSE ERROR (HTTP 4xx/5xx):
        {
            "status" : "error",
            "message": "Pesan error yang jelas"
        }
    """

    # ── VALIDASI [1]: Pastikan request body adalah JSON ───────
    #
    # request.is_json mengecek apakah header Content-Type
    # berisi "application/json".
    # Jika frontend tidak set header ini dengan benar → error 415
    if not request.is_json:
        return _error_response(
            "Request harus menggunakan Content-Type: application/json",
            status_code=415  # 415 = Unsupported Media Type
        )

    # Parse JSON dari request body menjadi dict Python
    data = request.get_json()

    # ── VALIDASI [2]: Key 'points' harus ada ─────────────────
    # Jika request body tidak punya key 'points' → error 400
    if 'points' not in data:
        return _error_response(
            "Field 'points' tidak ditemukan dalam request body.",
            status_code=400  # 400 = Bad Request
        )

    points = data['points']

    # ── VALIDASI [3]: 'points' harus berupa list/array ────────
    # Tidak boleh berupa string, angka, atau tipe lain
    if not isinstance(points, list):
        return _error_response(
            "Field 'points' harus berupa array / list koordinat.",
            status_code=400
        )

    # ── VALIDASI [4]: Minimal 2 titik ─────────────────────────
    # Tidak bisa membuat rute dengan 0 atau 1 titik saja
    if len(points) < 2:
        return _error_response(
            f"Minimal 2 titik diperlukan. Anda mengirim {len(points)} titik.",
            status_code=422  # 422 = Unprocessable Entity (bisa dibaca tapi tidak valid)
        )

    # ── VALIDASI [5]: Maksimal sesuai batas Brute Force ───────
    # max 10 titik karena (10-1)! = 362.880 kemungkinan
    if len(points) > MAX_POINTS_BRUTE_FORCE:
        return _error_response(
            f"Maksimal {MAX_POINTS_BRUTE_FORCE} titik untuk metode Brute Force. "
            f"Anda mengirim {len(points)} titik.",
            status_code=422
        )

    # ── VALIDASI [6]: Setiap titik harus valid ────────────────
    # Loop setiap titik dan periksa:
    # a. Harus berupa list/tuple dengan tepat 2 elemen
    # b. Keduanya harus angka (int atau float)
    # c. Latitude harus antara -90 dan 90
    # d. Longitude harus antara -180 dan 180
    validated_points = []  # Akan diisi titik yang sudah tervalidasi

    for idx, point in enumerate(points):

        # Cek format: harus berupa [lat, lng] (2 elemen)
        if not isinstance(point, (list, tuple)) or len(point) != 2:
            return _error_response(
                f"Titik ke-{idx + 1} tidak valid. Format yang benar: [latitude, longitude].",
                status_code=400
            )

        lat, lng = point  # Pisahkan latitude dan longitude

        # Cek tipe data: harus angka
        if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
            return _error_response(
                f"Titik ke-{idx + 1}: latitude dan longitude harus berupa angka.",
                status_code=400
            )

        # Cek rentang latitude: bumi dari kutub selatan (-90) ke kutub utara (90)
        if not (-90 <= lat <= 90):
            return _error_response(
                f"Titik ke-{idx + 1}: latitude harus antara -90 dan 90. Nilai: {lat}",
                status_code=400
            )

        # Cek rentang longitude: bumi dari barat (-180) ke timur (180)
        if not (-180 <= lng <= 180):
            return _error_response(
                f"Titik ke-{idx + 1}: longitude harus antara -180 dan 180. Nilai: {lng}",
                status_code=400
            )

        # Simpan titik yang sudah valid (konversi ke float untuk konsistensi)
        validated_points.append([float(lat), float(lng)])

    # ── VALIDASI [7]: Jalankan TSP Brute Force ────────────────
    # Semua validasi lolos → jalankan algoritma TSP
    # Dibungkus try-except untuk menangkap error yang tidak terduga
    try:
        # Panggil fungsi TSP dari tsp.py
        result = solve_tsp_brute_force(validated_points)

        # Log ringkasan ke konsol server (berguna saat debugging)
        # Ini hanya tampil di terminal server, tidak dikirim ke frontend
        summary = get_route_summary(
            validated_points,
            result['best_order'],
            result['total_distance']
        )
        print(f"\n[WayFinder] Optimasi selesai:\n{summary}\n")

        # ── Kembalikan response sukses ────────────────────────
        # Kirim data yang dibutuhkan frontend:
        # - best_route: koordinat urutan optimal
        # - total_distance: total km
        # - total_permutations: berapa rute yang dicoba (info edukatif)
        return jsonify({
            "status"            : "success",
            "best_route"        : result['best_route'],
            "total_distance"    : result['total_distance'],
            "total_permutations": result['total_permutations'],
        }), 200  # 200 = OK

    except ValueError as e:
        # ValueError dilempar oleh tsp.py jika validasi di sana gagal
        # (seharusnya sudah ditangani di atas, tapi sebagai safety net)
        return _error_response(str(e), status_code=422)

    except Exception as e:
        # Tangkap error lain yang tidak terduga (bug, dll)
        # Tampilkan di konsol server untuk debugging
        print(f"[WayFinder] Error tidak terduga: {e}")
        return _error_response(
            "Terjadi kesalahan internal pada server.",
            status_code=500  # 500 = Internal Server Error
        )


# ============================================================
# FUNGSI HELPER: _error_response
# ============================================================
def _error_response(message: str, status_code: int = 400):
    """
    Fungsi helper untuk membuat response error dengan format yang KONSISTEN.

    KENAPA PERLU FUNGSI INI?
    → Tanpa ini, setiap return error harus menulis format yang sama berulang kali
    → Dengan ini, cukup panggil: return _error_response("pesan", 400)
    → Memastikan semua error punya format yang sama: {"status": "error", "message": "..."}
    → Frontend bisa selalu cek: if (data.status === "error") { tampilkan pesan }

    ANALOGI: Seperti "stempel" error yang selalu sama bentuknya.

    Parameter:
        message     (str): Pesan error yang jelas dan informatif
        status_code (int): Kode HTTP untuk jenis error ini

    Return:
        tuple: (Response JSON, HTTP status code)
               Flask otomatis memisahkan keduanya saat dikirim ke client
    """
    return jsonify({
        "status" : "error",
        "message": message,
    }), status_code