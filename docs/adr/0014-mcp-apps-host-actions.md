# ADR-0014: MCP Apps Host Actions

## Status

Accepted

## Decision

Implement MCP Apps host-mediated actions in the `search_bids_app` UI while keeping the canonical MCP tool result text-first and structured.

The UI may call:

- `downloadFile` for CSV export.
- `sendMessage` to ask the host chat about the top bid.
- `openLink` for official procurement links.
- `createSamplingMessage` for an optional AI brief when the host explicitly advertises sampling support.
- `updateModelContext` to make the current visible search results available to future model turns.
- `requestDisplayMode` to test host-controlled fullscreen/inline display behavior.

Each action must degrade gracefully if the host denies, omits, or has not yet stabilized support for the request.

## Rationale

MCP Apps host actions are valuable precisely because they test the boundary between model conversation and interactive app state. Avoiding them entirely would make this project a passive demo rather than a useful reference implementation.

JP Bids MCP can exercise these actions safely because the underlying data is public, read-only procurement metadata. The server still returns normal text and `structuredContent`, so non-UI clients and older hosts remain supported.

Sampling is intentionally host-gated. The app checks host capabilities before calling `createSamplingMessage`, treats upstream bid text as untrusted public data, and falls back to `sendMessage` if sampling is unavailable or rejected.

## Consequences

- The core server behavior remains independent of MCP Apps.
- UI actions become a practical compatibility test across MCP Apps hosts.
- Rejections and missing host support are handled in-app instead of becoming tool failures.
- Sampling output is advisory UI content only and must not replace official procurement-document review.
- Model context updates contain only public bid metadata and explicit attribution.
- Display mode requests are optional UI preferences. The host remains authoritative.
- Any SDK or specification issue discovered through these actions should be documented before changing the stable tool surface.

## 日本語

`search_bids_app` では、MCP Appsの `downloadFile`、`sendMessage`、`openLink`、`updateModelContext`、`requestDisplayMode`、およびhostが明示的にsampling対応を宣言した場合のみ `createSamplingMessage` を実装する。ただし、標準のテキスト要約と `structuredContent` を必ず維持し、host側の未対応・拒否・仕様揺れでMCP tool自体が壊れないようにする。

## Bahasa Indonesia

`search_bids_app` mengimplementasikan `downloadFile`, `sendMessage`, `openLink`, `updateModelContext`, `requestDisplayMode`, dan `createSamplingMessage` hanya ketika host secara eksplisit menyatakan dukungan sampling. Ringkasan teks standar dan `structuredContent` tetap dipertahankan agar tool MCP tidak rusak ketika host belum mendukung, menolak, atau mengubah perilaku fitur tersebut.
