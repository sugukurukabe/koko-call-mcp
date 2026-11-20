# JP Bids MCP (v0.10.2)

[![npm version](https://img.shields.io/npm/v/jp-bids-mcp)](https://www.npmjs.com/package/jp-bids-mcp)
[![CI](https://github.com/sugukurukabe/koko-call-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sugukurukabe/koko-call-mcp/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Smithery](https://smithery.ai/badge/a-kabe-1qio/jp-bids-mcp)](https://smithery.ai/servers/a-kabe-1qio/jp-bids-mcp)

日本の官公需入札情報を普段お使いのAI（Claude / ChatGPT）から検索・比較・公式URL確認・16列CSV出力できるMCPサーバー（**v0.10.2・完全無料・インストール不要・公開7ツール・Cloudflareエッジ保護**）。<br>
Search, compare, verify official notice URLs, and export 16-column CSV/JSON shortlists of Japanese government procurement notices via MCP (**v0.10.2, 100% free, read-centric, 7 public tools + interactive AI Bid Workspace UI + Cloudflare Edge Gateway**).<br>
Cari, bandingkan, periksa URL resmi, dan ekspor CSV/JSON 16 kolom pengumuman pengadaan pemerintah Jepang melalui MCP (**v0.10.2, sepenuhnya gratis, read-centric, 7 alat publik + Cloudflare Edge Gateway**).

[日本語ガイド (README.ja.md)](README.ja.md) · [使用説明書 (USER_GUIDE.ja.md)](docs/USER_GUIDE.ja.md) · [Panduan Bahasa Indonesia (README.id.md)](README.id.md)

> **100% Free & Read-Only (`public_mvp`) / 完全無料・読み取り中心**<br>
> All 7 `public_mvp` tools and the interactive **AI Bid Workspace** UI are free with zero sign-up, zero credit card, and zero runtime Stripe billing calls (`src/lib/billing.ts` and the `stripe` package remain in the repository solely for optional local `full_local` development and are never registered in `public_mvp`). The server never submits bids or writes to external systems.

---

## 60-Second 1-Click Start (Free / No Install) — 60秒で始める1クリック接続

No coding, terminal commands, or local installation required. Connect **Claude** or **ChatGPT** directly to the hosted Streamable HTTP endpoint:

```text
https://mcp.bid-jp.com/mcp
```

### 1. Connect in Claude (Claude.ai / Claude Desktop) — 3 Steps
1. Open Claude and go to **Settings / Customize → Connectors** (設定 → コネクタ).
2. Click **Add Custom Connector**, enter name `JP Bids` and URL `https://mcp.bid-jp.com/mcp`.
3. Click **Allow / 許可する** on the 1-click OAuth 2.0 consent screen (Dynamic Client Registration + PKCE S256 — no account or password required).

### 2. Connect in ChatGPT (Apps / Connectors) — 3 Steps
1. Open ChatGPT **Settings → Apps / Connectors**.
2. Add MCP Server URL `https://mcp.bid-jp.com/mcp` with **OAuth 2.0** authentication.
3. Click **Allow / 許可する** once on the consent screen to enable all 7 procurement tools and the embedded **AI Bid Workspace**.

### 3. Ready-to-Copy Prompts (Search → Compare → Official Link → 16-Col CSV)

Paste any of these prompts directly into Claude or ChatGPT (Japanese or English):

```text
1. Search & Open Visual Workspace:
「東京都・役務で、件名に『システム』を含む入札公告を最大5件検索して、AI Bid Workspaceを表示してください。」
("Search up to 5 IT service tenders in Tokyo and open the AI Bid Workspace.")

2. Compare Selected Notices Without Hallucination:
「今の検索結果から選んだ案件を、『クラウド』『保守』を重視して比較・ランク付けしてください。別の案件へ入れ替えないでください。」
("Rank the selected notices prioritizing 'cloud' and 'maintenance' without substituting other bids.")

3. Inspect Official Notice URL & Requirements Checklist:
「最初の案件の詳細と公式公告URL、確認すべき参加資格・提出期限を整理してください。」
("Show full details, official notice URLs, and a requirement checklist for the top notice.")

4. Export Validated 16-Column CSV Shortlist:
「選んだ案件の順序を保ったまま、16列の検討用CSVに出力してください。」
("Export the selected bids in exact selection order as a 16-column CSV.")
```

### 4. Optional 1-Click Claude Skill Upload (`searching-japanese-bids.zip`)
To give Claude built-in mastery of Japanese prefecture codes, procurement categories (`物品` / `工事` / `役務`), and signed `bid_ref` workflows:
1. Download **`searching-japanese-bids.zip`** from GitHub Releases (or zip [`skills/searching-japanese-bids/`](skills/searching-japanese-bids/)).
2. In **Claude.ai → Settings → Features → Skills → Upload skill**, select `searching-japanese-bids.zip`.

---

## Public MVP Tools (7 Free Tools + AI Bid Workspace UI)

| Tool / ツール | Role / 説明 | Profile |
|---|---|---|
| `search_bids` | Search notices across all 47 prefectures by keyword, region, category (`物品`/`工事`/`役務`), and dates / キーワード・地域・区分・期間検索 | Public MVP (Free) |
| `list_recent_bids` | List newly published notices from the past 1–30 days / 直近1〜30日間の新着公告一覧 | Public MVP (Free) |
| `get_bid_detail` | Restore exact notice details & official attachment URLs via signed `bid_ref` or `bid_key` / 案件詳細・公式リンク確認 | Public MVP (Free) |
| `rank_bids` | Deterministic 0–100 fit scoring (`pursue`/`review`/`skip`) in search or `bid_refs` selection mode / 適合度・優先度比較 | Public MVP (Free) |
| `extract_bid_requirements` | Organize eligibility, deadlines & attachment URLs from metadata (external body fetch OFF by default) / 要件・確認資料URL整理 | Public MVP (Free) |
| `export_bid_shortlist` | Export ranked or selected notices (preserving exact order) as 16-column CSV or JSON / 16列CSV・JSON出力 | Public MVP (Free) |
| `search_bids_app` | Interactive MCP Apps workspace (`ui://jp-bids/search-results.html`) with 3-tier CSV/JSON export fallback / 対話型検索ワークスペース画面 | Public MVP (Free) |

## Pricing / 料金 / Harga

| Plan | Price | Included |
|---|---|---|
| **Public MVP (`v0.10.2`)** | **Free / 無料 / Gratis** | All 7 public tools + single-file MCP Apps UI (`AI Bid Workspace`). Zero subscriptions or runtime billing calls. |

*(Excludes third-party AI client subscriptions or self-hosted cloud costs / 外部AIクライアント利用料や自己ホスト時のクラウド費用は除きます).*

## Resources

- `attribution://kkj` — Official KKJ data source attribution
- `docs://api-reference` — Parameter & schema reference
- `codes://prefectures` — 47 Japanese prefecture names & `lg_code` table
- `ui://jp-bids/search-results.html` — Single-file MCP Apps UI bundle (`connectDomains: []`, `resourceDomains: []`)
- `prefecture://{lg_code}` — Prefecture metadata template (`01`–`47`)

---

## Interoperability / 相互運用 / Interoperabilitas

JP Bids MCP pairs seamlessly with [J-Grants MCP](https://github.com/digital-go-jp/jgrants-mcp-server) (Digital Agency of Japan) to search government procurement contracts and SME subsidies in one conversation:

```text
"鹿児島県のITシステム調達案件と、中小企業向けDX補助金を同時に探してください。"
```

- Configuration & workflow examples: [examples/jgrants-integration/](examples/jgrants-integration/) · [docs/integrations/jgrants.md](docs/integrations/jgrants.md)
- Accounting handoff with [freee MCP](https://www.npmjs.com/package/freee-mcp): [examples/freee-integration/](examples/freee-integration/)

> JP Bids MCP, J-Grants MCP, and freee MCP are independent servers operated by separate organizations.

---

## Developer / Local Setup (stdio, CLI, `full_local` & Offline Acceptance)

```text
Remote MCP:             https://mcp.bid-jp.com/mcp
Feedback Form:          https://mcp.bid-jp.com/feedback
Published version:      0.10.2 (npm: jp-bids-mcp@0.10.2 / MCP Registry: io.github.sugukurukabe/jp-bids@0.10.2)
Registry metadata name: io.github.sugukurukabe/jp-bids
```

> The hosted `/mcp` endpoint requires OAuth 2.0 (unauthenticated requests receive `401` with `WWW-Authenticate` resource metadata for automatic DCR + PKCE S256 discovery). Plain `curl` requires a Bearer token; use local `stdio` below for unauthenticated local usage.

### 1. Local `npx` Stdio & CLI Export (No Auth Required)

```bash
# Start MCP server over stdio (defaults to public_mvp 7 tools)
npx --yes jp-bids-mcp

# Check version without starting a session
npx --yes jp-bids-mcp --version

# Direct CLI CSV export
npx --yes jp-bids-export --prefecture 鹿児島県 --category 役務 --query システム --days 7 > bids.csv

# Inspect Streamable HTTP or stdio with MCP Inspector
npx --yes @modelcontextprotocol/inspector
```

`claude_desktop_config.json` (published npm package over stdio):

```json
{
  "mcpServers": {
    "jp-bids": {
      "command": "npx",
      "args": ["-y", "jp-bids-mcp"],
      "env": {
        "JP_BIDS_PROFILE": "public_mvp"
      }
    }
  }
}
```

### 2. Build from Source & Optional `full_local` Developer Profile

```bash
git clone https://github.com/sugukurukabe/koko-call-mcp.git
cd koko-call-mcp
npm install
npm run check
```

- **Standard Local Runtime (`node dist/server.js`)**: Enforces `TokenBucketRateLimiter` (`<= 1 req/sec`), zero attachment persistence, and `stderr`-only logging.
- **Extended Local Profile (`JP_BIDS_PROFILE=full_local`)**: Self-hosted local profile unlocking 15 additional reference tools (22 total), including ICS calendar export, internal review packets, draft questions, saved searches, and Investor Radar ticker mapping ([docs/investor-radar.md](docs/investor-radar.md); not investment advice).

### 3. Offline Mock Demo (M1–M3-B) & Gate 1 Acceptance Runner

To test UI rendering and all 35 Gate 1 acceptance sub-conditions locally with **zero live KKJ network traffic** (see [docs/VERIFICATION_STATUS.md](docs/VERIFICATION_STATUS.md) for production Claude & ChatGPT verification records):

```json
{
  "mcpServers": {
    "jp-bids-mock": {
      "command": "node",
      "args": ["/path/to/koko-call-mcp/examples/mock-stdio-server.mjs"]
    }
  }
}
```

```bash
# Run Gate 1 acceptance suite under the loopback-only network guard (35/35 conditions, 0 external calls)
node --import ./tests/acceptance/net-guard.mjs tests/acceptance/gate1-runner.mjs
```

### 4. Protocol, Edge Gateway & Registry Specifications (`v0.10.2`)

- **MCP `2025-11-25` & Stateless `2026-07-28` HTTP Adapter**: Runs `@modelcontextprotocol/sdk@1.32.2` (`2025-11-25` native) with a stateless `2026-07-28` HTTP boundary adapter in `src/transports/http.ts` enforcing `_meta["io.modelcontextprotocol/protocolVersion"]`, `Mcp-Method`, method-aware `Mcp-Name` (`params.name` for `tools/call`/`prompts/get`, `params.uri` for `resources/read`), `Cache-Control: no-store`, and RFC 9207 `iss` ([docs/spec-notes/mcp-2026-07-28.md](docs/spec-notes/mcp-2026-07-28.md)).
- **Cloudflare Edge Gateway (`mcp.bid-jp.com`)**: Proxies `https://mcp.bid-jp.com/*` in front of Cloud Run with 3-class self-healing (read-only stale fallback + KKJ circuit breaker), non-PII Workers Analytics Engine telemetry, daily-salted client IP-hash OAuth rate-limit isolation, and the bilingual `/feedback` form backed by Turnstile and D1 ([docs/cloudflare-edge-mcp-playbook.md](docs/cloudflare-edge-mcp-playbook.md)).
- **Official MCP Registry (`server.json`)**: Conforms to `2025-12-11/server.schema.json` (`io.github.sugukurukabe/jp-bids`).
- **Server Card Discovery (`public/.well-known/mcp/server-card.json`)**: Exposes full JSON schemas and `_meta.ui` bindings for the 7 `public_mvp` tools.

## Documentation

- [User Guide (Japanese)](docs/USER_GUIDE.ja.md) · [Functional Spec](docs/FUNCTIONAL_SPEC.md) · [Verification Status](docs/VERIFICATION_STATUS.md)
- [Cloudflare Edge Playbook](docs/cloudflare-edge-mcp-playbook.md) · [Go-Live Runbook](docs/GO_LIVE_TODAY_RUNBOOK.md) · [Remote Release Checklist](docs/remote-release-checklist.md) · [Directory Submissions](docs/submissions/mcp-directories.md)
- [Architecture](docs/architecture.md) · [MCP Apps UI](docs/mcp-apps.md) · [AI Bid Radar](docs/ai-bid-radar.md) · [Cloud Run Deployment](docs/deployment-cloud-run.md) · [OAuth Operations](docs/oauth.md) · [ADRs](docs/adr/)

## Notes & Policies / 注意事項

Data source: Small and Medium Enterprise Agency KKJ Portal Search API (`中小企業庁 官公需情報ポータルサイト`). Provided by Sugukuru Inc. (not an official government agency product). This server never stores upstream attachment PDFs; always verify original procurement documents from the issuing agency before bidding.

- [Privacy Policy / プライバシーポリシー](https://mcp.bid-jp.com/privacy)
- [Terms of Service / 利用規約](https://mcp.bid-jp.com/terms)
- [Feedback / ご意見・フィードバック](https://mcp.bid-jp.com/feedback)
