# JP Bids MCP × freee MCP — Panduan Integrasi Pengadaan & Akuntansi

> **JP Bids MCP** dan **freee MCP** adalah server independen yang dioperasikan oleh organisasi berbeda.
> JP Bids MCP dioperasikan oleh Sugukuru Inc. dan menggunakan API publik KKJ (Badan UKM Jepang).
> freee MCP disediakan oleh freee K.K. dan menggunakan API freee Akuntansi/SDM/Faktur.
> Selalu verifikasi dengan dokumen resmi dan konsultasikan dengan akuntan bersertifikat sebelum membuat keputusan keuangan.

Dua server MCP memungkinkan LLM menangani **pencarian tender** dan **akuntansi/faktur** dalam satu percakapan:

| Server | Sumber Data | Operator | Yang dijawab |
|---|---|---|---|
| [JP Bids MCP](https://github.com/sugukurukabe/koko-call-mcp) | KKJ (Badan UKM) | Sugukuru Inc. | "Tender mana yang harus kita ikuti?" |
| [freee MCP](https://www.npmjs.com/package/freee-mcp) | freee Akuntansi/SDM/Faktur | freee K.K. | "Bagaimana posisi keuangan kita?" |

---

## Pengaturan

### freee MCP (Remote)

Di Claude Desktop, tambahkan konektor kustom:

- Nama: `freee`
- URL: `https://mcp.freee.co.jp/mcp`

### JP Bids MCP (Remote)

Hubungkan ke `https://mcp.bid-jp.com/mcp` via Streamable HTTP.

---

## Alur Kerja

### Alur Kerja 1: Pemeriksaan kesiapan keuangan sebelum tender

**Tujuan**: Sebelum mengikuti tender, verifikasi kapasitas keuangan perusahaan.

```
Cari tender sistem IT di Kagoshima, dan untuk tender dengan skor tinggi,
periksa saldo piutang dan deposito perusahaan kami di freee,
lalu tentukan apakah kami memiliki kapasitas keuangan untuk mengikuti tender.
```

### Alur Kerja 2: Pencatatan transaksi otomatis setelah memenangkan tender

**Tujuan**: Setelah memenangkan kontrak, buat entri penjualan di freee.

```
Ambil detail tender "2026-KKJ-12345" dan
buat transaksi penjualan di freee berdasarkan jumlah kontrak dan nama instansi.
```

### Alur Kerja 3: Pembuatan faktur otomatis dari data tender

**Tujuan**: Buat faktur di freee dari metadata tender yang dimenangkan.

```
Berdasarkan tender "2026-KKJ-12345",
buat faktur di freee dengan nama barang = judul tender,
jumlah = nilai kontrak, jatuh tempo = 30 hari setelah pengiriman.
```

### Alur Kerja 4: Analisis biaya-manfaat tender

**Tujuan**: Lacak biaya persiapan tender vs. kontrak yang dimenangkan.

```
Kumpulkan biaya terkait tender bulan lalu dari freee
dan analisis rasio biaya-manfaat terhadap kontrak yang dimenangkan.
```

---

## Catatan

- JP Bids MCP bersifat read-only; tidak pernah menulis ke freee atau sistem lain.
- freee MCP memerlukan autentikasi OAuth. Koneksi pertama akan membuka browser untuk login.
- Data keuangan dari freee adalah data rahasia perusahaan Anda. Kelola output LLM dengan tepat.
- Integrasi ini bersifat informasional. Konsultasikan dengan akuntan bersertifikat sebelum membuat entri akuntansi.
