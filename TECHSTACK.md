# Marswalk Explorer — Tech Stack & Architecture Specification

Dokumen ini berisi rancangan **Tech Stack, Integrasi Data Multi-Misi NASA, Konfigurasi CRS Mars, Desain API, Struktur Proyek, dan Roadmap Eksekusi** untuk aplikasi pemetaan permukaan Mars berlapis (*layered, integrated Mars surface mapping*) bagi perencanaan dan pelaksanaan *Marswalk* (EVA).

---

## 1. Tech Stack Utama per Layer Arsitektur

| Layer | Teknologi Utama (Full-Scale) | Alternatif Cepat (MVP / Hackathon) | Fungsi Utama | Alasan Pemilihan |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Framework** | Next.js (React + TypeScript) | Vite + React + TypeScript | Antarmuka *Mission Control* & manajemen state peta | Type-safe untuk data GeoJSON, telemetry, dan komponen modular |
| **UI & Styling** | Tailwind CSS + shadcn/ui | Tailwind CSS | Dark-mode HUD, panel kontrol layer, alert bahaya EVA | Cepat membangun tampilan taktis setara konsol misi NASA |
| **3D Planetary Globe** | CesiumJS (`resium`) | CesiumJS (tanpa backend kompleks) | Render globe Mars 3D, elevasi terrain, simulasi bayangan Matahari | Mendukung kustomisasi *Ellipsoid/Sphere* Mars non-WGS84 |
| **2D Tactical GIS** | OpenLayers + `proj4js` | MapLibre GL JS | *Layer blending* multi-misi & inspeksi vektor presisi | OpenLayers mendukung penuh proyeksi planet khusus (`IAU_2015`) |
| **Micro-Terrain 3D** | Three.js / React Three Fiber | *(Opsional)* | Inspeksi 3D lokal resolusi sub-meter (area pendaratan) | Ideal untuk mesh DEM HiRISE agar astronaut melihat kontur detail |
| **Chart & Telemetry** | Apache ECharts | Recharts | Grafik *elevation profile*, slope %, konsumsi O₂ & baterai | Performa tinggi untuk grafik profil lintasan interaktif |
| **Backend API** | Python + FastAPI | Python + FastAPI | REST API rute/layer & WebSocket kondisi lingkungan real-time | Ekosistem geospasial & sains planet terlengkap ada di Python |
| **Geospatial & CRS** | GDAL, Rasterio, PyProj | Rasterio + PyProj | Baca GeoTIFF DEM, hitung *slope/aspect*, konversi CRS Mars | Standar industri untuk pemrosesan raster & proyeksi non-Bumi |
| **EVA Routing Engine** | NumPy + SciPy + NetworkX | NumPy + algoritma A* custom | *Cost-surface pathfinding* berbasis lereng, bahaya & target sains | Menghitung rute teraman, bukan sekadar jarak terpendek |
| **Tile & Asset Server** | TiTiler + WMTS Proxy | WMTS Proxy langsung ke NASA Trek | Menyajikan *Cloud-Optimized GeoTIFF* (COG) menjadi XYZ tiles | Meringankan browser saat memuat data DEM/mineralogi berukuran besar |
| **Orbital & Solar Geometry** | SpiceyPy (NASA NAIF SPICE) | Kalkulasi sudut Matahari sederhana | Posisi Matahari, bayangan kawah, jendela sinyal satelit relay | Akurasi sains tingkat misi nyata |
| **Spatial Database** | PostgreSQL + PostGIS | SQLite / GeoJSON statis | Menyimpan rute EVA, waypoints, zona bahaya, *science POIs* | Mendukung query spasial (buffer, intersection) dengan SRID Mars |
| **Cache & Message** | Redis | In-memory cache (Python dict) | Cache tile NASA Trek & state kondisi cuaca/telemetry terbaru | Mencegah *rate-limit* dan mempercepat loading ulang peta |
| **Object Storage** | MinIO / AWS S3 / Cloudflare R2 | Folder lokal `./data` | Menyimpan file GeoTIFF/DEM subset area misi (COG) | Penyimpanan raster terstruktur & mudah diakses TiTiler |
| **Container & Deploy** | Docker Compose + Vercel + Cloud Run | Docker Compose lokal | Menyatukan GDAL, PostGIS, Redis, FastAPI, dan Frontend | Menghindari konflik instalasi GDAL/PostGIS lintas OS |

