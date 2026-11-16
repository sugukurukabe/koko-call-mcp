# Jグランツ MCP との連携 / Integration with J-Grants MCP / Integrasi dengan J-Grants MCP

## 概要 / Overview / Gambaran Umum

JP Bids MCP（入札情報）と Jグランツ MCP（補助金情報）は、それぞれ独立した公的データMCPサーバーです。
両者を組み合わせることで、日本の公的資金獲得を「入札」と「補助金」の両面からひとつの会話でカバーできます。

JP Bids MCP (procurement notices) and J-Grants MCP (subsidies) are independent public-data MCP servers.
Combining them lets a single LLM session cover both sides of Japan's public-sector funding: government contracts and grants.

JP Bids MCP (pengumuman pengadaan) dan J-Grants MCP (subsidi) adalah server MCP data publik yang independen.
Menggabungkan keduanya memungkinkan satu sesi LLM mencakup kedua sisi pendanaan sektor publik Jepang.

---

## 責任分界 / Responsibility Boundary / Batasan Tanggung Jawab

| 項目 | JP Bids MCP | Jグランツ MCP |
|---|---|---|
| 運営 | スグクル株式会社 | デジタル庁 |
| データソース | 中小企業庁 KKJ 検索API | デジタル庁 Jグランツ公開API |
| 一次情報URL | https://kkj.go.jp | https://www.jgrants-portal.go.jp |
| API利用規約 | https://www.kkj.go.jp/s/help/notes/ | https://www.jgrants-portal.go.jp/open-api |
| ライセンス | Apache-2.0 | MIT |
| GitHub | https://github.com/sugukurukabe/koko-call-mcp | https://github.com/digital-go-jp/jgrants-mcp-server |
| MCP仕様準拠 | 2025-11-25 | 2025-11-25 |
| データ更新頻度 | KKJ API準拠（リアルタイム寄り） | Jグランツ API準拠 |
| データ保存 | なし（一時取得・即廃棄） | なし（一時取得・即廃棄） |

**重要**: いずれのサーバーも結果は参考情報です。入札参加・補助金申請の前に必ず一次資料を確認してください。

---

## ツール対応表 / Tool Reference / Referensi Alat

### 入札系 — JP Bids MCP

> 公開エンドポイント（`https://mcp.bid-jp.com/mcp`）およびデフォルトの `npx jp-bids-mcp` は `public_mvp`（無料・公開7ツール）を提供します。残りのツール（および Investor Radar 5ツールを含む計22ツール）はローカルで `JP_BIDS_PROFILE=full_local` を指定した場合に有効になります。

| ツール | 目的 | Profile |
|---|---|---|
| `search_bids` | キーワード・地域・業種で入札案件を検索 | `public_mvp`（公開・無料） |
| `list_recent_bids` | 直近公告一覧 | `public_mvp`（公開・無料） |
| `get_bid_detail` | 案件詳細（`bid_ref` または `bid_key`） | `public_mvp`（公開・無料） |
| `search_bids_app` | MCP Apps UIで検索・操作 | `public_mvp`（公開・無料） |
| `rank_bids` | 自社プロファイルでスコアリング | `public_mvp`（公開・無料） |
| `extract_bid_requirements` | 仕様書URL整理・ローカル設定時の本文抽出 | `public_mvp`（公開・無料） |
| `export_bid_shortlist` | CSV/JSONエクスポート | `public_mvp`（公開・無料） |
| `explain_bid_fit` | 適合度の詳細説明 | `full_local`（ローカル開発用） |
| `assess_bid_qualification` | 参加資格確認 | `full_local`（ローカル開発用） |
| `create_bid_calendar` | 締切ICSカレンダー | `full_local`（ローカル開発用） |
| `create_bid_review_packet` | 社内検討メモ | `full_local`（ローカル開発用） |
| `draft_bid_questions` | 質問書ドラフト | `full_local`（ローカル開発用） |
| `analyze_past_awards` | 過去公告傾向分析 | `full_local`（ローカル開発用） |
| `summarize_bids_by_org` | 発注機関別サマリー | `full_local`（ローカル開発用） |
| `save_search` | 検索条件を保存 | `full_local`（ローカル開発用） |
| `check_saved_search` | 保存検索の新着確認 | `full_local`（ローカル開発用） |
| `list_saved_searches` | 保存検索の一覧 | `full_local`（ローカル開発用） |

### 補助金系 — Jグランツ MCP（[digital-go-jp/jgrants-mcp-server](https://github.com/digital-go-jp/jgrants-mcp-server)）

| ツール | 目的 |
|---|---|
| `search_subsidies` | キーワード・業種・地域・受付状態で検索 |
| `get_subsidy_detail` | 添付ファイルを含む詳細取得 |
| `get_subsidy_overview` | 締切別・金額別の統計概要 |
| `get_file_content` | 保存済み添付ファイルの内容取得 |

---

## 代表的な連携パターン / Common Patterns / Pola Umum

### パターン1：同時探索

LLMが `search_bids`（JP Bids）と `search_subsidies`（Jグランツ）を並列で呼び出し、
入札案件と補助金を一覧で提示する。

```
鹿児島県のITシステム調達案件と、中小企業向けDX補助金を同時に探してください。
```

### パターン2：補助金で原資を確保 → 入札

まず `search_subsidies` で申請中の補助金を特定し、補助金の締切を踏まえた上で
`rank_bids` → `extract_bid_requirements` / `export_bid_shortlist`（ローカル `JP_BIDS_PROFILE=full_local` 利用時は `create_bid_review_packet` も利用可）で入札戦略を立てる。

```
IT補助金の申請期限を確認してから、AIシステム開発の入札案件を絞り込んでください。
```

### パターン3：過去公告傾向との交差分析（ローカル `full_local`）

ローカルの `JP_BIDS_PROFILE=full_local` で `analyze_past_awards` を呼び出してカテゴリ別の公告傾向を確認し、
`get_subsidy_overview` で同業種に使える補助金の統計を取得。
ファンディング全体像のレポートを生成する。

```
清掃業務の過去公告傾向と、同カテゴリで使える補助金の概況を合わせてレポートしてください。
```

---

## セットアップ参照 / Setup Reference

詳細なセットアップ手順と動作確認済みの設定ファイルは以下を参照してください：

- [examples/jgrants-integration/README.md](../../examples/jgrants-integration/README.md)（English）
- [examples/jgrants-integration/README.ja.md](../../examples/jgrants-integration/README.ja.md)（日本語）
- [examples/jgrants-integration/README.id.md](../../examples/jgrants-integration/README.id.md)（Bahasa Indonesia）
- [examples/jgrants-integration/claude_desktop_config.json](../../examples/jgrants-integration/claude_desktop_config.json)（Claude Desktop用設定）
- [examples/jgrants-integration/cursor.mcp.json](../../examples/jgrants-integration/cursor.mcp.json)（Cursor用設定）

---

## 一次情報リンク / Primary Sources / Sumber Primer

- [MCP仕様書 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
- [Jグランツ Open API 利用規約](https://www.jgrants-portal.go.jp/open-api)
- [digital-go-jp/jgrants-mcp-server (GitHub)](https://github.com/digital-go-jp/jgrants-mcp-server)
- [官公需情報ポータルサイト (KKJ)](https://kkj.go.jp)
- [JP Bids MCP (GitHub)](https://github.com/sugukurukabe/koko-call-mcp)
