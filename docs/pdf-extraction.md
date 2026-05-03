# PDF要件抽出 / PDF Requirement Extraction / Ekstraksi Requirement PDF

## 日本語

v0.5.0では、`extract_bid_requirements` に `fetch_documents` と `target_uris` を追加した。

```json
{
  "bid_key": "KKJ-TEST-001",
  "fetch_documents": true,
  "target_uris": ["https://example.go.jp/spec.pdf"]
}
```

動作:

- `fetch_documents` が `false` または未指定の場合、従来どおり検索結果メタデータだけを整理する。
- `fetch_documents: true` の場合、最大3件の公告ページまたは添付資料を一時取得する。
- HTMLはMCP samplingで要件抽出を試みる。
- PDF本文は標準MCP samplingでは直接扱えないため、`JP_BIDS_VERTEX_AI=1` のときVertex AI Gemini direct modeで抽出する。
- PDF/HTMLは保存しない。抽出結果にはSHA-256とsource URIを含める。

必要な環境変数:

```bash
JP_BIDS_VERTEX_AI=1
GOOGLE_CLOUD_PROJECT=ssw-compass-prod-494613
GOOGLE_CLOUD_LOCATION=global
JP_BIDS_VERTEX_MODEL=gemini-3-flash-preview
JP_BIDS_VERTEX_DAILY_BUDGET_USD=5
JP_BIDS_PDF_MAX_BYTES=20971520
JP_BIDS_PDF_TIMEOUT_MS=15000
JP_BIDS_PDF_ALLOWED_HOSTS=
```

## English

v0.5.0 adds `fetch_documents` and `target_uris` to `extract_bid_requirements`.

Behavior:

- If `fetch_documents` is `false` or omitted, the tool keeps the existing metadata-only behavior.
- If `fetch_documents: true`, the server fetches up to three official pages or attachments ephemerally.
- HTML is converted to text and extracted through MCP sampling when the client supports sampling.
- Native PDF understanding requires Vertex AI Gemini direct mode via `JP_BIDS_VERTEX_AI=1` because standard MCP sampling does not support PDF content blocks directly.
- PDF/HTML files are not stored. Results include SHA-256 and source URI for provenance.

## Bahasa Indonesia

v0.5.0 menambahkan `fetch_documents` dan `target_uris` ke `extract_bid_requirements`.

Perilaku:

- Jika `fetch_documents` bernilai `false` atau tidak diberikan, tool tetap memakai perilaku lama berbasis metadata saja.
- Jika `fetch_documents: true`, server mengambil maksimal tiga halaman resmi atau lampiran secara sementara.
- HTML dikonversi menjadi teks dan diekstraksi melalui MCP sampling jika klien mendukung sampling.
- Pemahaman PDF native memerlukan mode Vertex AI Gemini direct melalui `JP_BIDS_VERTEX_AI=1`, karena sampling MCP standar tidak mendukung content block PDF secara langsung.
- File PDF/HTML tidak disimpan. Hasil menyertakan SHA-256 dan source URI untuk provenance.
