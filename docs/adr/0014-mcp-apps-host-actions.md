# ADR-0014: MCP Apps Host Actions

## Status

Accepted; updated for v0.6.0 AI Bid Workspace. Amended in v0.8.0 to record the
actual scope of the Evidence & Safety panel (see Consequences).

## Decision

Evolve the `search_bids_app` UI from a results table into an AI Bid Workspace that enables bid judgment workflows entirely within the MCP Apps surface.

The UI uses host-mediated actions to bridge the workspace to the model conversation:

- `sendMessage` to invoke AI Bid Radar tools (`extract_bid_requirements`, `assess_bid_qualification`, `create_bid_review_packet`, `draft_bid_questions`) with `fetch_documents: true` from workspace buttons labeled in task language ("Read", "Assess", "Summarize", "Ask").
- `downloadFile` for CSV export.
- `openLink` for official procurement links.
- `updateModelContext` to sync the selected bid and attribution to the model conversation.
- `requestDisplayMode` to toggle host-controlled fullscreen/inline.

Each action degrades gracefully if the host denies, omits, or has not yet stabilized support.

## Rationale

The v0.4.0 table UI proved that MCP Apps host actions work end-to-end. v0.6.0 applies these actions to real user workflows based on four personas:

1. Sales manager: "Decide which bids to pursue within 15 minutes."
2. Bid administrator: "Zero missed submissions and deadlines."
3. Executive: "Does this bid fit our company?"
4. Junior staff: "What should I look at?"

The workspace layout (Priority Lane + Workbench + Action Dock + Evidence & Safety panel) puts judgment materials and actions in one view, eliminating repeated chat round-trips.

## Consequences

- The core server behavior remains independent of MCP Apps.
- `sendMessage` payloads explicitly include tool name and JSON arguments so the host model can call the right tool without guessing.
- Non-UI clients and legacy hosts keep using text + structuredContent without change.
- Host rejections are handled in the workspace UI, not as tool errors.

### Evidence & Safety panel scope (amended in v0.8.0)

The panel is bounded by what a `search_bids_app` result actually carries. As
implemented in `src/apps/search-results.tsx`, it shows the untrusted-data
warning, the bid `key`, `fileType` and `fileSize` when present, the KKJ
attribution `dataSource`, and `accessedAt`.

Source URI, SHA-256, extraction mode, and extraction warnings are **not** shown
in the panel. Those fields belong to document extraction results
(`BidRequirementExtractionSchema.extractedFromDocuments`), and the SHA-256 is
computed server-side in `src/api/pdf-fetcher.ts` when a document is fetched. A
search result precedes any document fetch, so the values do not exist at the
time the workspace renders.

Surfacing them would require the app to hold extraction results alongside
search results. That is deferred: it changes the app's state model from "one
tool result" to "a merged view over several tool results", and the untrusted-data
warning already carries the safety obligation the panel exists for.

## 日本語

v0.6.0 の `search_bids_app` は「AI Bid Workspace」として、Priority Lane / Workbench / Action Dock / Evidence & Safety panelの4ペイン構成で入札判断ワークフローを提供する。各ボタンは `sendMessage` でAI Bid Radarツールを呼び出し、host非対応時はchat fallback。

Evidence & Safety panel が表示するのは、未信頼データ警告・入札 `key`・`fileType`・`fileSize`・KKJ出典・取得日時である。sourceUri・SHA-256・抽出modeは表示していない（v0.8.0で記述を実装に合わせた）。これらは文書抽出結果に属する値で、SHA-256 は `src/api/pdf-fetcher.ts` がサーバ側で計算する。検索結果は文書取得より前の段階なので、workspace描画時点では値が存在しない。

## Bahasa Indonesia

`search_bids_app` v0.6.0 menjadi "AI Bid Workspace" dengan 4 panel: Priority Lane, Workbench, Action Dock, dan Evidence & Safety. Setiap tombol memanggil tool AI Bid Radar melalui `sendMessage`, dengan fallback chat jika host tidak mendukung.

Panel Evidence & Safety menampilkan peringatan data tidak tepercaya, `key` tender, `fileType`, `fileSize`, atribusi KKJ, dan waktu pengambilan. sourceUri, SHA-256, dan mode ekstraksi tidak ditampilkan (deskripsi disesuaikan dengan implementasi pada v0.8.0), karena nilai-nilai itu milik hasil ekstraksi dokumen dan belum ada saat hasil pencarian dirender.
