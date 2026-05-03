# JP Bids MCP

[![npm version](https://img.shields.io/npm/v/jp-bids-mcp)](https://www.npmjs.com/package/jp-bids-mcp)
[![CI](https://github.com/sugukurukabe/koko-call-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sugukurukabe/koko-call-mcp/actions/workflows/ci.yml)
[![License: BSL-1.1](https://img.shields.io/badge/License-BSL--1.1-blue.svg)](LICENSE)

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

## AIに話しかけるだけ / Just Ask Your AI

```text
「鹿児島県のIT系入札を探して、うちに合う順にランク付けして」
```

→ 14件ヒット → AIスコアリング → 上位3件の要件整理 → カレンダー登録 → 全部ひとつの会話で。

```text
「この仕様書PDFの必須要件と評価項目を整理して」
```

→ PDF自動取得 → 要件抽出 → 参加資格チェック → 不足項目の取得方法まで提示。

```text
「農林水産省の過去3年の発注傾向を分析して」
```

→ 落札実績取得 → 予算規模・競合・落札率を分析 → 次の入札戦略を提案。

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

- `docs/use-cases.md`
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
- `docs/integrations/jgrants.md`
- `docs/articles/zenn-jp-bids-mcp.md`
- `docs/articles/zenn-jp-bids-jgrants.md`
- `docs/articles/note-public-data-mcp.md`
- `docs/adr/`
- `public/.well-known/agents.json`

## Interoperability / 相互運用 / Interoperabilitas

JP Bids MCP pairs with the [J-Grants MCP](https://github.com/digital-go-jp/jgrants-mcp-server) (Digital Agency of Japan) to cover both government contracts and grants in a single conversation.

```
# Search bids (JP Bids MCP) and grants (J-Grants MCP) simultaneously
"鹿児島県のITシステム調達案件と、中小企業向けDX補助金を同時に探してください。"
```

See [examples/jgrants-integration/](examples/jgrants-integration/) for ready-to-use Claude Desktop and Cursor configuration files, and three end-to-end workflow examples.  
Technical integration details: [docs/integrations/jgrants.md](docs/integrations/jgrants.md).

JP Bids MCP also pairs with [freee MCP](https://www.npmjs.com/package/freee-mcp) (freee K.K.) for procurement-to-accounting automation — financial readiness checks, post-award deal entries, and invoice generation from bid data. See [examples/freee-integration/](examples/freee-integration/).

> JP Bids MCP, J-Grants MCP, and freee MCP are independent servers operated by separate organizations. Results are reference information; always verify against official documents.

## Notes / 注意事項

このサーバーは入札情報の添付ファイルを保存しません。入札判断前に必ず公式調達書類を確認してください。  
This server does not store upstream documents or attachment files. Results are reference information and should be verified against official procurement documents before bidding decisions.

- [Privacy Policy / プライバシーポリシー](https://mcp.bid-jp.com/privacy)
- [Terms of Service / 利用規約](https://mcp.bid-jp.com/terms)
