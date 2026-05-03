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
| API利用規約 | https://kkj.go.jp （要確認） | https://www.jgrants-portal.go.jp/open-api |
| ライセンス | Apache-2.0 | MIT |
| GitHub | https://github.com/sugukurukabe/koko-call-mcp | https://github.com/digital-go-jp/jgrants-mcp-server |
| MCP仕様準拠 | 2025-11-25 | 2025-11-25 |
| データ更新頻度 | KKJ API準拠（リアルタイム寄り） | Jグランツ API準拠 |
| データ保存 | なし（一時取得・即廃棄） | なし（一時取得・即廃棄） |

**重要**: いずれのサーバーも結果は参考情報です。入札参加・補助金申請の前に必ず一次資料を確認してください。

---

## ツール対応表 / Tool Reference / Referensi Alat

### 入札系 — JP Bids MCP

| ツール | 目的 | Tier |
|---|---|---|
| `search_bids` | キーワード・地域・業種で入札案件を検索 | Free |
| `rank_bids` | 自社プロファイルでスコアリング | Free |
| `list_recent_bids` | 直近公告一覧 | Free |
| `get_bid_detail` | 案件詳細 | Free |
| `search_bids_app` | MCP Apps UIで検索・操作 | Pro |
| `explain_bid_fit` | 適合度の詳細説明 | Pro |
| `assess_bid_qualification` | 参加資格確認 | Pro |
| `extract_bid_requirements` | PDF/HTML仕様書から要件を抽出 | Pro |
| `export_bid_shortlist` | CSV/JSONエクスポート | Pro |
| `create_bid_calendar` | 締切ICSカレンダー | Pro |
| `create_bid_review_packet` | 社内検討メモ | Pro |
| `draft_bid_questions` | 質問書ドラフト | Pro |
| `analyze_past_awards` | 落札実績分析 | Pro |
| `summarize_bids_by_org` | 発注機関別サマリー | Pro |
| `save_search` | 検索条件を保存 | Pro |
| `check_saved_search` | 保存検索の新着確認 | Pro |
| `list_saved_searches` | 保存検索の一覧 | Pro |

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
`rank_bids` → `create_bid_review_packet` で入札戦略を立てる。

```
IT補助金の申請期限を確認してから、AIシステム開発の入札案件を絞り込んでください。
```

### パターン3：過去落札実績との交差分析

`analyze_past_awards` で業種別の落札金額分布を確認し、
`get_subsidy_overview` で同業種に使える補助金の統計を取得。
ファンディング全体像のレポートを生成する。

```
清掃業務の落札実績と、同カテゴリで使える補助金の概況を合わせてレポートしてください。
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
