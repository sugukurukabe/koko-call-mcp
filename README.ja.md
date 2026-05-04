# JP Bids MCP — 日本語ガイド

[![Smithery](https://smithery.ai/badge/a-kabe-1qio/jp-bids-mcp)](https://smithery.ai/servers/a-kabe-1qio/jp-bids-mcp)
[![Glama](https://glama.ai/mcp/servers/badge)](https://glama.ai/mcp/servers)
[![mcp.so](https://img.shields.io/badge/mcp.so-listed-brightgreen)](https://mcp.so)

## 概要 / Overview / Gambaran Umum

JP Bids MCP は、中小企業庁「官公需情報ポータルサイト」の入札情報をModel Context Protocolで検索・AI分析するサーバーです。

JP Bids MCP is an MCP server for searching and AI-analyzing Japanese government procurement notices from the SME Agency's KKJ portal.

JP Bids MCP adalah server MCP untuk mencari dan menganalisis pengumuman pengadaan pemerintah Jepang dari portal KKJ.

> **ベータ期間（〜2026年6月末）は全機能を無料で利用できます。**  
> During beta (until end of June 2026), all features are free.  
> Selama beta (sampai akhir Juni 2026), semua fitur gratis.

## AIに話しかけるだけ

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

## クイックスタート / Quick Start / Mulai Cepat

```text
リモートMCP: https://mcp.bid-jp.com/mcp
npm:         jp-bids-mcp
Registry:    io.github.sugukurukabe/jp-bids
```

### Claude.ai / ChatGPT / MCP対応クライアント

```text
https://mcp.bid-jp.com/mcp
```

### ローカル stdio

```bash
npx --yes jp-bids-mcp
```

### CSVエクスポート

```bash
npx --yes jp-bids-export --prefecture 鹿児島県 --category 役務 --query システム > bids.csv
```

## ツール一覧 / Tools / Daftar Alat

| ツール | 説明 | Tier |
|---|---|---|
| `search_bids` | キーワード・地域・業種で検索 | Free |
| `rank_bids` | 自社条件でスコアリング | Free |
| `list_recent_bids` | 直近の公告一覧 | Free |
| `get_bid_detail` | 案件詳細取得 | Free |
| `search_bids_app` | MCP Apps UIで検索・操作 | Pro |
| `explain_bid_fit` | 適合度の詳細説明 | Pro |
| `assess_bid_qualification` | 参加資格の自動確認 | Pro |
| `extract_bid_requirements` | PDF/HTML仕様書の要件抽出 | Pro |
| `export_bid_shortlist` | CSV/JSONエクスポート | Pro |
| `create_bid_calendar` | 締切日のICSカレンダー生成 | Pro |
| `create_bid_review_packet` | 社内検討メモ自動生成 | Pro |
| `draft_bid_questions` | 質問書ドラフト生成 | Pro |
| `analyze_past_awards` | 落札実績の分析 | Pro |
| `summarize_bids_by_org` | 発注機関別サマリー | Pro |
| `save_search` | 検索条件を保存 | Pro |
| `check_saved_search` | 保存検索の新着確認 | Pro |
| `list_saved_searches` | 保存検索の一覧 | Pro |

## 料金 / Pricing / Harga

| プラン | 料金 | 機能 |
|---|---|---|
| **Free** | 無料 | 検索・ランキング・詳細取得 |
| **Pro** | ¥990/月 | 全17ツール＋MCP Apps UI＋PDF抽出＋保存検索 |

ベータ期間（〜2026年6月末）はProも無料。APIキー不要。

## データ出典

中小企業庁 官公需情報ポータルサイト 検索API。このサーバーは入札情報の添付ファイルを保存しません。入札決定前に必ず公式調達書類を確認してください。

## 相互運用 / Interoperability / Interoperabilitas

JP Bids MCPは[Jグランツ MCP](https://github.com/digital-go-jp/jgrants-mcp-server)（デジタル庁）と連携することで、入札と補助金をひとつの会話で扱えます。

```
# 入札（JP Bids MCP）と補助金（Jグランツ MCP）を同時に探す
"鹿児島県のITシステム調達案件と、中小企業向けDX補助金を同時に探してください。"
```

Claude Desktop・Cursor用の設定ファイルと3つのエンドツーエンドワークフロー例：[examples/jgrants-integration/](examples/jgrants-integration/)  
技術的な連携詳細：[docs/integrations/jgrants.md](docs/integrations/jgrants.md)

JP Bids MCPは[freee MCP](https://www.npmjs.com/package/freee-mcp)（freee株式会社）とも連携でき、入札→会計処理の自動化（資金余力確認、落札後の売上取引登録、請求書生成）が可能です。設定例：[examples/freee-integration/](examples/freee-integration/)

> JP Bids MCP・Jグランツ MCP・freee MCPはそれぞれ別組織が運営する独立サーバーです。結果は参考情報であり、必ず公式書類で確認してください。

## ポリシー / Policies / Kebijakan

- [プライバシーポリシー / Privacy Policy](https://mcp.bid-jp.com/privacy)
- [利用規約 / Terms of Service](https://mcp.bid-jp.com/terms)
