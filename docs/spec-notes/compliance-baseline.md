# 公式準拠基準線 / Compliance Baseline / Garis Dasar Kepatuhan

## 日本語

JP Bids MCP v0.10.1 の公開候補では、次の一次資料を「公式準拠」および「移行互換」の根拠とする。

| 領域 | 基準 | 扱い |
|---|---|---|
| Core MCP | Model Context Protocol `2025-11-25` stable specification（`@modelcontextprotocol/sdk@1.32.2` ネイティブ実装） | **適合必須（主基準）**。Tools / Prompts / Resources / Resource Templates / Completion / Streamable HTTP の公開挙動は `2025-11-25` 仕様で検証する。 |
| MCP Apps | MCP Apps extension `2026-01-26` stable specification and `@modelcontextprotocol/ext-apps@1.7.4` API documentation | **適合必須**。`ui://` resource、`text/html;profile=mcp-app`、sandbox/CSP metadata、View-Host JSON-RPC、capability negotiation をこの版で検証する。 |
| OAuth | RFC 6749 §5.1 (`Cache-Control: no-store`), RFC 7591, RFC 7636, RFC 8414, RFC 8707, RFC 8725, RFC 9207, RFC 9728 | **適合必須**。authorization code と refresh token は `/mcp` access token として受理しない。client、redirect URI、resource、PKCE を token exchange まで束縛する。 |
| KKJ API | 中小企業庁 官公需情報ポータルサイト検索APIガイド、利用規約 | **適合必須**。出典は構造化出力と人間向けcontentの両方で返す。添付資料はURIのみ返し、本文やPDF bytesを保存しない。 |
| MCP `2026-07-28` | `src/transports/http.ts` における HTTP / リクエスト `_meta` 変換アダプタ（SDK v2 ネイティブではない） | **HTTP境界アダプタ互換**。ランタイムは `@modelcontextprotocol/sdk@1.32.2`（`2025-11-25` ネイティブ）を使用し、`src/transports/http.ts` で `MCP-Protocol-Version: 2026-07-28`、`params._meta["io.modelcontextprotocol/protocolVersion"]`、`Mcp-Method`、メソッド別 `Mcp-Name`（`tools/call`・`prompts/get` は `params.name`、`resources/read` 等は `params.uri`）、および `initialize` / `Mcp-Session-Id` 廃止契約を厳格検査したうえで内部の stateless `McpServer` へ中継する。`ttlMs` / `cacheScope` / `server/discover` / `io.modelcontextprotocol/tasks` は未実装であり、完全準拠とは記載しない。 |

公開文書では、仕様上「可能」なことと、本実装で「選択」したこと、および「実SDKがネイティブ提供する範囲」と「HTTPアダプタで提供する範囲」を厳密に分けて書く。たとえば MCP Apps は外部assetを `resourceDomains` で許可できるが、JP Bids MCP は `connectDomains: []` / `resourceDomains: []` を選んだため、現在のUIを単一HTMLに畳んでいる。

## English

JP Bids MCP v0.10.1 uses the following primary sources as the compliance and compatibility baseline for the release candidate.

| Area | Baseline | Treatment |
|---|---|---|
| Core MCP | Model Context Protocol `2025-11-25` stable specification (native in `@modelcontextprotocol/sdk@1.32.2`) | **Required primary baseline**. Public behavior for Tools, Prompts, Resources, Resource Templates, Completion, and Streamable HTTP is verified against `2025-11-25`. |
| MCP Apps | MCP Apps extension `2026-01-26` stable specification and `@modelcontextprotocol/ext-apps@1.7.4` API documentation | **Required**. `ui://` resources, `text/html;profile=mcp-app`, sandbox/CSP metadata, View-Host JSON-RPC, and capability negotiation are verified against this version. |
| OAuth | RFC 6749 §5.1 (`Cache-Control: no-store`), RFC 7591, RFC 7636, RFC 8414, RFC 8707, RFC 8725, RFC 9207, RFC 9728 | **Required**. Authorization codes and refresh tokens are never accepted as `/mcp` access tokens. Client, redirect URI, resource, and PKCE are bound through token exchange. |
| KKJ API | Small and Medium Enterprise Agency KKJ API guide and terms | **Required**. Attribution is returned in both structured output and human-readable content. Attachments are returned as URIs only; document bodies and PDF bytes are not stored. |
| MCP `2026-07-28` | Stateless HTTP / per-request `_meta` adapter in `src/transports/http.ts` (not native SDK v2) | **HTTP boundary adapter compatibility**. The runtime uses `@modelcontextprotocol/sdk@1.32.2` (native `2025-11-25`). `src/transports/http.ts` validates `MCP-Protocol-Version: 2026-07-28`, `params._meta["io.modelcontextprotocol/protocolVersion"]`, `Mcp-Method`, method-aware `Mcp-Name` (`params.name` for `tools/call`/`prompts/get`; `params.uri` for `resources/read`/`subscribe`/`unsubscribe`), and rejection of `initialize` and `Mcp-Session-Id` before bridging into the stateless `McpServer`. Features requiring SDK v2 (`ttlMs`, `cacheScope`, `server/discover`, `io.modelcontextprotocol/tasks`) are not implemented and are never claimed as compliant. |

