# JP Bids MCP × J-Grants MCP — Panduan Integrasi

> **JP Bids MCP** dan **J-Grants MCP** adalah server independen yang dioperasikan oleh organisasi berbeda.
> JP Bids MCP dioperasikan oleh Sugukuru Inc. dan menggunakan API publik KKJ (Badan UKM Jepang).
> J-Grants MCP disediakan oleh Badan Digital Jepang dan menggunakan API publik J-Grants.
> Selalu verifikasi hasil dengan dokumen resmi sebelum membuat keputusan pengadaan atau subsidi.

Dua server MCP yang saling melengkapi ini memungkinkan LLM host menangani kedua sisi pendanaan sektor publik Jepang dalam satu percakapan:

| Server | Sumber Data | Operator | Yang Dijawab |
|---|---|---|---|
| [JP Bids MCP](https://github.com/sugukurukabe/koko-call-mcp) | KKJ (中小企業庁) | Sugukuru Inc. | "Tender pemerintah mana yang harus diikuti?" |
| [J-Grants MCP](https://github.com/digital-go-jp/jgrants-mcp-server) | J-Grants (デジタル庁) | Badan Digital Jepang | "Subsidi apa yang tersedia untuk mendanai pekerjaan?" |

Lisensi data berbeda: Data KKJ tunduk pada [Catatan Portal KKJ](https://www.kkj.go.jp/s/help/notes/), dan data J-Grants tunduk pada [Syarat Open API J-Grants](https://www.jgrants-portal.go.jp/open-api). Baca keduanya sebelum membangun produk hilir apa pun.

---

## Pengaturan

### Prasyarat

- Python 3.11+ (untuk J-Grants MCP yang berjalan secara lokal)
- Node.js 20+ (untuk opsi stdio JP Bids MCP)
- Klien yang kompatibel dengan MCP: Claude Desktop, Cursor, ekstensi VS Code MCP, dll.

### 1. Clone dan jalankan server J-Grants MCP

```bash
git clone https://github.com/digital-go-jp/jgrants-mcp-server.git
cd jgrants-mcp-server
pip install -e .
python -m jgrants_mcp_server.core
# Mendengarkan di http://127.0.0.1:8000/mcp (Streamable HTTP)
```

### 2. Hubungkan JP Bids MCP (remote Public MVP, atau lokal `full_local`)

JP Bids MCP di-host di `https://mcp.bid-jp.com/mcp` (`public_mvp`, 7 alat gratis melalui OAuth 2.0) dan tidak memerlukan pengaturan lokal. Gunakan `npx mcp-remote` sebagai jembatan stdio jika klien Anda tidak mendukung Streamable HTTP secara native:

```bash
npx --yes mcp-remote https://mcp.bid-jp.com/mcp
```

Untuk mengaktifkan alat pengembangan lokal tambahan (`create_bid_review_packet`, `analyze_past_awards`), jalankan `JP_BIDS_PROFILE=full_local npx jp-bids-mcp` secara lokal.

### 3. Daftarkan kedua server di klien Anda

Lihat `claude_desktop_config.json` dan `cursor.mcp.json` di direktori ini untuk file konfigurasi yang siap digunakan.

---

## Alur Kerja

### Alur Kerja 1 — Cari tender dan subsidi secara bersamaan

**Tujuan**: Temukan kontrak pengadaan sistem IT di Kagoshima dan konfirmasi apakah ada subsidi IT yang tersedia.

**Alat yang digunakan**: `search_bids` (JP Bids) + `search_subsidies` (J-Grants)

**Contoh prompt**:

```
Tolong cari tender pengadaan sistem IT di Kagoshima, dan sekaligus cari subsidi DX untuk usaha kecil.
Tampilkan daftar tender dengan skor tinggi beserta subsidi yang sedang menerima pendaftaran.
```

Alur percakapan yang diharapkan:
1. LLM memanggil `search_bids` dengan `prefecture="鹿児島県"`, `category="役務"`, `query="システム"`
2. LLM memanggil `search_subsidies` dengan `keyword="DX"`, `target_number_of_employees="21-50人"`
3. LLM menggabungkan kedua hasil dan menyajikan ringkasan peluang pendanaan gabungan

---

### Alur Kerja 2 — Gunakan subsidi untuk mendanai tender

**Tujuan**: Identifikasi subsidi yang dapat mensubsidi biaya persiapan atau pelaksanaan kontrak pemerintah.

**Alat yang digunakan**: `search_subsidies` → `rank_bids` → `extract_bid_requirements` / `export_bid_shortlist` (atau `create_bid_review_packet` saat menggunakan `JP_BIDS_PROFILE=full_local` lokal)

**Contoh prompt**:

```
Cari subsidi IT untuk mendanai proyek, lalu temukan tender pengembangan sistem AI.
Sarankan kombinasi di mana tenggat subsidi dan tender tidak bertabrakan.
```

Alur yang diharapkan:
1. `search_subsidies keyword="AI" acceptance=1` — temukan subsidi yang sedang dibuka
2. `rank_bids query="AI システム開発"` — peringkatkan tender berdasarkan profil
3. `extract_bid_requirements` / `export_bid_shortlist` (atau `create_bid_review_packet(bid_key=...)` di `full_local`) — susun tautan spesifikasi dan catatan tinjauan bersama subsidi yang cocok

---

### Alur Kerja 3 — Analisis silang tren pengumuman historis dengan subsidi (lokal `full_local`)

**Tujuan**: Gabungkan tren pengumuman pengadaan historis dan statistik subsidi di kategori layanan yang sama.

**Alat yang digunakan**: `analyze_past_awards` (JP Bids, lokal `JP_BIDS_PROFILE=full_local`) + `get_subsidy_overview` (J-Grants)

**Contoh prompt**:

```
Analisis tren pengumuman historis layanan kebersihan, dan tunjukkan kombinasinya dengan subsidi yang tersedia di kategori yang sama.
```

Alur yang diharapkan:
1. `analyze_past_awards query="清掃" category="役務"` — frekuensi pengumuman historis dan instansi pengadaan utama
2. `get_subsidy_overview keyword="清掃"` — jumlah subsidi yang tersedia berdasarkan rentang tenggat dan jumlah
3. LLM menyajikan gambaran umum lanskap pendanaan untuk kategori layanan kebersihan

---

## Referensi Alat

### Alat JP Bids MCP yang digunakan dalam alur kerja ini

| Alat | Deskripsi | Profil |
|---|---|---|
| `search_bids` | Pencarian pengumuman KKJ berdasarkan kata kunci/wilayah/kategori | `public_mvp` (publik & lokal, gratis) |
| `rank_bids` | Nilai tender berdasarkan profil perusahaan | `public_mvp` (publik & lokal, gratis) |
| `extract_bid_requirements` | Periksa tautan lampiran spesifikasi resmi | `public_mvp` (publik & lokal, gratis) |
| `export_bid_shortlist` | Ekspor daftar kandidat ke CSV atau JSON | `public_mvp` (publik & lokal, gratis) |
| `analyze_past_awards` | Analisis tren pengumuman historis | `full_local` (lokal `JP_BIDS_PROFILE=full_local`) |
| `create_bid_review_packet` | Pembuatan memo tinjauan internal | `full_local` (lokal `JP_BIDS_PROFILE=full_local`) |

### Alat J-Grants MCP yang digunakan dalam alur kerja ini

| Alat | Deskripsi |
|---|---|
| `search_subsidies` | Cari subsidi berdasarkan kata kunci, industri, wilayah |
| `get_subsidy_detail` | Detail lengkap termasuk lampiran |
| `get_subsidy_overview` | Ikhtisar statistik berdasarkan tenggat dan jumlah |

Sumber: [digital-go-jp/jgrants-mcp-server](https://github.com/digital-go-jp/jgrants-mcp-server)

---

## Catatan

- Hasil dari kedua server adalah informasi referensi. Selalu verifikasi dengan dokumen pengadaan dan hibah resmi sebelum membuat keputusan.
- J-Grants MCP berjalan secara lokal; JP Bids MCP berjalan dari jarak jauh. Kedua server tidak berbagi data atau sesi.
- Cakupan data: KKJ mencakup ~9.000 lembaga pengadaan; J-Grants mencakup subsidi nasional dan kota di portal J-Grants. Keduanya tidak menjamin cakupan lengkap semua pendanaan pemerintah.
- [Spesifikasi MCP 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — protokol yang diimplementasikan oleh kedua server.