---

## 2. Integrasi Data Multi-Misi NASA

| Kategori Layer | Misi & Produk NASA | Protokol / Endpoint Terverifikasi / Sumber | Kegunaan untuk *Marswalk* & Sains |
| :--- | :--- | :--- | :--- |
| **Global Topography & Shaded Relief** | **MGS MOLA** (`Mars_MGS_MOLA_ClrShade_merge_global_463m`) | WMTS Capabilities (NASA Mars Trek): `https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/WMTSCapabilities.xml` (Zoom `0..7`, matrix `2x1` Equirectangular) | Konteks topografi global, elevasi makro, dan orientasi misi |
| **Global Color Mosaic** | **Viking Orbiter** (`Mars_Viking_MDIM21_ClrMosaic_global_232m`) | WMTS Capabilities (NASA Mars Trek): `https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/WMTSCapabilities.xml` (Zoom `0..7`) | Basemap warna global Mars untuk visualisasi awal dan perbandingan layer |
| **Regional Context Imagery** | **MRO CTX** (`CTX_beta01_uncontrolled_5m_Caltech`) | WMTS Capabilities (NASA Mars Trek): `https://trek.nasa.gov/tiles/Mars/EQ/CTX_beta01_uncontrolled_5m_Caltech/1.0.0/WMTSCapabilities.xml` (Zoom `0..11`, tile template ke `astro.arcgis.com/.../OnMars/CTX/MapServer/tile/{TileMatrix}/{TileRow}/{TileCol}`) | Identifikasi kawah kecil, punggungan (*ridge*), dan jalur akses regional |
| **Micro-Hazard & Landing Site DTM** | **MRO HiRISE** | NASA Mars Trek regional mosaics & COG / GeoTIFF lokal dari NASA PDS | Deteksi tebing curam, gugusan batu besar (*boulder fields*), dan profil elevasi detail |
| **Thermal & Surface Material** | **Mars Odyssey THEMIS** (IR Day/Night) | NASA Mars Trek WMTS / Raster GeoTIFF PDS | Membedakan batuan padat (*high thermal inertia*) vs debu lunak (*dust trap*) |
| **Mineralogy & Subsurface** | **MRO CRISM** & **SHARAD** | NASA PDS Geosciences Node / Orbital Data Explorer (ODE) & overlay COG | Menandai lokasi mineral terhidrasi (lempung, karbonat, sulfat) & indikasi es bawah permukaan |
| **Nomenclature & Landmarks** | **USGS Astrogeology** | WFS / WMS / GeoJSON | Nama resmi kawah, lembah, bukit, dan lokasi pendaratan misi terdahulu |
| **Current Conditions** | **Perseverance MEDA**, **Curiosity REMS** & Simulator | PDS Archive + WebSocket Telemetry Stream | Pemantauan suhu, tekanan, angin, radiasi UV, dan *dust opacity* (tau) saat Marswalk |

---

## 3. Konfigurasi Koordinat Mars (`IAU_2015:49900`) & Database

| Komponen | Nilai / Konfigurasi | Penjelasan Teknis |
| :--- | :--- | :--- |
| **Kode CRS Resmi (GIS/DB)** | `IAU_2015:49900` (alias `IAU:49900`) | Standar CRS Mars *Sphere / Ocentric* (menggantikan asumsi WGS84 Bumi) |
| **CRS Tile WMTS Mars Trek** | `urn:ogc:def:crs:EPSG::104905` (`TopLeftCorner: -180.0 90.0`, `256x256`) | Dipakai oleh tile `EQ` Mars Trek dengan *TileMatrixSet* `default028mm` (level 0 = `2x1` tile) |
| **Bentuk & Radius** | Bola (*Sphere*), radius `3,396,190` meter | Memastikan perhitungan jarak rute EVA, luas zona bahaya, dan *slope* akurat |
| **Konvensi Koordinat** | Planetocentric Latitude, Positive-East Longitude | Meridian utama 0° mengacu pada posisi Viking 1 Lander (`47.95137° W`) |
| **PROJ String** | `+proj=longlat +a=3396190 +b=3396190 +no_defs +type=crs` | Digunakan oleh `PyProj`, `Rasterio`, `proj4js`, dan `PostGIS` |
| **Registrasi PostGIS** | `INSERT INTO spatial_ref_sys (srid, auth_name, auth_srid, proj4text, srtext) VALUES (49900, 'IAU_2015', 49900, ...)` | Agar fungsi `ST_Distance`, `ST_Buffer`, dan `ST_Transform` mengenali SRID `49900` |
| **Proyeksi Hitung Jarak** | Proyeksi metrik lokal (*Equirectangular* / *Sinusoidal* di pusat area misi) | Dipakai backend saat menjalankan algoritma A* agar satuan grid dalam meter |

