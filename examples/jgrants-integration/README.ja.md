# JP Bids MCP × Jグランツ MCP — 連携ガイド

> **JP Bids MCP** と **Jグランツ MCP** は、それぞれ別組織が運営する独立したサーバーです。
> JP Bids MCPはスグクル株式会社が運営し、中小企業庁の官公需（KKJ）公開APIを使用します。
> Jグランツ MCPはデジタル庁が提供し、Jグランツ公開APIを使用します。
> いずれも決定前に必ず一次資料（公式調達書類・補助金公募要領）を確認してください。

この2つのMCPサーバーを組み合わせることで、LLMホストは日本の公共調達と補助金という「公的資金の両面」をひとつの会話で扱えます。

| サーバー | データソース | 運営 | 答えられること |
|---|---|---|---|
| [JP Bids MCP](https://github.com/sugukurukabe/koko-call-mcp) | KKJ（中小企業庁） | スグクル株式会社 | 「どの入札案件を追うべきか」 |
| [Jグランツ MCP](https://github.com/digital-go-jp/jgrants-mcp-server) | Jグランツ（デジタル庁） | デジタル庁 | 「どの補助金が使えるか」 |

データライセンスはそれぞれ異なります。KKJデータは [官公需情報ポータルサイト ご利用上の注意](https://www.kkj.go.jp/s/help/notes/)、Jグランツデータは [Jグランツ Open API 利用規約](https://www.jgrants-portal.go.jp/open-api) に従ってください。

---

## セットアップ

### 前提条件

- Python 3.11以上（Jグランツ MCPをローカルで起動するため）
- Node.js 20以上（JP Bids MCPのstdioオプションを使う場合）
- MCP対応クライアント：Claude Desktop、Cursor、VS Code MCP拡張など

### 1. Jグランツ MCPサーバーを起動

```bash
git clone https://github.com/digital-go-jp/jgrants-mcp-server.git
cd jgrants-mcp-server
pip install -e .
python -m jgrants_mcp_server.core
# http://127.0.0.1:8000/mcp でStreamable HTTPとして起動
```

### 2. JP Bids MCPを接続（リモート公開7ツール、またはローカル `full_local`）

JP Bids MCPは `https://mcp.bid-jp.com/mcp` でホストされており（`public_mvp`・公開7ツール、OAuth 2.0対応）、ローカル設定不要です。クライアントがStreamable HTTPに対応していない場合は `npx mcp-remote` をstdioブリッジとして使います：

```bash
npx --yes mcp-remote https://mcp.bid-jp.com/mcp
```

ローカル開発用の拡張ツール（`create_bid_review_packet` / `analyze_past_awards` 等）も使う場合は、`JP_BIDS_PROFILE=full_local npx jp-bids-mcp` でローカル起動してください。

### 3. クライアントに両サーバーを登録

このディレクトリの `claude_desktop_config.json`（Claude Desktop用）と `cursor.mcp.json`（Cursor用）をそのまま使えます。

---

## ワークフロー

### ワークフロー1 — 入札案件と補助金を同時探索

**目的**：鹿児島県のITシステム調達案件を探しつつ、利用可能なDX補助金を同時に確認する。

**使用ツール**：`search_bids`（JP Bids）＋ `search_subsidies`（Jグランツ）

**プロンプト例**：

```
鹿児島県のITシステム調達案件を探して、同時に中小企業向けのDX補助金も調べてください。
スコアが高い入札案件と、申請中の補助金の一覧を合わせて教えてください。
```

会話の流れ（想定）：
1. LLMが `search_bids` を呼び出す（`prefecture="鹿児島県"`、`category="役務"`、`query="システム"`）
2. LLMが `search_subsidies` を呼び出す（`keyword="DX"`、`target_number_of_employees="21-50人"`）
3. 両結果を統合し、公的資金獲得機会のサマリーを提示

---

### ワークフロー2 — 補助金で原資を確保してから入札に臨む

**目的**：補助金で費用負担を下げた上で、対象の入札案件を絞り込み、仕様書リンク整理・候補リスト出力（ローカル `full_local` では社内検討メモ生成も可）を行う。

**使用ツール**：`search_subsidies` → `rank_bids` → `extract_bid_requirements` / `export_bid_shortlist`（ローカル `full_local` 利用時は `create_bid_review_packet` も可）

**プロンプト例**：

```
IT補助金で原資を確保した上で、AIシステム開発の入札案件を探してください。
補助金の締切と入札の締切が重ならない組み合わせを提案してください。
```

会話の流れ（想定）：
1. `search_subsidies keyword="AI" acceptance=1`で申請中の補助金を取得
2. `rank_bids query="AI システム開発"` で自社プロファイルによるスコアリング
3. `extract_bid_requirements` / `export_bid_shortlist`（またはローカル `full_local` の `create_bid_review_packet(bid_key=...)`）で補助金情報を組み込んだ検討資料を整理

---

### ワークフロー3 — 過去公告傾向 × 補助金活用の交差分析（ローカル `full_local`）

**目的**：同カテゴリの過去公告傾向と利用可能な補助金の統計を合わせて把握し、計画の参考にする。

**使用ツール**：`analyze_past_awards`（JP Bids・ローカル `JP_BIDS_PROFILE=full_local`）＋ `get_subsidy_overview`（Jグランツ）

**プロンプト例**：

```
清掃業務の過去公告傾向を分析して、同カテゴリで利用可能な補助金との組み合わせを示してください。
```

会話の流れ（想定）：
1. `analyze_past_awards query="清掃" category="役務"` で発注機関別の公告頻度・月次推移を取得
2. `get_subsidy_overview keyword="清掃"` で締切別・金額別の補助金分布を取得
3. LLMが清掃業務カテゴリの公的資金全体像をレポート

---

## ツールリファレンス

### このワークフローで使うJP Bids MCPのツール

| ツール | 説明 | プロファイル |
|---|---|---|
| `search_bids` | キーワード・地域・業種でKKJ案件を検索 | `public_mvp`（公開・無料） |
| `rank_bids` | 自社プロファイルでスコアリング | `public_mvp`（公開・無料） |
| `extract_bid_requirements` | 公式公告・仕様書リンクの整理 | `public_mvp`（公開・無料） |
| `export_bid_shortlist` | CSV/JSON候補リスト出力 | `public_mvp`（公開・無料） |
| `analyze_past_awards` | 過去公告の傾向・発注機関分析 | `full_local`（ローカル開発用） |
| `create_bid_review_packet` | 社内検討メモの自動生成 | `full_local`（ローカル開発用） |

### このワークフローで使うJグランツ MCPのツール

| ツール | 説明 |
|---|---|
| `search_subsidies` | キーワード・業種・地域で補助金を検索 |
| `get_subsidy_detail` | 添付ファイルを含む補助金詳細 |
| `get_subsidy_overview` | 締切・金額別の統計概要 |

出典：[digital-go-jp/jgrants-mcp-server](https://github.com/digital-go-jp/jgrants-mcp-server)

---

## 注意事項

- 両サーバーの結果はあくまで参考情報です。入札参加・補助金申請の判断前に必ず公式書類を確認してください。
- Jグランツ MCPはローカル起動、JP Bids MCPはリモート接続です。2つのサーバーはデータやセッションを共有しません。
- データカバレッジ：KKJは約9,000機関をカバー、Jグランツポータルは国・自治体の補助金を掲載。いずれもすべての公的資金制度を網羅しているわけではありません。
- [MCP仕様書 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — 両サーバーが実装するプロトコル仕様。
