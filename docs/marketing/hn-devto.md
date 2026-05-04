# Hacker News / dev.to 投稿テキスト

---

## Hacker News: Show HN

**タイトル**
```
Show HN: JP Bids MCP – MCP server for Japan's 1.8M/yr government procurement bids
```

**本文（HNコメント欄）**
```
I built an MCP server (Model Context Protocol) that exposes Japan's government procurement portal (KKJ) as 17 AI tools.

**What it does:**
- Search 1.8M+/yr public bids from Japan's SME Agency
- AI-score bids against company profile (keywords, qualifications, deadlines)
- Extract requirements from PDF spec sheets via Vertex AI Gemini
- Generate ICS calendar events for bid deadlines
- Export ranked shortlists as CSV for Google Sheets
- Internal review packets in Markdown

**Why Japan's public procurement:**
- ~¥8 trillion/yr market, ~360k SMEs participating
- Existing services (Grabion, NJSS) are web-UI + email alert only—zero AI integration
- KKJ has a public API but it's barely used outside of scrapers

**Technical choices:**
- MCP 2025-11-25 spec (latest), full 7-primitive implementation: Tools, Resources, Resource Templates, Prompts, Completion, Logging, Notifications
- Streamable HTTP transport + OAuth 2.0 (PKCE + DCR)
- outputSchema + annotations on every tool (Smithery quality score)
- Deployed on Cloud Run, custom domain mcp.bid-jp.com
- 103 tests, biome lint, TypeDoc API docs, GitHub Actions CI

**Ecosystem:**
J-Grants + freee MCP workflow demos are published in the repo, showing how procurement, subsidies, and accounting can be combined in one conversation across three independent MCP servers.

**Free during beta (until June 2026)**
Remote: https://mcp.bid-jp.com/mcp
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

Japan's SME Agency publishes 1.8M+ public procurement notices per year via a public API. The data is there. The API is documented. But as of early 2026, no one had wrapped it in an MCP server.

That's a gap worth filling — not just for utility, but as a demonstration of what reference-quality MCP looks like on public data.

## What JP Bids MCP Does

17 tools across the full bid management workflow:

| Phase | Tools |
|-------|-------|
| Discovery | `search_bids`, `list_recent_bids`, `get_bid_detail` |
| Analysis | `rank_bids`, `analyze_past_awards`, `summarize_bids_by_org` |
| Qualification | `assess_bid_qualification`, `extract_bid_requirements` |
| Decision | `explain_bid_fit`, `create_bid_review_packet` |
| Action | `create_bid_calendar`, `export_bid_shortlist`, `draft_bid_questions` |
| Alerts | `save_search`, `check_saved_search`, `list_saved_searches` |

## MCP Spec Compliance

The server implements all 7 MCP primitives from the 2025-11-25 spec:

- **Tools** — 17 tools with full inputSchema descriptions and outputSchema
- **Resources** — KKJ attribution, API reference, prefecture codes, Search Results App
- **Resource Templates** — bid-by-key template
- **Prompts** — morning briefing, competitor radar, deadline alert
- **Completion** — prefecture name and category autocomplete
- **Logging** — MCP protocol logging for debug
- **Notifications** — tools/list_changed on dynamic tool registration

Every tool has:
- `title` (human-readable)
- `description` (Japanese + English + Bahasa Indonesia)
- `inputSchema` with `.describe()` on every parameter
- `outputSchema` (Zod-inferred)
- `annotations` (readOnlyHint, idempotentHint, openWorldHint)

## Transport: Streamable HTTP + OAuth 2.0

The remote endpoint at `https://mcp.bid-jp.com/mcp` uses:
- Streamable HTTP (stateless, Cloud Run compatible)
- OAuth 2.0 Authorization Code + PKCE
- Dynamic Client Registration (DCR)
- JWT verification
- Free/Pro tier separation via API keys

## Working alongside the J-Grants MCP

Japan's Digital Agency published `jgrants-mcp-server` (subsidies data) in early 2026. JP Bids MCP and J-Grants MCP are independent servers, but they were designed to be combined.

In one conversation, an agent can search for procurement bids, look up matching subsidies as funding sources, and connect both into a single decision. Demo workflows for this combination are in the repository.

## Try It

```bash
npx jp-bids-mcp          # stdio mode
npx jp-bids-mcp --http   # HTTP mode
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
