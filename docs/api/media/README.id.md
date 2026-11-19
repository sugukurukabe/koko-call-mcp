# JP Bids MCP — Panduan Bahasa Indonesia (v0.10.1)

[![Smithery](https://smithery.ai/badge/a-kabe-1qio/jp-bids-mcp)](https://smithery.ai/servers/a-kabe-1qio/jp-bids-mcp)

## Gambaran Umum / Overview / 概要

**JP Bids MCP (v0.10.1)** adalah server Model Context Protocol (MCP) yang memungkinkan siapa saja mencari, membandingkan, memeriksa URL pengumuman resmi, dan mengekspor daftar tender pengadaan pemerintah Jepang (KKJ) ke CSV/JSON 16 kolom langsung melalui obrolan AI (**Claude** atau **ChatGPT**). **Tanpa instalasi, tanpa pendaftaran akun, dan 100% gratis (7 alat publik + antarmuka AI Bid Workspace).**

JP Bids MCP (`v0.10.1`) connects Claude, ChatGPT, and MCP clients to Japan's SME Agency procurement portal (KKJ) with **7 free, read-centric tools** and an interactive **AI Bid Workspace** UI.

JP Bids MCP (`v0.10.1`) は、中小企業庁「官公需情報ポータルサイト」の入札公告をAIとの会話だけで検索・比較・CSV出力できる完全無料のMCPサーバーです。

> **Sepenuhnya Gratis & Read-Only (`public_mvp`) / Free & Read-Centric**<br>
> Semua 7 alat `public_mvp` dan panel **AI Bid Workspace** tersedia gratis tanpa kartu kredit, tanpa paket berbayar, dan tanpa pemanggilan Stripe saat runtime (`src/lib/billing.ts` serta paket `stripe` hanya dipertahankan untuk profil pengembangan lokal `full_local` dan tidak didaftarkan pada `public_mvp`). Server ini tidak pernah mengirim penawaran atau menulis ke sistem eksternal.

---

## Mulai Cepat 1-Klik dalam 60 Detik (Gratis / Tanpa Instalasi)

Pengguna umum tidak perlu menginstal kode atau mengedit file konfigurasi. Cukup tambahkan URL resmi berikut ke **Claude** atau **ChatGPT**:

```text
https://mcp.bid-jp.com/mcp
```

### 1. Hubungkan ke Claude (Claude.ai / Claude Desktop) — 3 Langkah
1. Buka Claude lalu pilih **Settings / Customize → Connectors** (Konektor).
2. Klik **Add Custom Connector**, isi nama `JP Bids` dan URL `https://mcp.bid-jp.com/mcp`.
3. Klik **Allow / 許可する** pada layar persetujuan OAuth 2.0 1-klik (Dynamic Client Registration + PKCE S256 — tanpa kata sandi atau akun baru).

### 2. Hubungkan ke ChatGPT (Apps / Connectors) — 3 Langkah
1. Buka **Settings → Apps / Connectors** di ChatGPT.
2. Masukkan URL server MCP `https://mcp.bid-jp.com/mcp` dengan metode autentikasi **OAuth 2.0**.
3. Klik **Allow / 許可する** satu kali untuk mengaktifkan 7 alat riset tender beserta tampilan interaktif **AI Bid Workspace**.

### 3. Contoh Prompt Siap Pakai (Cari → Bandingkan → Cek URL Resmi → Ekspor CSV 16 Kolom)

Salin dan tempelkan langsung ke obrolan AI Anda:

```text
1. Cari & Buka Panel Visual (AI Bid Workspace):
"Tolong cari maksimal 5 pengumuman tender jasa (役務) terkait 'システム' di Tokyo dan tampilkan AI Bid Workspace."

2. Bandingkan & Urutkan Kandidat Pilihan Tanpa Tertukar:
"Dari hasil tersebut, bandingkan dan beri peringkat tender yang saya pilih dengan prioritas kata kunci 'クラウド' dan '保守' tanpa menggantinya dengan tender lain."

3. Periksa Detail & Tautan Dokumen Resmi:
"Tampilkan detail tender pertama, URL pengumuman resmi, dan daftar persyaratan yang harus diperiksa."

4. Ekspor ke CSV 16 Kolom sesuai Urutan Pilihan:
"Ekspor tender yang dipilih ke format CSV 16 kolom dengan mempertahankan urutan pilihan saya."
```

### 4. Unggah Skill Claude 1-Klik (`searching-japanese-bids.zip` — Opsional)
Agar Claude otomatis memahami nama 47 prefektur Jepang, kategori pengadaan (`物品` / `工事` / `役務`), dan token `bid_ref`:
1. Unduh **`searching-japanese-bids.zip`** dari GitHub Releases (atau kompres folder [`skills/searching-japanese-bids/`](skills/searching-japanese-bids/) menjadi ZIP).
2. Buka **Claude.ai → Settings → Features → Skills → Upload skill**, lalu pilih `searching-japanese-bids.zip`.

---

## Daftar 7 Alat Publik (Public MVP `v0.10.1`)

| Alat | Deskripsi | Profil |
|---|---|---|
| `search_bids` | Cari tender di seluruh 47 prefektur berdasarkan kata kunci, wilayah, kategori (`物品`/`工事`/`役務`), dan tanggal | Public MVP (Gratis) |
| `list_recent_bids` | Daftar pengumuman terbaru yang diterbitkan dalam 1–30 hari terakhir | Public MVP (Gratis) |
| `get_bid_detail` | Lihat detail lengkap satu tender & URL resmi menggunakan `bid_ref` bertanda tangan atau `bid_key` | Public MVP (Gratis) |
| `rank_bids` | Skor kecocokan 0–100 (`pursue`/`review`/`skip`) untuk hasil pencarian atau daftar `bid_refs` pilihan | Public MVP (Gratis) |
| `extract_bid_requirements` | Susun checklist kualifikasi, tenggat, dan URL lampiran dari metadata (ekstraksi isi PDF eksternal default OFF) | Public MVP (Gratis) |
| `export_bid_shortlist` | Ekspor kandidat pilihan (mempertahankan urutan) ke CSV 16 kolom atau JSON | Public MVP (Gratis) |
| `search_bids_app` | Panel interaktif **AI Bid Workspace** (`ui://jp-bids/search-results.html`) dengan fallback ekspor CSV/JSON 3-lapis | Public MVP (Gratis) |

## Harga / Pricing / 料金

| Paket | Harga | Fitur |
|---|---|---|
| **Public MVP (`v0.10.1`)** | **Gratis (Free)** | Seluruh 7 alat publik + UI AI Bid Workspace (tanpa langganan berbayar atau pemanggilan Stripe saat runtime) |

*(※ Tidak termasuk biaya langganan klien AI pihak ketiga atau infrastruktur cloud self-hosted).*

---

## Interoperabilitas (Kombinasi Subsidi & Akuntansi)

- **[J-Grants MCP](https://github.com/digital-go-jp/jgrants-mcp-server) (Badan Digital Jepang)**: Cari tender pengadaan pemerintah sekaligus subsidi UKM dalam satu percakapan ([`examples/jgrants-integration/`](examples/jgrants-integration/), [`docs/integrations/jgrants.md`](docs/integrations/jgrants.md)).
- **[freee MCP](https://www.npmjs.com/package/freee-mcp) (freee K.K.)**: Integrasi dari riset tender ke pencatatan transaksi dan faktur ([`examples/freee-integration/`](examples/freee-integration/)).

> JP Bids MCP, J-Grants MCP, dan freee MCP adalah server independen yang dioperasikan oleh organisasi berbeda.

---

## Pengaturan Pengembang & Lokal (Developer / Local Setup)

```text
Remote MCP:             https://mcp.bid-jp.com/mcp
Versi terbit:           0.10.1 (npm: jp-bids-mcp@0.10.1 / MCP Registry: io.github.sugukurukabe/jp-bids@0.10.1)
Nama MCP Registry:      io.github.sugukurukabe/jp-bids
```

> Endpoint jarak jauh (`https://mcp.bid-jp.com/mcp`) mewajibkan OAuth 2.0 (permintaan tanpa autentikasi mendapat `401` beserta header `WWW-Authenticate` untuk DCR + PKCE S256 otomatis). Untuk penggunaan lokal tanpa autentikasi atau lewat CLI, gunakan jalur `stdio` di bawah ini.

### 1. Stdio Lokal & Ekspor CLI via `npx` (Tanpa Autentikasi)

```bash
# Jalankan server MCP melalui stdio (default: profil public_mvp 7 alat)
npx --yes jp-bids-mcp

# Ekspor CSV langsung dari baris perintah
npx --yes jp-bids-export --prefecture 鹿児島県 --category 役務 --query システム > tenders.csv
```

Konfigurasi `claude_desktop_config.json` (paket npm standar):

```json
{
  "mcpServers": {
    "jp-bids": {
      "command": "npx",
      "args": ["-y", "jp-bids-mcp"],
      "env": {
        "JP_BIDS_PROFILE": "public_mvp"
      }
    }
  }
}
```

### 2. Build dari Kode Sumber & Profil Pengembang `full_local`

```bash
git clone https://github.com/sugukurukabe/koko-call-mcp.git
cd koko-call-mcp
npm install
npm run check
```

- **Runtime Lokal Standar (`node dist/server.js`)**: Menerapkan `TokenBucketRateLimiter` (`<= 1 req/dtk`), tanpa penyimpanan PDF lampiran, dan log khusus `stderr`.
- **Profil Pengembang (`JP_BIDS_PROFILE=full_local`)**: Membuka total 22 alat referensi lokal (termasuk ekspor kalender ICS, paket tinjauan internal, draf pertanyaan, pencarian tersimpan, dan Investor Radar — lihat [`docs/investor-radar.md`](docs/investor-radar.md)).

### 3. Demo Mock Offline (M1–M3-B) & Pengujian Penerimaan Gate 1

Untuk mereproduksi panel UI di Claude Desktop atau menjalankan seluruh 35 sub-kondisi Gate 1 secara offline **tanpa koneksi jaringan ke API KKJ** (catatan verifikasi produksi Claude & ChatGPT tersedia di [`docs/VERIFICATION_STATUS.md`](docs/VERIFICATION_STATUS.md)):

```json
{
  "mcpServers": {
    "jp-bids-mock": {
      "command": "node",
      "args": ["/path/to/koko-call-mcp/examples/mock-stdio-server.mjs"]
    }
  }
}
```

```bash
# Jalankan Gate 1 Acceptance Runner di bawah penjaga jaringan loopback (35/35 kondisi, 0 panggilan eksternal)
node --import ./tests/acceptance/net-guard.mjs tests/acceptance/gate1-runner.mjs
```

### 4. Spesifikasi Metadata & Registri (`v0.10.1`)

1. **Manifes MCP Registry Resmi (`server.json`)**: Mematuhi `$schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json"` (`io.github.sugukurukabe/jp-bids`).
2. **Endpoint Server Card (`public/.well-known/mcp/server-card.json`)**: Menyediakan introspeksi skema lengkap untuk 7 alat publik serta binding `_meta.ui` MCP Apps.

---

## Sumber Data & Kebijakan

- **Sumber Data**: API Pencarian Portal Informasi Pengadaan Pemerintah, Badan UKM Jepang (`中小企業庁 官公需情報ポータルサイト`).
- **Penyedia**: Sugukuru Inc. (bukan produk resmi instansi pemerintah). Server ini tidak menyimpan dokumen lampiran asli; selalu verifikasi dengan dokumen resmi dari instansi terkait sebelum mengikuti tender.
- [Kebijakan Privasi / Privacy Policy](https://mcp.bid-jp.com/privacy) · [Ketentuan Layanan / Terms of Service](https://mcp.bid-jp.com/terms)
