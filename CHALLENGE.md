# NASA Space Apps Challenge: Mapping Mars for Human Exploration (Marswalk)

Dokumen ini berisi terjemahan lengkap dan ringkasan panduan resmi tantangan NASA untuk pembuatan peta permukaan Mars berlapis dan terintegrasi bagi misi penjelajahan manusia (*Marswalk*).

---

## 1. Ringkasan Tantangan (Challenge Statement)

NASA telah menjelajahi Mars secara robotik selama beberapa dekade—mempelajari lingkungannya yang ekstrem, memetakan permukaannya, dan mengumpulkan berbagai jenis data. Jauh dari rumah, astronaut pertama yang mendarat di Mars akan membutuhkan peta terbaik yang memungkinkan, lengkap dengan detail rute dan tujuan mereka, pembaruan kondisi lingkungan terkini, serta data yang dibutuhkan untuk menyelesaikan misi secara cepat dan aman.

**Tantangan Utama:**
Membuat **tampilan berlapis dan terintegrasi dari suatu lokasi atau rute di permukaan Mars** yang menggabungkan data dari berbagai misi sains NASA, serta dapat membantu penjelajah manusia merencanakan dan melaksanakan *Marswalk* (penjelajahan permukaan Mars) yang sukses sambil melakukan penelitian ilmiah baru yang menarik di sepanjang perjalanan.

---

## 2. Latar Belakang (Background)

- **Keunggulan Penjelajah Manusia:** Penjelajah manusia mampu melakukan penelitian ilmiah dan aktivitas yang tidak dapat dilakukan oleh sistem robotik. Keterampilan berpikir kritis astronaut memungkinkan analisis keterkaitan, pemecahan masalah cepat, serta penafsiran kontekstual terhadap observasi dan pengukuran sains secara *real-time*.
- **Visi Antarplanet:** Setelah misi Bulan (Artemis), langkah berikutnya adalah mengirim manusia ke Mars. Menjadi spesies antarplanet memerlukan kombinasi sains, rekayasa teknik, dan kerja keras tingkat tinggi.
- **Kesenjangan Alat Saat Ini:** Data misi Mars saat ini (seperti JPL Mars Trek dan USGS Planetary Geologic Mapping) sangat kaya, tetapi dirancang untuk sudut pandang global atau regional. Belum ada alat terintegrasi yang menggabungkan layer multi-misi pada skala **hiperlokal (*hyperlocalized*)** yang dibutuhkan astronaut saat melakukan *spacewalk* / penjelajahan permukaan.

---

## 3. Sasaran & Tujuan (Objectives)

Tujuan utamanya adalah membangun **peta, alat bantu, atau antarmuka (interface)** yang dapat digunakan oleh astronaut Mars selama misi eksplorasi permukaan:

1. **Menentukan Sasaran Ilmiah & Lokasi:**
   - Pilih target sains yang jelas (misalnya: formasi *boxwork*, endapan delta paleolake, mineral lempung/karbonat penanda air purba).
   - Pilih lokasi dengan data melimpah dari rover/lander terdahulu (seperti *Jezero Crater* atau *Gale Crater / Mount Sharp*), atau pilih wilayah baru yang menantang.
2. **Kombinasi Minimal 3 Jenis Data Sains (Multi-Layer):**
   - Lapisi atau integrasikan data yang berbeda, misalnya:
     - **Optik / Citra:** MRO CTX, HiRISE, Viking MDIM.
     - **Topografi / Elevasi:** MOLA DEM, HiRISE DTM.
     - **Termal & Karakter Fisik:** Mars Odyssey THEMIS (deteksi batuan padat vs debu halus).
     - **Spektral & Mineralogi:** MRO CRISM (mineral terhidrasi, sulfat, lempung).
     - **Atmosfer & Cuaca Antariksa:** Cuaca permukaan (MEDA / REMS), debu (*dust tau*), radiasi.
3. **Keselamatan Astronaut & Mobilitas:**
   - Prioritas utama NASA adalah **keselamatan kru**.
   - Astronaut bergerak dengan pakaian luar angkasa bertekanan (*spacesuit*) sambil membawa instrumen sampel. Mobilitas terbatas ini memerlukan rute aman (*terrain-aware pathfinding*) yang menghindari tebing curam (>15°–20°), jurang kawah, dan jebakan pasir lunak (*dust trap*).

---

## 4. Pertimbangan Desain & Fitur Potensial (Potential Considerations)

- **Format Tampilan:**
  - Tampilan konsol perencanaan di habitat / modul pesawat (*Mission Control HUD*).
  - Aplikasi tablet portabel yang dibawa astronaut di lapangan.
  - Tampilan *Heads-Up Display* (HUD) di visor helm pakaian luar angkasa.
- **Karakteristik Produk:**
  - Dapat berupa produk digital interaktif, sistem dinamis multi-lokasi, atau cuplikan analitis terstruktur.
- **Perspektif Permukaan (*Point-of-View*):**
  - Mengaitkan citra kamera rover/lander asli di titik target agar astronaut memahami kondisi visual nyata setibanya di lokasi tujuan.
- **Logistik & Kerjasama Tim:**
  - Mempertimbangkan penggunaan rover berawak/tanpa awak untuk pergerakan kru, serta sistem kerja berpasangan (*buddy system*).

---

## 5. Hubungan dengan Proyek Workspace Ini

| Komponen Tantangan NASA | Implementasi di Workspace (`d:\NASA\`) |
| :--- | :--- |
| **Spesifikasi Teknis & Data** | [TECHSTACK.md](./TECHSTACK.md) |
| **Urutan & Alur Pengerjaan** | [WORKFLOW.md](./WORKFLOW.md) |
| **Aplikasi Peta Interaktif** | `frontend/` (Next.js 16 + OpenLayers Mars CRS `IAU_2015:49900` + EVA A* Route Planner) |

