# JP Bids MCP — 日本語ガイド

## 概要 / Overview / Gambaran Umum

JP Bids MCP は、中小企業庁「官公需情報ポータルサイト」の入札情報をModel Context Protocolで検索・AI分析するサーバーです。

JP Bids MCP is an MCP server for searching and AI-analyzing Japanese government procurement notices from the SME Agency's KKJ portal.

JP Bids MCP adalah server MCP untuk mencari dan menganalisis pengumuman pengadaan pemerintah Jepang dari portal KKJ.

> **ベータ期間（〜2026年6月末）は全機能を無料で利用できます。**  
> During beta (until end of June 2026), all features are free.  
> Selama beta (sampai akhir Juni 2026), semua fitur gratis.

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

## 料金 / Pricing / Harga

| プラン | 料金 | 機能 |
|---|---|---|
| **Free** | 無料 | 検索・ランキング・詳細取得 |
| **Pro** | ¥990/月 | 全14ツール＋MCP Apps UI＋PDF抽出 |

ベータ期間（〜2026年6月末）はProも無料。APIキー不要。

## データ出典

中小企業庁 官公需情報ポータルサイト 検索API。このサーバーは入札情報の添付ファイルを保存しません。入札決定前に必ず公式調達書類を確認してください。
