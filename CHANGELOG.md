# Changelog

## 日本語

### 0.5.3

- `create_bid_review_packet` に `fetch_documents` / `target_uris` を追加し、PDF/HTML抽出済みの参加資格・提出書類・期限・連絡先・失格条件を社内検討メモへ自動反映。
- `draft_bid_questions` に `fetch_documents` / `target_uris` を追加し、PDF抽出で解決済みの質問を減らし、曖昧点だけを質問案に残せるようにした。
- PDF/HTML抽出処理をtool共通helperへ切り出し、`extract_bid_requirements`、`create_bid_review_packet`、`draft_bid_questions` で同じ安全な一時取得・Vertex AI経路を使うようにした。

### 0.5.2

- PDF抽出結果に `tenderSubmissionDeadline`、`openingDate`、`briefingDate`、`contactPoint` を追加し、提出期限・開札日時・説明会・連絡先を `rawNotes` ではなく構造化して返せるようにした。
- `extract_bid_requirements` のテキスト要約に提出期限、開札日時、説明会、連絡先を表示。
- PDF/HTML処理の安全メモを「一時取得・非保存」の実装に合わせて修正。
- `remote:extraction` のverbose出力で新しい構造化項目を確認できるようにした。

### 0.5.1

- Streamable HTTP transportで`KkjClient`をプロセス内共有に変更し、`search_bids`後の`extract_bid_requirements` / `get_bid_detail` がremote環境でも直近bid cacheを参照できるようにした。
- v0.5.0向けのremote extraction smoke script `remote:extraction` を追加。
- MCP server factoryのversion表示を最新化。

### 0.5.0

- `extract_bid_requirements` に `fetch_documents` と `target_uris` を追加し、公式公告ページ・添付資料を一時取得して要件抽出できるようにした。
- PDF/HTML取得基盤を追加し、サイズ上限、MIME検証、timeout、redirect上限、SSRF対策、host allowlist、メモリ内LRU cacheを実装。
- MCP sampling経由の要件抽出を追加。PDF本文は標準samplingの制約により直接埋め込まず、HTML本文のみtext化する。
- `JP_BIDS_VERTEX_AI=1` でVertex AI Gemini direct modeを有効化し、PDF bytesを`inlineData`としてGeminiへ渡す本番向け抽出経路を追加。
- 抽出結果にsource URI、final URI、SHA-256、サイズ、MIME、抽出mode、警告、raw textを含めるようにした。
- Vertex AIのin-memory daily budget guardとテスト用モックを追加。

### 0.4.0

- `search_bids_app` toolを追加。
- `rank_bids` toolを追加し、AI Bid Radar MVPとして入札候補を追うべき順にスコアリング。
- `explain_bid_fit` toolを追加し、1件ごとの追跡判断理由、リスク、確認チェックリストを返す。
- `assess_bid_qualification` toolを追加し、自社地域・カテゴリ・資格との適合性をMVP判定。
- `extract_bid_requirements` toolを追加し、PDF/Document AI連携前の安全な要件整理を返す。
- `export_bid_shortlist` toolを追加し、スコア・理由・リスク付きの社内検討用CSVを返す。
- `create_bid_calendar` toolを追加し、提出期限・開札日などをICS形式で返す。
- `create_bid_review_packet` toolを追加し、1案件の社内検討メモMarkdownを返す。
- `draft_bid_questions` toolを追加し、発注者へ確認する質問書ドラフトを返す。
- `analyze_past_awards` toolを追加し、過去公告から発注機関頻度・カテゴリ偏り・月次トレンドを集計する競合レーダーを提供。
- `due_*` 入力の説明を「入札書提出期限」に修正し、`bid_due_alert` プロンプトに日付フィルタ示唆を追加。
- `docs://agentic-cloud-roadmap` resourceを追加し、Google-managed MCP / Gemini Enterprise / Agentic Data Cloud準拠の拡張方針を公開。
- `docs://agentic-security-storage-readiness` resourceを追加し、Cloud Storage Smart Storage / Fraud Defense / Agent Platform security準拠のreadinessを公開。
- MCP Apps対応クライアント向けに入札検索結果のReactテーブルUIを追加。
- 非対応クライアント向けのテキスト要約とstructuredContent fallbackを維持。

### 0.3.4

- `jp-bids-export` CLIを追加。
- 入札候補をCSV/JSONで標準出力へ出力。
- Google Sheets / Excel向けのCSVカラムを追加。

### 0.3.3

