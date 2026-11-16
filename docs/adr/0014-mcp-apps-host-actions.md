# ADR-0014: MCP Apps Host Actions

## Status

Accepted; updated for v0.6.0 AI Bid Workspace, amended in v0.8.0 (Evidence & Safety panel scope), and updated in v0.10.0 for the 7-tool `public_mvp` workspace and 3-tier export fallback.

## Decision

Provide `search_bids_app` (`ui://jp-bids/search-results.html`) as an interactive **AI Bid Workspace** that enables bid discovery, multi-item comparison, requirement checks, and shortlist export within the MCP Apps surface while remaining 100% aligned with the 7-tool `public_mvp` profile:

- **Direct Server Tool Calls (`callServerTool`) with Graceful Fallback**:
  - In-app keyword re-search (`search_bids_app`) preserving prior search filters, and 1-click onboarding via interactive example chips on the Welcome screen.
  - Batch selection comparison (`rank_bids` with 1–50 signed `bid_ref` tokens) via `選択比較 (rank)`.
  - Batch/all shortlist export (`export_bid_shortlist` in 16-column CSV or JSON format) via `選択CSV`, `選択JSON`, and `全件CSV`.
  - When `serverTools` is not advertised by the host, actions fall back cleanly to `sendMessage` or clipboard prompt copy.
- **Chat Tool Bridges (`sendMessage`)**:
  - Action Dock buttons invoke approved `public_mvp` tools only: `📄 要件抽出` (`extract_bid_requirements` with `bid_ref`) and `🔍 詳細取得` (`get_bid_detail` with `bid_ref`). Legacy local-only tool buttons (qualification, review packet, ICS, question draft) are excluded from the public workspace bundle.
- **3-Tier Resilient Export (`downloadFile` → `clipboard.writeText` → `ManualExportPanel`)**:
  - Validates 16-column (or 21-column) CSV/JSON output strictly from `structuredContent` before initiating export.
  - Falls back to `navigator.clipboard.writeText` when `downloadFile` is unsupported or declined, and renders an inline read-only `ManualExportPanel` (`CSV/JSON 手動取得欄` with 1-click Select All) when iframe sandboxes block both downloads and clipboard writes, guarded against async races via `exportSeqRef`.
- **Host Surface Actions (`openLink`, `updateModelContext`, `requestDisplayMode`)**:
  - `🔗 公式` (`openLink`) opens HTTPS URLs verified to belong to the selected bid (`officialUrl`, `externalDocumentUri`, or `attachments[].uri`).
  - `文脈同期` (`updateModelContext`) syncs the active bid and multi-select keys to the model conversation.
  - `requestDisplayMode` toggles `inline` / `fullscreen`, while `applyHostTheme` synchronizes `light` / `dark` host themes across both `search-results` and `investor-radar` (`full_local`).

## Rationale

Real-world verification across Claude and ChatGPT Developer Mode showed that host capabilities vary significantly across desktop, web, and sandboxed iframe environments (for example, `downloadFile` or `clipboard-write` restrictions). Combining `public_mvp` tool hygiene, signed `bid_ref` selection fidelity, and a 3-tier export fallback ensures users never lose selected shortlist data regardless of host restrictions. Deterministic harness verification (`scripts/apps-harness/capture.ts`) captures 9 scenarios (`01-welcome.png` through `09-export-json.png`) directly against the unmodified single-file production bundle (`connectDomains: []`, `resourceDomains: []`).

## Consequences

- The core server behavior remains independent of MCP Apps; non-UI clients receive human-readable `content` and `structuredContent` unchanged.
- `search-results.html` contains zero references to local-only (`full_local`) tools, preventing tool-not-found errors on the public endpoint.
- Host rejections are handled smoothly inside the workspace UI, never surfacing as unhandled exceptions (backed by React `ErrorBoundary` recovery).

### Evidence & Safety panel scope (amended in v0.8.0)

The panel is bounded by what a `search_bids_app` result actually carries. As implemented in `src/apps/search-results.tsx`, it shows the untrusted-data warning, the bid `key`, truncated `bid_ref` when present, `fileType` and `fileSize` when present, the KKJ attribution `dataSource`, and `accessedAt`.

Source URI, SHA-256, extraction mode, and extraction warnings are **not** shown in the panel. Those fields belong to document extraction results (`BidRequirementExtractionSchema.extractedFromDocuments`), and the SHA-256 is computed server-side in `src/api/pdf-fetcher.ts` when a document is fetched. A search result precedes any document fetch, so the values do not exist at the time the workspace renders.

## 日本語

v0.10.0 時点の `search_bids_app`（「AI Bid Workspace」）は、公開7ツール（`public_mvp`）と完全整合する構成で Priority Lane / Workbench / Action Dock（`📄 要件抽出`・`🔍 詳細取得`・`🔗 公式`）/ バッチ操作（`選択比較 (rank)`・`選択CSV`・`選択JSON`・`全件CSV`・`文脈同期`）/ Welcome 1クリック入力例チップ / Evidence & Safety panel を提供する。エクスポートは `downloadFile` → `clipboard` → `ManualExportPanel`（手動取得欄）の3段階フォールバックを備え、`scripts/apps-harness/capture.ts` で9枚の決定的スクリーンショットを検証する。

Evidence & Safety panel が表示するのは、未信頼データ警告・入札 `key`・`bid_ref` 先頭・`fileType`・`fileSize`・KKJ出典・取得日時である。sourceUri・SHA-256・抽出modeは文書抽出結果（`extract_bid_requirements`）に属し、`src/api/pdf-fetcher.ts` がサーバ側で計算する。

## Bahasa Indonesia

Pada v0.10.0, `search_bids_app` ("AI Bid Workspace") selaras penuh dengan 7 tool publik (`public_mvp`), menyediakan chip contoh interaktif di layar Welcome, Action Dock (`📄 要件抽出`, `🔍 詳細取得`, `🔗 公式`), aksi batch (`選択比較 (rank)`, `選択CSV`, `選択JSON`, `全件CSV`, `文脈同期`), serta fallback ekspor 3-tahap (`downloadFile` → `clipboard` → `ManualExportPanel`) yang diuji melalui 9 tangkapan layar deterministik (`01-welcome.png`–`09-export-json.png`). Panel Evidence & Safety menampilkan peringatan data tidak tepercaya, `key`, awalan `bid_ref`, `fileType`, `fileSize`, atribusi KKJ, dan waktu pengambilan.
