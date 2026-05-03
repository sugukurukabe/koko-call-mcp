# Changelog

## 日本語

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
