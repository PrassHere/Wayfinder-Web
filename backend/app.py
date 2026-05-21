"""
============================================================
FILE: app.py
PERAN: Pintu masuk utama (entry point) server backend
============================================================

File ini adalah file PERTAMA yang dijalankan untuk menghidupkan
server backend WayFinder.

Cara menjalankan:
    python app.py

Server akan berjalan di: http://localhost:5000

FLASK adalah "micro web framework" Python yang memudahkan
pembuatan server HTTP. "Micro" artinya minimalis tapi fleksibel.

ALUR KERJA FILE INI:
    1. Import Flask dan modul-modul pendukung
    2. Buat fungsi create_app() yang membangun server
    3. Daftarkan Blueprint (kumpulan endpoint API) dari routes/api.py
    4. Pasang handler untuk error 404 dan 405
    5. Jalankan server jika file dieksekusi langsung

HUBUNGAN DENGAN FILE LAIN:
    app.py
      └── mendaftarkan → routes/api.py (endpoint HTTP)
                              └── memanggil → tsp.py (algoritma TSP)
                                                └── memanggil → distance.py (rumus jarak)

LIBRARY YANG DIGUNAKAN:
    Flask      → Web framework untuk membuat server HTTP
    Flask-CORS → Mengizinkan request dari browser (cross-origin)
"""

# ── Import library yang dibutuhkan ───────────────────────────
from flask import Flask        # Framework web utama
from flask_cors import CORS    # Mengizinkan akses dari frontend (browser)
from routes.api import api_bp  # Blueprint berisi semua endpoint API


def create_app():
    """
    Factory function: fungsi yang membuat dan mengembalikan instance Flask.

    KENAPA MENGGUNAKAN FACTORY FUNCTION (bukan langsung buat app)?
    → Memudahkan testing: setiap test bisa buat instance app tersendiri
    → Memudahkan konfigurasi berbeda: development, production, testing
    → Best practice dalam pengembangan Flask profesional

    Return:
        Flask: Instance aplikasi yang sudah dikonfigurasi dan siap jalan
    """

    # Buat instance aplikasi Flask
    # __name__ = nama modul saat ini ("app")
    # Digunakan Flask untuk menentukan lokasi file statis dan template
    app = Flask(__name__)

    # ── Konfigurasi CORS (Cross-Origin Resource Sharing) ─────────
    #
    # CORS adalah mekanisme keamanan browser yang MEMBLOKIR
    # request JavaScript ke domain yang berbeda.
    #
    # Contoh masalah tanpa CORS:
    #   Frontend di: http://localhost (atau buka file langsung)
    #   Backend di:  http://localhost:5000
    #   → Browser menolak request karena "port berbeda = origin berbeda"
    #
    # Solusi: izinkan semua origin = CORS(app, origins="*")
    # Untuk production, ganti "*" dengan domain spesifik:
    #   CORS(app, origins=["https://wayfinder.app"])
    CORS(app, origins="*")

    # ── Daftarkan Blueprint API ───────────────────────────────────
    #
    # Blueprint = kumpulan endpoint yang dikelompokkan bersama.
    # Seperti "modul" untuk route Flask.
    #
    # api_bp didefinisikan di routes/api.py dengan url_prefix='/api'
    # Sehingga semua endpoint di api.py otomatis punya prefix /api:
    #   /health  →  /api/health
    #   /optimize → /api/optimize
    app.register_blueprint(api_bp)

    # ── Error Handler: 404 Not Found ─────────────────────────────
    # Dipanggil ketika URL yang diminta tidak ada di server.
    # Contoh: GET /api/nonexistent → 404
    @app.errorhandler(404)
    def not_found(e):
        from flask import jsonify
        return jsonify({
            "status":  "error",
            "message": "Endpoint tidak ditemukan. Pastikan URL dan method HTTP sudah benar.",
        }), 404  # HTTP status code 404

    # ── Error Handler: 405 Method Not Allowed ────────────────────
    # Dipanggil ketika method HTTP (GET/POST/dll) tidak sesuai.
    # Contoh: GET /api/optimize (harusnya POST) → 405
    @app.errorhandler(405)
    def method_not_allowed(e):
        from flask import jsonify
        return jsonify({
            "status":  "error",
            "message": "Method HTTP tidak diizinkan untuk endpoint ini.",
        }), 405  # HTTP status code 405

    return app  # Kembalikan instance app yang sudah dikonfigurasi


# ── Blok eksekusi utama ───────────────────────────────────────
#
# if __name__ == '__main__':
#   → Blok ini HANYA dieksekusi jika file ini dijalankan LANGSUNG
#     (bukan di-import oleh file lain)
#
# Contoh:
#   python app.py         ← __name__ == '__main__' → blok ini jalan
#   import app (di test)  ← __name__ == 'app'      → blok ini SKIP
#
# Ini adalah konvensi Python yang sangat umum digunakan.
if __name__ == '__main__':
    app = create_app()

    # Tampilkan info startup di terminal
    print("=" * 45)
    print("  WayFinder Backend")
    print("  Server berjalan di http://localhost:5000")
    print("=" * 45)
    print("  Endpoint tersedia:")
    print("    GET  /api/health   → Cek status server")
    print("    POST /api/optimize → Optimasi rute TSP")
    print("=" * 45)

    # Jalankan server Flask
    #
    # debug=True:
    #   → Auto-reload saat kode berubah (sangat membantu development!)
    #   → Tampilkan error detail di browser
    #   ⚠️ JANGAN gunakan debug=True di production!
    #
    # host='0.0.0.0':
    #   → Server bisa diakses dari perangkat lain di jaringan yang sama
    #   → (Bukan hanya dari localhost)
    #
    # port=5000:
    #   → Port yang digunakan server
    #   → Akses via: http://localhost:5000
    app.run(debug=True, host='0.0.0.0', port=5000)