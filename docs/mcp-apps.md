# AI Bid Workspace (MCP Apps)

## 日本語

v0.6.0 は MCP Apps UI を「検索結果表」から「AI Bid Workspace」に刷新する。

### ペルソナ

1. 営業責任者: 朝15分で今日追う案件を決めたい。
2. 入札事務担当: 提出漏れと期限漏れをゼロにしたい。
3. 経営者: この案件は会社に合うかだけ判断したい。
4. 新人担当者: 何を見ればよいか分からない。

### 画面構成

- Priority Lane: 優先度カード。提出期限日数、PDF有無、簡易スコア、追う/要確認/見送り。
- Selected Bid Workbench: 案件詳細。期限、発注機関、公式URL、提出書類、資格。
- Action Dock: 仕事単位のボタン。読む(PDF抽出) / 判定(資格適合) / まとめる(検討メモ) / 聞く(質問書) / 公式(openLink) / CSV出力 / 文脈同期。
- Evidence & Safety Panel: sourceUri、SHA-256、mode、未信頼データ警告、出典。

### host連携

- `sendMessage` で各AI Bid Radarツールの呼び出しをchatへ送る。
- `downloadFile` でCSV/Markdown export。拒否時はclipboard fallback。
- `openLink` で公式ページ。
- `updateModelContext` で選択案件と出典を同期。
- `requestDisplayMode` でinline/fullscreen切替。

### 安全性

- 上流PDF/公告文は未信頼データとして扱う。
- UI上にEvidence & Safety panelで出典、SHA-256、抽出mode、warningsを表示。
- 入札判断前に公式書類を確認するよう警告を常時表示。

### 確認観点

- `tools/list` に `search_bids_app` が含まれること。
- `resources/list` に `ui://jp-bids/search-results.html` が含まれること。
- `resources/read` で `text/html;profile=mcp-app` が返ること。
- 各host actionが拒否されてもUIが壊れないこと。
- non-UIクライアントではtext + structuredContentだけで使えること。

## English

v0.6.0 evolves the MCP Apps UI from a "search results table" to an "AI Bid Workspace".

### Personas

1. Sales manager: decide which bids to pursue within 15 minutes each morning.
2. Bid administrator: ensure zero missed submissions and deadlines.
3. Executive: quickly judge if a bid fits the company.
4. Junior staff: understand what to look at without prior bid experience.

### Layout

- Priority Lane: bid cards with deadline countdown, PDF availability, quick score, pursue/review/skip labels.
- Selected Bid Workbench: deadline, organization, official URL, required documents, qualification status.
- Action Dock: task-oriented buttons: Read (PDF extraction) / Assess (qualification) / Summarize (review memo) / Ask (question draft) / Official (openLink) / CSV / Context Sync.
- Evidence & Safety Panel: sourceUri, SHA-256, mode, untrusted data warning, attribution.

### Host integration

- `sendMessage` sends AI Bid Radar tool invocations to chat.
- `downloadFile` for CSV/Markdown export with clipboard fallback.
- `openLink` for official procurement pages.
- `updateModelContext` to sync the selected bid and attribution.
- `requestDisplayMode` for inline/fullscreen toggle.

### Safety

- Upstream PDF and notice text are treated as untrusted data.
- Evidence & Safety panel shows source URI, SHA-256, extraction mode, and warnings.
- A persistent warning reminds users to verify official documents before bid decisions.

## Bahasa Indonesia

v0.6.0 mengubah UI MCP Apps dari "tabel hasil pencarian" menjadi "AI Bid Workspace".

### Persona

1. Manajer penjualan: memutuskan tender yang dikejar dalam 15 menit setiap pagi.
2. Admin tender: memastikan tidak ada pengajuan atau tenggat yang terlewat.
3. Eksekutif: menilai apakah tender cocok untuk perusahaan.
4. Staf junior: memahami apa yang perlu dilihat tanpa pengalaman tender sebelumnya.

### Tata letak

- Priority Lane: kartu tender dengan hitung mundur deadline, ketersediaan PDF, skor cepat, label kejar/review/lewati.
- Selected Bid Workbench: deadline, organisasi, URL resmi, dokumen wajib, status kualifikasi.
- Action Dock: tombol berbasis tugas: Baca (ekstraksi PDF) / Nilai (kualifikasi) / Rangkum (memo review) / Tanya (draft pertanyaan) / Resmi (openLink) / CSV / Sinkronisasi Konteks.
- Evidence & Safety Panel: sourceUri, SHA-256, mode, peringatan data tidak tepercaya, atribusi.

### Keamanan

- PDF dan teks pengumuman dari upstream diperlakukan sebagai data tidak tepercaya.
- Panel Evidence & Safety menampilkan source URI, SHA-256, mode ekstraksi, dan peringatan.
- Peringatan tetap mengingatkan pengguna untuk memverifikasi dokumen resmi sebelum keputusan tender.
