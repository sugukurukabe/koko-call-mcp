# ADR-0014: MCP Apps Host Actions

## Status

Accepted; updated for v0.6.0 AI Bid Workspace.

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
- Evidence & Safety panel surfaces source URI, SHA-256, extraction mode, and untrusted-data warnings directly in the UI.
- Non-UI clients and legacy hosts keep using text + structuredContent without change.
- Host rejections are handled in the workspace UI, not as tool errors.

## 日本語

v0.6.0 の `search_bids_app` は「AI Bid Workspace」として、Priority Lane / Workbench / Action Dock / Evidence & Safety panelの4ペイン構成で入札判断ワークフローを提供する。各ボタンは `sendMessage` でAI Bid Radarツールを呼び出し、host非対応時はchat fallback。出典・SHA-256・抽出mode・未信頼データ警告をUI上に表示し、便利さと安全性を両立する。

## Bahasa Indonesia

`search_bids_app` v0.6.0 menjadi "AI Bid Workspace" dengan 4 panel: Priority Lane, Workbench, Action Dock, dan Evidence & Safety. Setiap tombol memanggil tool AI Bid Radar melalui `sendMessage`, dengan fallback chat jika host tidak mendukung. Panel Evidence & Safety menampilkan source URI, SHA-256, mode ekstraksi, dan peringatan data tidak tepercaya di UI.