Public writing must distinguish what the specification permits, what this implementation deliberately chooses, and what is native to `@modelcontextprotocol/sdk@1.32.2` versus handled by the HTTP adapter. For example, MCP Apps can use external assets when allowed through `resourceDomains`, but JP Bids MCP chooses `connectDomains: []` and `resourceDomains: []`, bundling the UI as a self-contained HTML file.

## Bahasa Indonesia

JP Bids MCP v0.10.1 memakai sumber primer berikut sebagai garis dasar kepatuhan dan kompatibilitas untuk kandidat rilis.

| Area | Dasar | Perlakuan |
|---|---|---|
| Core MCP | Spesifikasi stabil Model Context Protocol `2025-11-25` (bawaan `@modelcontextprotocol/sdk@1.32.2`) | **Wajib patuh (dasar utama)**. Perilaku publik Tools, Prompts, Resources, Resource Templates, Completion, dan Streamable HTTP diverifikasi terhadap `2025-11-25`. |
| MCP Apps | Spesifikasi stabil ekstensi MCP Apps `2026-01-26` dan dokumentasi API `@modelcontextprotocol/ext-apps@1.7.4` | **Wajib patuh**. Resource `ui://`, `text/html;profile=mcp-app`, metadata sandbox/CSP, JSON-RPC View-Host, dan capability negotiation diverifikasi terhadap versi ini. |
| OAuth | RFC 6749 §5.1 (`Cache-Control: no-store`), RFC 7591, RFC 7636, RFC 8414, RFC 8707, RFC 8725, RFC 9207, RFC 9728 | **Wajib patuh**. Authorization code dan refresh token tidak pernah diterima sebagai access token `/mcp`. Client, redirect URI, resource, dan PKCE diikat sampai token exchange. |
| KKJ API | Panduan API dan ketentuan portal KKJ dari Small and Medium Enterprise Agency | **Wajib patuh**. Atribusi dikembalikan dalam output terstruktur dan content yang dibaca manusia. Lampiran hanya dikembalikan sebagai URI; body dokumen dan byte PDF tidak disimpan. |
| MCP `2026-07-28` | Adapter HTTP stateless / `_meta` per-request di `src/transports/http.ts` (bukan SDK v2 bawaan) | **Kompatibilitas adapter batas HTTP**. Runtime memakai `@modelcontextprotocol/sdk@1.32.2` (bawaan `2025-11-25`). `src/transports/http.ts` memvalidasi `MCP-Protocol-Version: 2026-07-28`, `params._meta["io.modelcontextprotocol/protocolVersion"]`, `Mcp-Method`, `Mcp-Name` sesuai metode (`params.name` untuk `tools/call`/`prompts/get`; `params.uri` untuk `resources/read`), serta penolakan `initialize` dan `Mcp-Session-Id` sebelum meneruskan ke `McpServer` stateless. Fitur SDK v2 (`ttlMs`, `cacheScope`, `server/discover`, `io.modelcontextprotocol/tasks`) belum diimplementasikan dan tidak diklaim patuh penuh. |

Tulisan publik harus membedakan hal yang diizinkan spesifikasi, pilihan implementasi ini, serta fitur bawaan SDK 1.32.2 vs adapter HTTP. Misalnya MCP Apps dapat memakai asset eksternal lewat `resourceDomains`, tetapi JP Bids MCP memilih `connectDomains: []` dan `resourceDomains: []`, sehingga UI dibundel sebagai satu file HTML mandiri.
