# Marswalk Explorer — Alur Pengerjaan (Workflow)

Panduan urutan pengerjaan bertahap dari nol hingga aplikasi siap didemokan, mengacu pada spesifikasi teknis di [TECHSTACK.md](./TECHSTACK.md).

```text
[0. Kunci Lokasi & Skenario] ──► [1. Siapkan Data & Layer] ──► [2. Setup Workspace]
                                                                       │
[5. Integrasi Route & Grafik] ◄── [4. Peta Berlapis Frontend] ◄── [3. Backend & Engine A*]
         │
         ▼
[6. Live Conditions & Simulasi] ──► [7. PostGIS/Redis (Docker) & Demo Polish]
```

---

## Ringkasan Urutan Eksekusi

| Langkah | Fokus Utama | Target Output | Estimasi Waktu |
| :--- | :--- | :--- | :--- |
| **0. Kunci Lokasi & Skenario** | Pilih 1 area misi fokus (**Jezero Crater**) dan 1 alur cerita Marswalk | Skenario *Hab Base → Delta → Sample Site → Hab* | Hari 1 (~1–2 jam) |
| **1. Siapkan Data & Layer NASA** | Kumpulkan layer WMTS Mars Trek + DEM lokal + GeoJSON Science & Hazards | Katalog WMTS + `data/jezero_science_targets.geojson` + `data/jezero_hazards.geojson` | Hari 1 (~2–3 jam) |
| **2. Setup Workspace & Environment** | Buat folder `backend/`, `frontend/`, `data/`, install dependensi Python & Node | `.venv` Python + project React/Next.js TS | Hari 1 (~1 jam) |
| **3. Backend API & Engine A\*** | Bangun `/api/layers`, WMTS proxy, `/api/routes/plan`, & `/ws/conditions` | Cost-surface A\* (`IAU_2015:49900`) & telemetry stream | Hari 2–3 |
| **4. Peta Mars Berlapis (Frontend)** | Konfigurasi CRS Mars (`EPSG:104905` / tiling `2x1`) + layer opacity blending | Render MOLA, Viking, CTX, POI Sains & Zona Bahaya | Hari 3–4 |
| **5. EVA Route Planner & Grafik** | Pilih Start/End di peta + mode rute + grafik profil elevasi & konsumsi O₂/baterai | Visualisasi rute aman & *Suit Budget HUD* | Hari 4–5 |
| **6. Current Conditions & Simulasi** | Hubungkan WebSocket cuaca Mars + simulator skenario bahaya (*Dust Storm / Flare*) | Status *Go / Caution / Abort* & rekomendasi re-route | Hari 5–6 |
| **7. PostGIS, Redis & Demo Polish** | Aktifkan Docker Desktop, jalankan `docker-compose.yml` (`SRID 49900`), uji demo | Penyimpanan rute spasial, cache permanen, & skrip demo 3 menit | Hari 6–7 |

---

## Panduan Detail Langkah demi Langkah

### Langkah 0 — Kunci Wilayah Target & Skenario Marswalk
Jangan langsung mencoba memetakan seluruh permukaan Mars secara detail sekaligus. Fokuskan pada **1 lokasi misi utama** dan **1 skenario perjalanan EVA**:
* **Rekomendasi Lokasi:** **Jezero Crater** (`18.44° N, 77.45° E`, sekitar *Octavia E. Butler Landing*) — memiliki variasi geologi lengkap (lantai kawah basaltik, delta Neretva Vallis, Belva Crater, bukit Kodiak, gumuk pasir Séítah, mineral lempung/karbonat, serta referensi cuaca MEDA).
* **Contoh Skenario Demo:** Astronaut berangkat dari *Habitat Base* menuju situs sampel mineral terhidrasi (*Hawksbill Gap Delta Front*), memutari tebing curam (>20°) dan jebakan pasir (*Séítah dust trap*), lalu menghadapi simulasi peringatan badai debu di tengah rute.

---

### Langkah 1 — Siapkan Data & Verifikasi Layer NASA
Siapkan dua sumber data utama sebelum membangun tampilan UI:
1. **Basemap & Layer WMTS NASA Mars Trek:**
   * `Mars_MGS_MOLA_ClrShade_merge_global_463m` (`256x256`, zoom `0..7`) → topografi dan *shaded relief* global.
   * `Mars_Viking_MDIM21_ClrMosaic_global_232m` (`256x256`, zoom `0..7`) → mosaik warna global Mars.
   * `CTX_beta01_uncontrolled_5m_Caltech` (`512x512`, zoom `0..11`, tile via ArcGIS OnMars) → citra konteks resolusi ~5 m/px.
2. **Data Lokal (`data/`) untuk Area Target:**
   * Subset **DEM elevasi lokal** (GeoTIFF atau grid NumPy/JSON area Jezero Crater) untuk menghitung kemiringan lereng (*slope*) dan rute.
   * `jezero_science_targets.geojson` → daftar 5–10 titik target mineralogi/geologi (karbonat, phyllosilicate/lempung, konglomerat sungai purba).
   * `jezero_hazards.geojson` → poligon zona bahaya (tebing >20°, dinding dalam kawah Belva, dan area *dust trap*).

---

