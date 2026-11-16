# Hacker News / dev.to 投稿テキスト

> 注記: 現行の `public_mvp`（公開7ツール・無料）およびローカル `JP_BIDS_PROFILE=full_local`（全22ツール）構成に合わせて更新済みです。

---

## Hacker News: Show HN

**タイトル**
```
Show HN: JP Bids MCP – MCP server for Japan's public procurement notices
```

**本文（HNコメント欄）**
```
I built an open-source MCP server (Model Context Protocol) that exposes Japan's government procurement portal (KKJ) to AI agents, with 7 free Public MVP tools on the hosted endpoint and 22 total tools in local full_local mode.

**What it does:**
- Search public procurement notices from Japan's SME Agency KKJ portal
- Interactive MCP Apps UI (`AI Bid Workspace`) with validated CSV/JSON shortlist export
- Score and rank bids against company profile (keywords, region, deadlines)
- Inspect official attachment URLs (plus optional local PDF/HTML requirement extraction)
- Additional local workflows (`JP_BIDS_PROFILE=full_local`): ICS calendar events, internal review packets, draft clarification questions, saved searches, and Investor Radar

**Why Japan's public procurement:**
- ~¥8 trillion/yr market, ~360k SMEs participating
- Existing services are primarily web UI and email-alert products, while agent-native workflows are still rare
- KKJ has a public API but it's barely used outside of scrapers

**Technical choices:**
- MCP 2025-11-25 targeted implementation: Tools, MCP Apps UI Resource (`ui://jp-bids/search-results.html`), Prompts, and Completion
- Streamable HTTP transport + OAuth 2.0 (PKCE + DCR)
- outputSchema + annotations on every tool
- Deployed on Cloud Run, custom domain mcp.bid-jp.com
- Automated test suite (Vitest), Biome lint, TypeDoc API docs, GitHub Actions CI

**Ecosystem:**
J-Grants + freee MCP workflow demos are published in the repo, showing how procurement, subsidies, and accounting can be combined in one conversation across three independent MCP servers.

**Free & Open Source (Apache-2.0)**
Remote (Public MVP, 7 tools): https://mcp.bid-jp.com/mcp
GitHub: https://github.com/sugukurukabe/koko-call-mcp

Happy to answer questions about MCP implementation patterns for public data APIs.
```

---

## dev.to 記事（英語）

**タイトル**
```
Building a Reference-Quality MCP Server for Japan's Government Procurement Portal
```

**タグ**
```
mcp, typescript, govtech, opensource
```

**本文**

```markdown
## Why Government Procurement Data?

Japan's SME Agency exposes public procurement notice search through the KKJ portal and public API. The data is there. The API is documented. But public, agent-native MCP examples for this domain are still rare.

That's a gap worth filling — not just for utility, but as a demonstration of what reference-quality MCP looks like on public data.

## What JP Bids MCP Does

7 free tools in the hosted `public_mvp` profile, plus 15 additional local developer tools (`JP_BIDS_PROFILE=full_local`, 22 tools total):

| Phase | Public MVP (`public_mvp`) | Local Extended (`JP_BIDS_PROFILE=full_local`) |
|-------|---------------------------|-----------------------------------------------|
| Discovery | `search_bids`, `list_recent_bids`, `get_bid_detail`, `search_bids_app` | — |
| Analysis | `rank_bids` | `analyze_past_awards`, `summarize_bids_by_org` |
| Qualification | `extract_bid_requirements` | `assess_bid_qualification`, `explain_bid_fit` |
| Action & Alerts | `export_bid_shortlist` | `create_bid_calendar`, `create_bid_review_packet`, `draft_bid_questions`, `save_search`, `check_saved_search`, `list_saved_searches` |
| Investor Radar | — | `resolve_listed_company`, `map_awards_to_company`, `get_company_award_history`, `screen_procurement_tailwinds`, `investor_radar_app_view` |

## MCP Spec Support

The server implements the core MCP primitives needed for public procurement search:

- **Tools** — 7 public tools (`public_mvp`) / 22 total tools (`full_local`) with full inputSchema descriptions and outputSchema
- **Resources** — KKJ attribution, API reference, prefecture codes, and MCP Apps UI (`ui://jp-bids/search-results.html`)
- **Resource Templates** — bid-by-key template (`full_local`)
- **Prompts** — morning briefing, competitor radar, deadline alert (`full_local`)
- **Completion** — prefecture name and category autocomplete (`full_local`)

Every tool has:
- `title` (human-readable)
- `description` (Japanese + English + Bahasa Indonesia)
- `inputSchema` with `.describe()` on every parameter
- `outputSchema` (Zod-inferred)
- `annotations` (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)

## Transport: Streamable HTTP + OAuth 2.0

The remote endpoint at `https://mcp.bid-jp.com/mcp` uses:
- Streamable HTTP (stateless, Cloud Run compatible)
- OAuth 2.0 Authorization Code + PKCE
- Dynamic Client Registration (DCR)
- Signed JWT `bid_ref` snapshot tokens for deterministic follow-up calls
- Free Public MVP profile (no paid tier or API key gating)

## Working alongside the J-Grants MCP

Japan's Digital Agency published `jgrants-mcp-server` (subsidies data) in early 2026. JP Bids MCP and J-Grants MCP are independent servers, but they were designed to be combined.

In one conversation, an agent can search for procurement bids, look up matching subsidies as funding sources, and connect both into a single decision. Demo workflows for this combination are in the repository.

## Try It

```bash
npx jp-bids-mcp                              # stdio mode (public_mvp, 7 tools)
JP_BIDS_PROFILE=full_local npx jp-bids-mcp   # stdio mode (full_local, 22 tools)
npx jp-bids-mcp --http                       # HTTP mode
```

Remote (no install): `https://mcp.bid-jp.com/mcp`

GitHub: https://github.com/sugukurukabe/koko-call-mcp

Smithery: https://smithery.ai/servers/a-kabe-1qio/jp-bids-mcp
```

---

## 投稿手順（壁の手動作業）

### Hacker News
1. https://news.ycombinator.com/submit にアクセス
2. タイトルをコピペ
3. URL: `https://mcp.bid-jp.com`
4. 投稿後、コメント欄に「本文」をコピペ

### dev.to
1. https://dev.to/new にアクセス
2. タイトル・タグ・本文をコピペ
3. カバー画像: `https://mcp.bid-jp.com/ogp.png` をダウンロードしてアップロード
4. 公開

**投稿タイミング**: 日本時間 火・水・木の 22:00〜23:00（米国東海岸 9:00〜10:00）