---

## 4. Desain API Backend & Engine EVA (FastAPI)

| Endpoint / Modul | Metode | Input Utama | Output & Logika |
| :--- | :--- | :--- | :--- |
| `/api/layers` | `GET` | Filter misi / area | Daftar katalog layer (MOLA, Viking, CTX, HiRISE, THEMIS, CRISM) beserta metadata & URL tile |
| `/api/tiles/trek/{layer}/{z}/{y}/{x}` | `GET` | Parameter koordinat tile WMTS | Proxy & cache Redis untuk tile NASA Mars Trek agar bebas CORS & lebih cepat |
| `/api/routes/plan` | `POST` | Titik awal (Hab), tujuan, bobot (*safety* vs *science*), batas lereng | Menjalankan *Cost-Surface A\**: penalti lereng curam (>20° *impassable*), penalti *dust trap*, bonus poin dekat target mineral; mengembalikan GeoJSON rute, profil elevasi, estimasi durasi, konsumsi O₂ & baterai |
| `/api/science-targets` | `GET` | Bounding box / radius rute | Daftar POI mineralogi/geologi terdekat beserta prioritas sains |
| `/api/conditions/live` | `WS` / `GET` | ID lokasi misi (mis. Jezero Crater) | Stream kondisi terkini: suhu, angin, *dust opacity*, status radiasi, & peringatan *Go/No-Go* |

---

## 5. Rencana Struktur Proyek (`d:\NASA`)

| Path | Peran | Isi / Modul Utama |
| :--- | :--- | :--- |
| `d:\NASA\docker-compose.yml` | Orkestrasi layanan | Container `postgis`, `redis`, `backend` (FastAPI + GDAL), dan `frontend` |
| `d:\NASA\frontend\` | Aplikasi Web (Next.js + TS) | `src/components/map/` (Cesium/OpenLayers), `src/components/telemetry/` (HUD cuaca & suit), `src/components/route/` (grafik elevasi & waypoint) |
| `d:\NASA\backend\` | API & GIS Engine (FastAPI) | `app/api/` (endpoints), `app/services/routing.py` (A* DEM), `app/services/trek_proxy.py` (WMTS cache), `app/db/` (model PostGIS SRID 49900) |
| `d:\NASA\data\` | Aset Sains Lokal | Subset DEM GeoTIFF area target, GeoJSON nomenklatur USGS, dan katalog *science targets* |

---

## 6. Roadmap Eksekusi & Kesiapan Lingkungan Lokal

| Fase | Target Fitur | Komponen Stack yang Dipakai | Status Lingkungan Lokal (`d:\NASA`) |
| :--- | :--- | :--- | :--- |
| **Tahap 1: MVP & Visualisasi** | Peta multi-layer NASA Mars Trek + toggle layer + info POI lokasi misi | Next.js + CesiumJS / OpenLayers + NASA Mars Trek WMTS | Siap (`Node v24.14.1`, `npm 11.11.0`) |
| **Tahap 2: EVA Route Planner** | Klik titik A ke B menghasilkan rute aman (*slope-aware*) + grafik elevasi + hitung O₂ | FastAPI + Rasterio + NumPy A* + ECharts | Siap (`Python 3.12.10`) |
| **Tahap 3: Telemetry & Full GIS** | Live *current conditions* (badai debu/radiasi), *science target scoring*, & simpan rute ke DB | Docker + PostGIS (`SRID 49900`) + Redis + WebSocket | CLI `Docker 29.9.2` terpasang *(daemon Docker Desktop perlu dijalankan saat memakai Compose)* |