- `jp-bids-slack-briefing` CLIを追加。
- Slack Bot tokenによる入札ブリーフィング投稿に対応。
- Slack briefingのdry-run、設定、メッセージ整形、APIエラー処理をテスト。

### 0.3.2

- Cloud Run remote endpoint `https://mcp.bid-jp.com/mcp` を追加。
- custom domain向けの `/readyz` を追加。
- README、`.well-known`、MCP Registry metadataへremote情報を反映。

### 0.3.1

- `org://{organization_name}` Resource Template を追加。
- Resource metadata/annotations と `agents.json` を追加。
- Tasks、Sampling、OAuth、Cloud Run remoteの導入条件をADR化。

### 0.3.0

- 公開パッケージ名を `jp-bids-mcp` に変更。
- MCPサーバー名、CLI、Registry metadataを JP Bids MCP に統一。
- 旧環境変数 `KOKO_CALL_RATE_LIMIT_PER_SECOND` は互換aliasとして維持。

### 0.2.0

- 検索条件に開札日・納入期限日を追加。
- `bid_key` 詳細取得を直近検索キャッシュ優先に改善。
- fixtureと契約テストを拡充し、実API検証・Registry検証をrelease gateに追加。

### 0.1.0

- 初期実装。Tools、Prompts、Resources、Resource Templates、Completion、Logging、stdio、Streamable HTTPを追加。

## English

### 0.5.3

- Added `fetch_documents` / `target_uris` to `create_bid_review_packet`, automatically injecting PDF/HTML-extracted eligibility, documents, deadlines, contact points, and disqualification rules into the internal review memo.
- Added `fetch_documents` / `target_uris` to `draft_bid_questions`, reducing questions already answered by PDF extraction and keeping ambiguous points as clarification drafts.
- Moved PDF/HTML extraction into a shared tool helper so `extract_bid_requirements`, `create_bid_review_packet`, and `draft_bid_questions` use the same safe ephemeral fetch and Vertex AI path.

### 0.5.2

- Added `tenderSubmissionDeadline`, `openingDate`, `briefingDate`, and `contactPoint` to PDF extraction results so submission/opening/briefing/contact details are returned as structured fields instead of only `rawNotes`.
- Added those fields to the `extract_bid_requirements` text summary.
- Updated safety notes to match the implemented ephemeral-fetch / no-storage policy.
- Extended `remote:extraction` verbose output to show the new structured fields.

### 0.5.1

- Changed the Streamable HTTP transport to share one process-local `KkjClient`, so `extract_bid_requirements` / `get_bid_detail` can read the recent bid cache after `search_bids` in remote deployments.
- Added the v0.5 remote extraction smoke script: `remote:extraction`.
- Updated the MCP server factory version string.

### 0.5.0

- Added `fetch_documents` and `target_uris` to `extract_bid_requirements` so official notice pages and attachments can be fetched ephemerally for requirement extraction.
- Added a PDF/HTML fetcher with size limits, MIME validation, timeout, redirect limit, SSRF protection, host allowlist, and in-memory LRU caching.
- Added MCP sampling-based requirement extraction. Because standard sampling does not directly support PDF content blocks, HTML is converted to text while PDF native understanding is handled by Vertex AI mode.
- Added opt-in Vertex AI Gemini direct mode via `JP_BIDS_VERTEX_AI=1`, passing PDF bytes as Gemini `inlineData`.
- Added extraction provenance fields: source URI, final URI, SHA-256, size, MIME, extraction mode, warnings, and raw text.
- Added an in-memory Vertex AI daily budget guard and mockable tests.

### 0.4.0

- Added the `search_bids_app` tool.
- Added the `rank_bids` tool to score bid candidates by follow-up priority as the AI Bid Radar MVP.
- Added the `explain_bid_fit` tool to explain one bid's follow-up rationale, risks, and confirmation checklist.
- Added the `assess_bid_qualification` tool to assess fit against company regions, categories, and qualifications.
- Added the `extract_bid_requirements` tool for safe requirement triage before PDF / Document AI integration.
- Added the `export_bid_shortlist` tool to return internal-review CSV with scores, reasons, and risks.
- Added the `create_bid_calendar` tool to return submission and opening dates as ICS.
- Added the `create_bid_review_packet` tool to return a Markdown internal-review memo for one bid.
- Added the `draft_bid_questions` tool to return draft clarification questions for the buyer.
- Added the `analyze_past_awards` tool as a competitor radar that aggregates past notices by buyer frequency, category bias, and monthly trends.
- Clarified the `due_*` filters as bid submission deadline and added explicit date hints to the `bid_due_alert` prompt.
- Added the `docs://agentic-cloud-roadmap` resource for Google-managed MCP / Gemini Enterprise / Agentic Data Cloud-aligned expansion.
- Added the `docs://agentic-security-storage-readiness` resource for Cloud Storage Smart Storage / Fraud Defense / Agent Platform security readiness.
- Added a React table UI for bid search results in MCP Apps-compatible clients.
- Kept the text summary and structuredContent fallback for non-UI clients.

