# 公式準拠基準線 / Compliance Baseline / Garis Dasar Kepatuhan

## 日本語

JP Bids MCP v0.9.0 の公開判定では、次の一次資料を「公式準拠」の根拠とする。

| 領域 | 基準 | 扱い |
|---|---|---|
| Core MCP | Model Context Protocol `2025-11-25` stable specification | 適合必須。Tools / Prompts / Resources / Resource Templates / Completion / Streamable HTTP の公開挙動はこの版で検証する。 |
| MCP Apps | MCP Apps extension `2026-01-26` stable specification and `@modelcontextprotocol/ext-apps` API documentation | 適合必須。`ui://` resource、`text/html;profile=mcp-app`、sandbox/CSP metadata、View-Host JSON-RPC、capability negotiation をこの版で検証する。 |
| OAuth | RFC 8414, RFC 7591, RFC 7636, RFC 8707, RFC 9207, RFC 9728 | 適合必須。authorization code と refresh token は `/mcp` access token として受理しない。client、redirect URI、resource、PKCE を token exchange まで束縛する。 |
| KKJ API | 中小企業庁 官公需情報ポータルサイト検索APIガイド、利用規約 | 適合必須。出典は構造化出力と人間向けcontentの両方で返す。添付資料はURIのみ返し、本文やPDF bytesを保存しない。 |
| MCP `2026-07-28` | release candidate / migration readiness notes | 互換準備。正式公開とSDK対応が揃うまで、`ttlMs` / `cacheScope` / `server/discover` 等を「公式準拠済み」と書かない。2026-08-30 時点の SDK 1.29.0 には未実装（ADR-0025）。 |

公開文書では、仕様上「可能」なことと、本実装で「選択」したことを分けて書く。たとえば MCP Apps は外部assetを `resourceDomains` で許可できるが、JP Bids MCP は `connectDomains: []` / `resourceDomains: []` を選んだため、現在のUIを単一HTMLに畳んでいる。

## English

JP Bids MCP v0.9.0 uses the following primary sources as the compliance baseline for public release.

| Area | Baseline | Treatment |
|---|---|---|
| Core MCP | Model Context Protocol `2025-11-25` stable specification | Required. Public behavior for Tools, Prompts, Resources, Resource Templates, Completion, and Streamable HTTP is verified against this version. |
| MCP Apps | MCP Apps extension `2026-01-26` stable specification and `@modelcontextprotocol/ext-apps` API documentation | Required. `ui://` resources, `text/html;profile=mcp-app`, sandbox/CSP metadata, View-Host JSON-RPC, and capability negotiation are verified against this version. |
| OAuth | RFC 8414, RFC 7591, RFC 7636, RFC 8707, RFC 9207, RFC 9728 | Required. Authorization codes and refresh tokens are never accepted as `/mcp` access tokens. Client, redirect URI, resource, and PKCE are bound through token exchange. |
| KKJ API | Small and Medium Enterprise Agency KKJ API guide and terms | Required. Attribution is returned in both structured output and human-readable content. Attachments are returned as URIs only; document bodies and PDF bytes are not stored. |
| MCP `2026-07-28` | release candidate / migration readiness notes | Compatibility preparation. Until final publication and SDK support land, `ttlMs`, `cacheScope`, `server/discover`, and similar items must not be described as fully compliant. SDK 1.29.0 still lacks these APIs as of 2026-08-30 (ADR-0025). |

Public writing must distinguish what the specification permits from what this implementation deliberately chooses. For example, MCP Apps can use external assets when allowed through `resourceDomains`, but JP Bids MCP chooses `connectDomains: []` and `resourceDomains: []`, so the current UI is bundled as a self-contained HTML file.

## Bahasa Indonesia

JP Bids MCP v0.9.0 memakai sumber primer berikut sebagai garis dasar kepatuhan untuk rilis publik.

| Area | Dasar | Perlakuan |
|---|---|---|
| Core MCP | Spesifikasi stabil Model Context Protocol `2025-11-25` | Wajib patuh. Perilaku publik Tools, Prompts, Resources, Resource Templates, Completion, dan Streamable HTTP diverifikasi terhadap versi ini. |
| MCP Apps | Spesifikasi stabil ekstensi MCP Apps `2026-01-26` dan dokumentasi API `@modelcontextprotocol/ext-apps` | Wajib patuh. Resource `ui://`, `text/html;profile=mcp-app`, metadata sandbox/CSP, JSON-RPC View-Host, dan capability negotiation diverifikasi terhadap versi ini. |
| OAuth | RFC 8414, RFC 7591, RFC 7636, RFC 8707, RFC 9207, RFC 9728 | Wajib patuh. Authorization code dan refresh token tidak pernah diterima sebagai access token `/mcp`. Client, redirect URI, resource, dan PKCE diikat sampai token exchange. |
| KKJ API | Panduan API dan ketentuan portal KKJ dari Small and Medium Enterprise Agency | Wajib patuh. Atribusi dikembalikan dalam output terstruktur dan content yang dibaca manusia. Lampiran hanya dikembalikan sebagai URI; body dokumen dan byte PDF tidak disimpan. |
| MCP `2026-07-28` | release candidate / catatan kesiapan migrasi | Persiapan kompatibilitas. Sampai spesifikasi final dan dukungan SDK tersedia, `ttlMs`, `cacheScope`, `server/discover`, dan hal serupa tidak boleh disebut sudah sepenuhnya patuh. SDK 1.29.0 belum menyediakannya per 2026-08-30 (ADR-0025). |

Tulisan publik harus membedakan hal yang diizinkan spesifikasi dari pilihan implementasi ini. Misalnya MCP Apps dapat memakai asset eksternal jika diizinkan lewat `resourceDomains`, tetapi JP Bids MCP memilih `connectDomains: []` dan `resourceDomains: []`, sehingga UI saat ini dibundel sebagai satu file HTML mandiri.
