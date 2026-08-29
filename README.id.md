# JP Bids MCP — Panduan Bahasa Indonesia

[![Smithery](https://smithery.ai/badge/a-kabe-1qio/jp-bids-mcp)](https://smithery.ai/servers/a-kabe-1qio/jp-bids-mcp)

## Gambaran Umum / Overview / 概要

JP Bids MCP adalah server MCP untuk mencari dan menganalisis pengumuman pengadaan pemerintah Jepang dari portal KKJ (Badan UKM). Investor Radar (v0.9.0) memetakan pengumuman ke ticker dan dapat menampilkan penutupan harian publik jika kunci J-Quants diberikan. Bukan nasihat investasi.

JP Bids MCP is an MCP server for searching and AI-analyzing Japanese government procurement notices from the SME Agency's KKJ portal.

JP Bids MCP は、中小企業庁「官公需情報ポータルサイト」の入札情報をMCPで検索・AI分析するサーバーです。

> **Selama periode beta (sampai akhir September 2026), semua fitur tersedia gratis.**  
> During beta (until end of September 2026), all features are free.  
> ベータ期間（〜2026年9月末）は全機能を無料で利用できます。

## Cukup Bicara dengan AI

```text
"Cari tender IT di Prefektur Kagoshima, urutkan yang paling cocok untuk kami"
```

→ 14 hasil → Skor AI → Ringkasan 3 teratas → Daftar kalender → Semua dalam satu percakapan.

```text
"Atur persyaratan wajib dan kriteria evaluasi dari PDF spesifikasi ini"
```

→ Ambil PDF otomatis → Ekstrak persyaratan → Cek kualifikasi → Panduan item yang kurang.

```text
"Analisis tren pengadaan 3 tahun terakhir dari Kementerian Pertanian"
```

→ Ambil riwayat pemenang → Analisis anggaran, pesaing, rasio → Usulkan strategi tender.

```text
"Tampilkan pengumuman KKJ untuk Fujitsu (6702) dan penutupan di sekitar tanggal pengumuman"
```

→ Pemetaan ke ticker → riwayat sebagai fakta → jendela penutupan publik jika kunci J-Quants ada. Bukan rekomendasi beli/jual. MCP data pasar di sesi yang sama memungkinkan perbandingan dengan bar harian.

## Mulai Cepat / Quick Start / クイックスタート

```text
Remote MCP: https://mcp.bid-jp.com/mcp
npm:        jp-bids-mcp
Registry metadata name: io.github.sugukurukabe/jp-bids
```

### Claude.ai / ChatGPT / Klien MCP

```text
https://mcp.bid-jp.com/mcp
```

Endpoint jarak jauh memerlukan OAuth 2.0. Permintaan tanpa header `Authorization` menerima `401` beserta `WWW-Authenticate: Bearer resource_metadata="https://mcp.bid-jp.com/.well-known/oauth-protected-resource/mcp"`. Claude.ai, ChatGPT, dan MCP Inspector menjalankan alur otorisasi secara otomatis (Dynamic Client Registration + PKCE S256), jadi Anda hanya perlu menekan tombol setuju. `curl` biasa memerlukan token. Untuk mencoba tanpa autentikasi, gunakan stdio lokal di bawah.

The remote endpoint requires OAuth 2.0; MCP clients run the flow automatically. Use local stdio below to try without authentication.

リモートエンドポイントは OAuth 2.0 必須です。MCP クライアントは認可フローを自動処理します。認証なしで試すには下のローカル stdio を使ってください。

### Stdio Lokal (tanpa autentikasi)

```bash
npx --yes jp-bids-mcp
```

### Ekspor CSV

```bash
npx --yes jp-bids-export --prefecture 鹿児島県 --category 役務 --query システム > tenders.csv
```

## Daftar Alat / Tools / ツール一覧

| Alat | Deskripsi | Tier |
|---|---|---|
| `search_bids` | Cari berdasarkan kata kunci, wilayah, kategori | Free |
| `rank_bids` | Peringkat berdasarkan kriteria perusahaan | Free |
| `list_recent_bids` | Daftar pengumuman terbaru | Free |
| `get_bid_detail` | Detail tender | Free |
| `search_bids_app` | Cari dengan UI panel MCP Apps | Pro |
| `explain_bid_fit` | Penjelasan kesesuaian tender | Pro |
| `assess_bid_qualification` | Verifikasi kualifikasi peserta | Pro |
| `extract_bid_requirements` | Ekstraksi persyaratan PDF/HTML | Pro |
| `export_bid_shortlist` | Ekspor CSV/JSON | Pro |
| `create_bid_calendar` | Buat kalender ICS tenggat waktu | Pro |
| `create_bid_review_packet` | Buat memo tinjauan internal | Pro |
| `draft_bid_questions` | Buat draf pertanyaan klarifikasi | Pro |
| `analyze_past_awards` | Analisis riwayat pemenang tender | Pro |
| `summarize_bids_by_org` | Ringkasan per instansi | Pro |
| `save_search` | Simpan kriteria pencarian | Pro |
| `check_saved_search` | Periksa tender baru tersimpan | Pro |
| `list_saved_searches` | Daftar pencarian tersimpan | Pro |
| `map_awards_to_listed` | Petakan pengumuman ke ticker | Pro |
| `get_listed_award_history` | Riwayat pengumuman perusahaan tercatat | Pro |
| `analyze_award_price_impact` | Harga penutupan di sekitar tanggal pengumuman | Pro |
| `watch_listed_awards` | Daftar pantauan ticker | Pro |
| `search_investor_radar_app` | UI Investor Radar | Pro |

## Harga / Pricing / 料金

| Paket | Harga | Fitur |
|---|---|---|
| **Free** | Gratis | Pencarian, peringkat, detail |
| **Pro** | ¥990/bulan | 22 alat + UI MCP Apps + ekstraksi PDF + pencarian tersimpan + Investor Radar |

Selama beta (sampai akhir September 2026), Pro juga gratis. Tidak perlu API key.

## Sumber Data

API Pencarian Portal Informasi Pengadaan Pemerintah, Badan UKM Jepang. Server ini tidak menyimpan dokumen lampiran tender. Selalu verifikasi dengan dokumen pengadaan resmi sebelum mengajukan penawaran.

## Interoperabilitas / Interoperability / 相互運用

JP Bids MCP berpasangan dengan [J-Grants MCP](https://github.com/digital-go-jp/jgrants-mcp-server) (Badan Digital Jepang) untuk mencakup tender pemerintah dan subsidi dalam satu percakapan.

```
# Cari tender (JP Bids MCP) dan subsidi (J-Grants MCP) secara bersamaan
"Tolong cari tender pengadaan sistem IT di Kagoshima dan subsidi DX untuk usaha kecil secara bersamaan."
```

File konfigurasi Claude Desktop dan Cursor yang siap digunakan beserta tiga contoh alur kerja end-to-end: [examples/jgrants-integration/](examples/jgrants-integration/)  
Detail integrasi teknis: [docs/integrations/jgrants.md](docs/integrations/jgrants.md)

JP Bids MCP juga terintegrasi dengan [freee MCP](https://www.npmjs.com/package/freee-mcp) (freee K.K.) untuk otomatisasi pengadaan-ke-akuntansi — pemeriksaan kesiapan keuangan, pencatatan transaksi pasca-kontrak, dan pembuatan faktur dari data tender. Lihat [examples/freee-integration/](examples/freee-integration/).

Investor Radar dapat menampilkan penutupan harian publik di sekitar tanggal pengumuman jika kunci API J-Quants diteruskan. MCP data pasar di sesi Cursor / Claude yang sama memungkinkan perbandingan dengan bar harian. Bukan nasihat beli/jual. Lihat [docs/investor-radar.md](docs/investor-radar.md).

> JP Bids MCP, J-Grants MCP, dan freee MCP adalah server independen yang dioperasikan oleh organisasi berbeda. Hasil adalah informasi referensi; selalu verifikasi dengan dokumen resmi.

## Kebijakan / Policies / ポリシー

- [Kebijakan Privasi / Privacy Policy](https://mcp.bid-jp.com/privacy)
- [Ketentuan Layanan / Terms of Service](https://mcp.bid-jp.com/terms)
