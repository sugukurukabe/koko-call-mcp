# ADR-0024: Sampling Deprecation and Document Extraction Direction
# ADR-0024: Sampling 非推奨化と文書抽出方針
# ADR-0024: Depresiasi Sampling dan Arah Ekstraksi Dokumen

## Status / Status / Status

Accepted / Accepted / Diterima

## Context / 背景 / Konteks

`extract_bid_requirements`, `assess_bid_qualification`, and review-packet workflows can inspect official notice pages and attachments. ADR-0015 decided that fetched documents are processed ephemerally, not stored, and treated as untrusted input.

MCP `2026-07-28` marks Sampling as deprecated. The methods remain available during the lifecycle window, but the recommended direction is direct integration with LLM provider APIs for server-owned model work. The JP Bids implementation already has a Vertex AI Gemini direct mode for native document understanding and uses MCP Sampling only as a fallback.

## Decision / 決定 / Keputusan

- Keep MCP Sampling fallback for compatibility during the deprecation window.
- Prefer `JP_BIDS_VERTEX_AI=1` Gemini direct mode for document understanding when production credentials and allowlists are configured.
- Do not store PDFs, HTML, OCR output, or raw extracted documents on disk, Cloud Storage, or a database.
- Keep SSRF controls, MIME checks, size limits, redirect limits, timeouts, SHA-256 recording, and `<UNTRUSTED_DOCUMENT>` wrapping.
- Document Sampling as transitional in README and spec notes; do not build new user-facing features that require Sampling.
- When SDK and host support for MCP `2026-07-28` stabilizes, remove Sampling from the preferred path and keep only direct provider mode plus deterministic metadata extraction.

## Consequences / 影響 / Konsekuensi

Positive:

- Current clients that support Sampling do not lose functionality immediately.
- Production deployments have a clear path that does not depend on a deprecated MCP primitive.
- Data minimization and prompt-injection defenses remain unchanged.

Trade-offs:

- Direct provider mode requires provider credentials and operational controls.
- Host-side Sampling quality may vary across clients during the transition window.
- Tests must cover both `sampling` and `vertex_ai` modes until the fallback is removed.

## References / 参考 / Referensi

- ADR-0015: PDF Requirement Extraction
- ADR-0023: MCP 2026-07-28 Migration Readiness
- `docs/spec-notes/mcp-2026-07-28.md`