### 0.3.4

- Added the `jp-bids-export` CLI.
- Export bid candidates as CSV/JSON to stdout.
- Added CSV columns designed for Google Sheets and Excel.

### 0.3.3

- Added the `jp-bids-slack-briefing` CLI.
- Added bid briefing posts through Slack Bot tokens.
- Tested Slack briefing dry-run, configuration, formatting, and API error handling.

### 0.3.2

- Added Cloud Run remote endpoint `https://mcp.bid-jp.com/mcp`.
- Added `/readyz` for custom-domain readiness checks.
- Reflected remote metadata in README, `.well-known`, and MCP Registry metadata.

### 0.3.1

- Added the `org://{organization_name}` Resource Template.
- Added Resource metadata/annotations and `agents.json`.
- Documented introduction criteria for Tasks, Sampling, OAuth, and Cloud Run remote metadata in an ADR.

### 0.3.0

- Renamed the public package to `jp-bids-mcp`.
- Unified the MCP server name, CLI, and Registry metadata under JP Bids MCP.
- Kept `KOKO_CALL_RATE_LIMIT_PER_SECOND` as a backward-compatible alias.

### 0.2.0

- Added opening date and delivery/end date search filters.
- Improved `bid_key` detail lookup by using the recent search cache first.
- Expanded fixtures and contract tests, and added live API and Registry validation gates.

### 0.1.0

- Initial implementation with Tools, Prompts, Resources, Resource Templates, Completion, Logging, stdio, and Streamable HTTP.

## Bahasa Indonesia

### 0.5.3

- Menambahkan `fetch_documents` / `target_uris` ke `create_bid_review_packet`, sehingga eligibility, dokumen, deadline, kontak, dan aturan diskualifikasi hasil ekstraksi PDF/HTML otomatis masuk ke memo review internal.
- Menambahkan `fetch_documents` / `target_uris` ke `draft_bid_questions`, sehingga pertanyaan yang sudah terjawab oleh ekstraksi PDF dikurangi dan hanya poin ambigu yang tetap menjadi draft klarifikasi.
- Memindahkan ekstraksi PDF/HTML ke helper tool bersama agar `extract_bid_requirements`, `create_bid_review_packet`, dan `draft_bid_questions` memakai jalur ephemeral fetch dan Vertex AI yang sama.

### 0.5.2

- Menambahkan `tenderSubmissionDeadline`, `openingDate`, `briefingDate`, dan `contactPoint` ke hasil ekstraksi PDF agar tenggat pengajuan, pembukaan, briefing, dan kontak dikembalikan sebagai field terstruktur, bukan hanya `rawNotes`.
- Menambahkan field tersebut ke ringkasan teks `extract_bid_requirements`.
- Memperbarui catatan keamanan agar sesuai dengan kebijakan pengambilan sementara dan tanpa penyimpanan.
- Memperluas output verbose `remote:extraction` untuk menampilkan field terstruktur baru.

### 0.5.1

- Mengubah Streamable HTTP transport agar memakai satu `KkjClient` bersama di dalam proses, sehingga `extract_bid_requirements` / `get_bid_detail` dapat membaca cache tender terbaru setelah `search_bids` pada deployment remote.
- Menambahkan script smoke extraction remote v0.5: `remote:extraction`.
- Memperbarui string versi di MCP server factory.

### 0.5.0

