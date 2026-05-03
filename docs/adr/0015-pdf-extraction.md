# ADR-0015: PDF Requirement Extraction

## Status

Accepted for v0.5.0.

## 日本語

`extract_bid_requirements` は、既存の検索結果メタデータ整理に加えて、`fetch_documents: true` のときだけ公式公告ページまたは添付資料を一時取得する。

設計判断:

- PDF/HTMLはサーバーのメモリ内でのみ処理し、ディスク・Cloud Storage・DBには保存しない。
- 取得時にサイズ上限、MIME検証、timeout、redirect上限、SSRF対策、host allowlistを適用する。
- MCP samplingは標準content blockとしてPDFを直接渡せないため、HTML本文の抽出とhost-side fallbackに限定する。
- PDF本文のnative理解は `JP_BIDS_VERTEX_AI=1` のときだけVertex AI Gemini direct modeで行う。
- 抽出結果にはsource URI、final URI、SHA-256、size、MIME、mode、warningsを含める。
- PDFや公告文は未信頼データとして扱い、prompt injection対策として `<UNTRUSTED_DOCUMENT>` で囲む。

## English

`extract_bid_requirements` now fetches official notice pages or attachments ephemerally only when `fetch_documents: true` is provided.

Decisions:

- PDF/HTML documents are processed in server memory only. They are not written to disk, Cloud Storage, or a database.
- Fetching applies size limits, MIME validation, timeout, redirect limits, SSRF protection, and optional host allowlists.
- Standard MCP sampling cannot pass PDF as a native content block, so sampling is limited to HTML/text extraction and host-side fallback.
- Native PDF understanding is performed only in Vertex AI Gemini direct mode when `JP_BIDS_VERTEX_AI=1`.
- Extraction results include source URI, final URI, SHA-256, size, MIME, mode, and warnings.
- PDF and notice text are treated as untrusted data and wrapped in `<UNTRUSTED_DOCUMENT>` for prompt-injection defense.

## Bahasa Indonesia

`extract_bid_requirements` sekarang mengambil halaman pengumuman resmi atau lampiran secara sementara hanya ketika `fetch_documents: true` diberikan.

Keputusan:

- Dokumen PDF/HTML diproses hanya di memori server. Dokumen tidak ditulis ke disk, Cloud Storage, atau database.
- Pengambilan menerapkan batas ukuran, validasi MIME, timeout, batas redirect, perlindungan SSRF, dan allowlist host opsional.
- Sampling MCP standar tidak dapat mengirim PDF sebagai content block native, sehingga sampling dibatasi untuk ekstraksi HTML/teks dan fallback sisi host.
- Pemahaman PDF native dilakukan hanya dengan mode Vertex AI Gemini direct saat `JP_BIDS_VERTEX_AI=1`.
- Hasil ekstraksi mencakup source URI, final URI, SHA-256, ukuran, MIME, mode, dan peringatan.
- Teks PDF dan pengumuman diperlakukan sebagai data tidak tepercaya dan dibungkus dengan `<UNTRUSTED_DOCUMENT>` untuk pertahanan prompt injection.
