# JP Bids MCP — Panduan Bahasa Indonesia

## Gambaran Umum / Overview / 概要

JP Bids MCP adalah server MCP untuk mencari dan menganalisis pengumuman pengadaan pemerintah Jepang dari portal KKJ (Badan UKM).

JP Bids MCP is an MCP server for searching and AI-analyzing Japanese government procurement notices from the SME Agency's KKJ portal.

JP Bids MCP は、中小企業庁「官公需情報ポータルサイト」の入札情報をMCPで検索・AI分析するサーバーです。

> **Selama periode beta (sampai akhir Juni 2026), semua fitur tersedia gratis.**  
> During beta (until end of June 2026), all features are free.  
> ベータ期間（〜2026年6月末）は全機能を無料で利用できます。

## Mulai Cepat / Quick Start / クイックスタート

```text
Remote MCP: https://mcp.bid-jp.com/mcp
npm:        jp-bids-mcp
Registry:   io.github.sugukurukabe/jp-bids
```

### Claude.ai / ChatGPT / Klien MCP

```text
https://mcp.bid-jp.com/mcp
```

### Stdio Lokal

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

## Harga / Pricing / 料金

| Paket | Harga | Fitur |
|---|---|---|
| **Free** | Gratis | Pencarian, peringkat, detail |
| **Pro** | ¥990/bulan | 14 alat + UI MCP Apps + ekstraksi PDF |

Selama beta (sampai akhir Juni 2026), Pro juga gratis. Tidak perlu API key.

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

> JP Bids MCP dan J-Grants MCP adalah server independen yang dioperasikan oleh organisasi berbeda (Sugukuru Inc. dan Badan Digital Jepang). Hasil adalah informasi referensi; selalu verifikasi dengan dokumen resmi.

## Kebijakan / Policies / ポリシー

- [Kebijakan Privasi / Privacy Policy](https://mcp.bid-jp.com/privacy)
- [Ketentuan Layanan / Terms of Service](https://mcp.bid-jp.com/terms)