### Langkah 2 — Setup Struktur Folder & Environment Lokal
Mulai pengembangan secara lokal dulu dengan **Python** dan **Node.js** agar iterasi cepat (Docker Desktop baru diperlukan di Langkah 7):
1. Siapkan 3 direktori kerja di `d:\NASA`: `backend/`, `frontend/`, dan `data/`.
2. Di `backend/`: buat virtual environment (`python -m venv .venv`), lalu install `fastapi`, `uvicorn`, `numpy`, `httpx`, `pydantic` (serta `rasterio`/`pyproj` bila memakai GeoTIFF langsung).
3. Di `frontend/`: inisialisasi proyek React/Next.js + TypeScript + Tailwind CSS + library peta (**CesiumJS** atau **OpenLayers** + `proj4`) + library grafik (**Apache ECharts** / **Recharts**).

---

### Langkah 3 — Bangun Backend API & Engine Rute EVA
Kerjakan backend terlebih dahulu dan uji setiap endpoint lewat Swagger UI (`/docs`) sebelum disambungkan ke frontend:

| Urutan | Endpoint / Modul | Tugas Spesifik |
| :--- | :--- | :--- |
| **3.1** | `GET /api/layers` | Kembalikan daftar katalog layer NASA Mars Trek lengkap dengan `tile_size` (`256` vs `512`), `min_zoom`/`max_zoom`, dan URL template. |
| **3.2** | `GET /api/tiles/{layer}/{z}/{y}/{x}` | Buat proxy cache ringan ke server tile NASA agar browser bebas error CORS dan loading berulang lebih cepat. |
| **3.3** | `POST /api/routes/plan` | Implementasikan **Cost-Surface A\*** di atas grid DEM: hitung *slope*, blokir sel >20°, beri penalti zona *dust trap*, beri bonus dekat *science target*, hitung jarak memakai radius Mars `3,396,190 m` (`IAU_2015:49900`), serta keluarkan GeoJSON rute + profil elevasi + estimasi O₂, daya baterai, & durasi. |
| **3.4** | `GET /api/science-targets` & `WS /api/conditions/live` | Kembalikan daftar POI sains dan stream kondisi lingkungan Mars terkini (suhu, angin, radiasi, *dust opacity* $\tau$, status *Go/No-Go*). |

---

### Langkah 4 — Bangun Peta Mars Berlapis di Frontend
1. **Inisialisasi Peta Mars:** Konfigurasikan globe/kanvas peta memakai radius Mars `3,396,190 m` dan skema tiling **Equirectangular 2×1 pada level 0** (`EPSG:104905`) agar tile MOLA, Viking, dan CTX menempel presisi tanpa bergeser.
2. **Layer Control & Blending:** Buat sidebar toggle layer beserta **slider transparansi (opacity)** agar pengguna bisa menumpuk citra CTX di atas warna elevasi MOLA dan overlay peta lereng/bahaya.
3. **Render POI & Hazard:** Tampilkan marker *Science Targets* dan poligon *Hazard Zones* dengan panel detail sains saat diklik.

---

### Langkah 5 — Integrasikan EVA Route Planner & Grafik Profil
1. **Interactive Waypoint Picker:** Pengguna memilih titik **Start (Habitat)** dan **Destination (Science Site)** langsung di peta, lalu memilih mode perencanaan (*Safest*, *Balanced*, atau *Max Science*).
2. **Visualisasi Rute & Grafik:** Gambar garis rute hasil `POST /api/routes/plan` di peta dan tampilkan grafik **Elevation & Slope Profile** di panel bawah.
3. **Suit Budget HUD:** Tampilkan ringkasan metrik keselamatan: jarak tempuh (m/km), estimasi durasi jalan kaki, estimasi pemakaian oksigen (%), pemakaian baterai (%), kemiringan maksimum, dan status margin aman pulang (*Point of No Return*).

---

### Langkah 6 — Tambahkan "Current Conditions" & Simulasi Skenario
1. Hubungkan WebSocket `/api/conditions/live` ke panel *Mission Control HUD* untuk memantau suhu permukaan, kecepatan angin, tekanan atmosfer, indeks radiasi, dan *dust opacity*.
2. Tambahkan **Simulator Kondisi Ekstrem** (mis. tombol *"Trigger Regional Dust Storm"* atau *"Solar Particle Event"*): saat kondisi memburuk, HUD otomatis beralih ke status **CAUTION / ABORT**, menampilkan peringatan batas jarak aman, dan menyarankan kembali ke Habitat.

---

### Langkah 7 — Upgrade ke PostGIS/Redis (Docker) & Polish Demo
1. Jalankan **Docker Desktop**, lalu nyalakan `docker-compose.yml` untuk mengaktifkan **PostgreSQL + PostGIS** (registrasi `SRID 49900` via `db/init_mars_crs.sql`) dan **Redis** (cache tile persisten).
2. Pindahkan penyimpanan rute EVA dan katalog POI ke tabel PostGIS agar mendukung query spasial (`ST_Distance`, `ST_Buffer`).
3. Siapkan alur demo 2–3 menit: *Global Mars → Zoom ke Jezero Crater → Layer Blending (MOLA + CTX + Slope) → Plan EVA Route → Analisis Grafik Elevasi & O₂ → Simulasi Badai Debu*.

---

## Checklist: Apa yang Harus Dilakukan Pertama Kali?

1. Pastikan target lokasi dikunci (**Jezero Crater**).
2. Mulai dari **Langkah 2 & 3**: lengkapi `backend/` (endpoint layer, proxy tile, dan A\* routing) terlebih dahulu dan pastikan dapat diuji di `/docs`.
3. Lanjutkan ke **Langkah 4 & 5**: tampilkan peta berlapis NASA Mars Trek di `frontend/` dan hubungkan ke API rute EVA.