- Menambahkan `fetch_documents` dan `target_uris` ke `extract_bid_requirements` agar halaman pengumuman resmi dan lampiran dapat diambil sementara untuk ekstraksi requirement.
- Menambahkan fetcher PDF/HTML dengan batas ukuran, validasi MIME, timeout, batas redirect, perlindungan SSRF, allowlist host, dan cache LRU in-memory.
- Menambahkan ekstraksi requirement melalui MCP sampling. Karena sampling standar tidak mendukung content block PDF secara langsung, HTML dikonversi menjadi teks dan pemahaman PDF native ditangani oleh mode Vertex AI.
- Menambahkan mode Vertex AI Gemini direct yang aktif lewat `JP_BIDS_VERTEX_AI=1`, dengan PDF bytes dikirim sebagai `inlineData` Gemini.
- Menambahkan provenance ekstraksi: source URI, final URI, SHA-256, ukuran, MIME, mode ekstraksi, peringatan, dan raw text.
- Menambahkan daily budget guard in-memory untuk Vertex AI dan test yang dapat dimock.

### 0.4.0

- Menambahkan tool `search_bids_app`.
- Menambahkan tool `rank_bids` untuk memberi skor kandidat tender berdasarkan prioritas tindak lanjut sebagai MVP AI Bid Radar.
- Menambahkan tool `explain_bid_fit` untuk menjelaskan alasan tindak lanjut, risiko, dan checklist konfirmasi untuk satu tender.
- Menambahkan tool `assess_bid_qualification` untuk menilai kecocokan dengan wilayah, kategori, dan kualifikasi perusahaan.
- Menambahkan tool `extract_bid_requirements` untuk triase requirement yang aman sebelum integrasi PDF / Document AI.
- Menambahkan tool `export_bid_shortlist` untuk mengembalikan CSV review internal dengan skor, alasan, dan risiko.
- Menambahkan tool `create_bid_calendar` untuk mengembalikan tenggat pengajuan dan tanggal pembukaan dalam format ICS.
- Menambahkan tool `create_bid_review_packet` untuk mengembalikan memo review internal Markdown untuk satu tender.
- Menambahkan tool `draft_bid_questions` untuk mengembalikan draft pertanyaan klarifikasi kepada pembeli.
- Menambahkan tool `analyze_past_awards` sebagai radar pesaing yang merangkum pengumuman lampau berdasarkan frekuensi instansi, bias kategori, dan tren bulanan.
- Memperjelas filter `due_*` sebagai tenggat penyerahan tender dan menambahkan petunjuk tanggal eksplisit pada prompt `bid_due_alert`.
- Menambahkan resource `docs://agentic-cloud-roadmap` untuk ekspansi yang selaras dengan Google-managed MCP / Gemini Enterprise / Agentic Data Cloud.
- Menambahkan resource `docs://agentic-security-storage-readiness` untuk readiness Cloud Storage Smart Storage / Fraud Defense / keamanan Agent Platform.
- Menambahkan UI tabel React untuk hasil pencarian tender di klien yang kompatibel dengan MCP Apps.
- Mempertahankan ringkasan teks dan fallback structuredContent untuk klien tanpa UI.

### 0.3.4

- Menambahkan CLI `jp-bids-export`.
- Mengekspor kandidat tender sebagai CSV/JSON ke stdout.
- Menambahkan kolom CSV yang cocok untuk Google Sheets dan Excel.

### 0.3.3

- Menambahkan CLI `jp-bids-slack-briefing`.
- Menambahkan posting briefing tender melalui Slack Bot token.
- Menguji dry-run, konfigurasi, formatting, dan penanganan error API untuk Slack briefing.

### 0.3.2

- Menambahkan endpoint remote Cloud Run `https://mcp.bid-jp.com/mcp`.
- Menambahkan `/readyz` untuk pemeriksaan readiness custom domain.
- Memperbarui metadata remote di README, `.well-known`, dan MCP Registry metadata.

### 0.3.1

- Menambahkan Resource Template `org://{organization_name}`.
- Menambahkan metadata/annotations Resource dan `agents.json`.
- Mendokumentasikan kriteria pengenalan Tasks, Sampling, OAuth, dan metadata remote Cloud Run dalam ADR.

### 0.3.0

- Mengubah nama package publik menjadi `jp-bids-mcp`.
- Menyatukan nama server MCP, CLI, dan metadata Registry sebagai JP Bids MCP.
- Mempertahankan `KOKO_CALL_RATE_LIMIT_PER_SECOND` sebagai alias kompatibilitas.

### 0.2.0

- Menambahkan filter tanggal pembukaan dan tanggal akhir pengiriman.
- Meningkatkan pencarian detail `bid_key` dengan cache pencarian terbaru.
- Menambah fixture dan contract test, serta gate validasi API live dan Registry.

### 0.1.0

- Implementasi awal dengan Tools, Prompts, Resources, Resource Templates, Completion, Logging, stdio, dan Streamable HTTP.
