# JP Bids MCP

日本の官公需入札情報をMCPで検索・AI分析するサーバー。  
Search and AI-analyze Japanese public procurement notices through MCP.  
Server MCP untuk mencari dan menganalisis pengadaan pemerintah Jepang dengan AI.

> **ベータ期間中（〜2026年6月末）は全機能を無料で利用できます。**  
> During beta (until end of June 2026), all features are available for free.

```text
Remote MCP: https://mcp.bid-jp.com/mcp
npm:        jp-bids-mcp
Registry:   io.github.sugukurukabe/jp-bids
```

## Quick Start / クイックスタート

Use the remote endpoint from any Streamable HTTP compatible MCP client:

```text
https://mcp.bid-jp.com/mcp
```

With MCP Inspector:

```bash
npx --yes @modelcontextprotocol/inspector
```

Set `Transport Type` to `Streamable HTTP` and use the remote URL above. Do not use the default STDIO sample command such as `mcp-server-everything`.

Sample `search_bids` arguments:

```json
{
  "query": "システム",
  "prefecture": "鹿児島県",
  "category": "役務",
  "limit": 3
}
```

Local stdio:

```bash
npx --yes jp-bids-mcp
```

CSV export:

```bash
npx --yes jp-bids-export --prefecture 鹿児島県 --category 役務 --query システム --days 7 > bids.csv
```

Check without starting an MCP session:

```bash
npx --yes jp-bids-mcp --version
```

## What It Provides / 主な機能

- 官公需入札情報の読み取り専用検索。Read-only search for Japanese public procurement notices.
- AI Bid Radar: 案件を実務優先度でスコアリング・ランキング。Ranking bid candidates by practical follow-up priority.
- PDF/HTML要件抽出: 一時取得・SSRF防御・Vertex AI Gemini対応。PDF/HTML requirement extraction with SSRF guard and Vertex AI Gemini.
- MCP Apps UI: Claude.aiのサイドパネルで入札案件を一覧・操作。Interactive workspace in MCP Apps-compatible clients.
- Free/Proティア: ベータ期間（〜2026年6月末）は全機能無料。Free beta through June 2026, Pro ¥990/month thereafter.
- Resources・Resource Templatesでコンテキストを精密に渡せる。Resources and Resource Templates for targeted context.
- リモートStreamable HTTPとローカルstdioの両対応。Remote Streamable HTTP and local stdio transports.

データ出典 / Data source: 中小企業庁 官公需情報ポータルサイト 検索API.

## Tools / ツール一覧

| ツール | 説明 | Tier |
|---|---|---|
| `search_bids` | キーワード・地域・業種で検索 / Keyword & region search | Free |
| `rank_bids` | 自社条件でスコアリング / Score by your criteria | Free |
| `list_recent_bids` | 直近の公告一覧 / Recent notices | Free |
| `get_bid_detail` | 案件詳細取得 / Bid detail | Free |
| `search_bids_app` | MCP Apps UI付き検索 / Search with UI panel | Pro |
| `explain_bid_fit` | 適合度説明 / Fit explanation | Pro |
| `assess_bid_qualification` | 参加資格確認 / Qualification check | Pro |
| `extract_bid_requirements` | PDF/HTML要件抽出 / Requirement extraction | Pro |
| `export_bid_shortlist` | CSV/JSONエクスポート / Export shortlist | Pro |
| `create_bid_calendar` | ICSカレンダー生成 / Calendar export | Pro |
| `create_bid_review_packet` | 社内検討メモ / Review packet | Pro |
| `draft_bid_questions` | 質問書ドラフト / Draft questions | Pro |
| `analyze_past_awards` | 落札実績分析 / Past awards analysis | Pro |
| `summarize_bids_by_org` | 発注機関別まとめ / Summary by org | Pro |

## Resources

- `attribution://kkj`
- `docs://api-reference`
- `docs://agentic-cloud-roadmap`
- `docs://agentic-security-storage-readiness`
- `codes://prefectures`
- `ui://jp-bids/search-results.html`
- `bid://{bid_key}`
- `prefecture://{lg_code}`
- `org://{organization_name}`

## Verification

```bash
npm run remote:health
npm run remote:mcp
```

More examples: `examples/remote-smoke-prompts.md`.

Slack briefing job: `docs/slack-briefing.md`.

## Documentation

- `docs/architecture.md`
- `docs/ai-bid-radar.md`
- `docs/agentic-cloud-roadmap.md`
- `docs/agentic-security-storage-readiness.md`
- `docs/export.md`
- `docs/inspector.md`
- `docs/deployment-cloud-run.md`
- `docs/mcp-apps.md`
- `docs/slack-briefing.md`
- `docs/remote-release-checklist.md`
- `docs/submissions/mcp-directories.md`
- `docs/articles/zenn-jp-bids-mcp.md`
- `docs/articles/note-public-data-mcp.md`
- `docs/adr/`
- `public/.well-known/agents.json`

## Notes

This server does not store upstream documents or attachment files. Results are reference information and should be verified against official procurement documents before bidding decisions.
