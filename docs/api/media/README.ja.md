# JP Bids MCP — 日本語ガイド (v0.10.1)

[![Smithery](https://smithery.ai/badge/a-kabe-1qio/jp-bids-mcp)](https://smithery.ai/servers/a-kabe-1qio/jp-bids-mcp)

## 概要 / Overview / Gambaran Umum

**JP Bids MCP (v0.10.1)** は、中小企業庁「官公需情報ポータルサイト（KKJ）」の公開入札公告を、普段お使いのAI（Claude / ChatGPT など）との会話だけで**検索・比較・公式資料URL確認・検討用CSV出力**できるサービスです。**インストール不要・会員登録不要・完全無料（公開7ツール）**で利用できます。

JP Bids MCP (`v0.10.1`) connects Claude, ChatGPT, and MCP clients to Japan's SME Agency public procurement portal (KKJ) with **7 free, read-centric tools** and an interactive **AI Bid Workspace** UI.

JP Bids MCP (`v0.10.1`) menghubungkan Claude, ChatGPT, dan klien MCP ke portal pengadaan pemerintah Jepang (KKJ) dengan **7 alat gratis & read-centric** serta antarmuka **AI Bid Workspace**.

> **完全無料・読み取り専用 (`public_mvp`) / Free & Read-Only**<br>
> アカウント作成・クレジットカード登録・有料プランなしで、公開7ツールすべてを無料で利用できます。リポジトリ内にはローカル開発プロファイル（`full_local`）向けに `src/lib/billing.ts` と `stripe` 依存が残存していますが、`public_mvp` では課金ツール・Proキー判定・実行時 Stripe 通信は一切行わず、代理入札・外部書き込みも行いません（※AIクライアント自体の利用料は除きます）。

---

## 60秒で始める 1クリック接続（インストール不要・無料）

プログラミングやアプリのインストールは不要です。以下の公開URLを **Claude** または **ChatGPT** に追加するだけで始められます。

```text
https://mcp.bid-jp.com/mcp
```

### 1. Claude（Claude.ai / Claude Desktop）で接続する（3ステップ）
1. Claudeを開き、**「設定（またはカスタマイズ） → コネクタ（Connectors）」** を開きます。
2. **「カスタムコネクタを追加」** を押し、名前に `JP Bids`、URLに `https://mcp.bid-jp.com/mcp` を入力します。
3. 表示される同意画面で **「許可する / Allow」** を1クリックすれば接続完了です（パスワード登録不要・OAuth 2.0 PKCE自動認可）。

### 2. ChatGPT（Apps / コネクタ対応プラン）で接続する（3ステップ）
1. ChatGPTの **「設定（Settings） → アプリ / コネクタ（Apps / Connectors）」** を開きます。
2. MCPサーバーURLに `https://mcp.bid-jp.com/mcp` を入力し、認証方式に **OAuth 2.0** を選択します。
3. 同意画面で **「許可する / Allow」** を1クリックすると、7つの入札調査ツールと対話型画面（AI Bid Workspace）が有効になります。

>詳しい画面操作やトラブル対処は **[使用説明書 (USER_GUIDE.ja.md)](docs/USER_GUIDE.ja.md)** をご覧ください。

---

## そのままコピーして使える質問例（検索 → 比較 → 公式URL確認 → 16列CSV出力）

接続後、チャット欄にそのまま貼り付けて話しかけてください。

### ① 案件を探して画面（AI Bid Workspace）で一覧表示する
```text
東京都・役務で、件名に「システム」を含む入札公告を最大5件検索して、AI Bid Workspaceを表示してください。
```
→ 対話型パネル（`search_bids_app`）が開き、優先度バッジ・締切日・発注機関を一覧で確認できます。

### ② 気になる候補だけを選んで比較・優先度付けする
```text
今の検索結果から選んだ案件を、「クラウド」「保守」を重視して比較・ランク付けしてください。別の案件へ入れ替えないでください。
```
→ 署名付き参照（`bid_ref`）により選んだ案件だけを0〜100点で比較し、検討理由と確認リスクを整理します（`rank_bids`）。

### ③ 公式公告URL・添付資料リンクと要件を確認する
```text
最初の案件の詳細と公式公告URL、確認すべき参加資格・提出期限のチェックリストを出してください。
```
→ 公式ポータル・発注機関のURLとメタデータ要件を整理します（`get_bid_detail` / `extract_bid_requirements`）。

### ④ 社内共有・Excel管理用に16列CSVで出力する
```text
選んだ案件の順序を保ったまま、16列の検討用CSVに出力してください。
```
→ 画面の **「選択CSV」** ボタン（または `export_bid_shortlist`）で、ファイル保存・クリップボードコピー・手動取得欄の3段階フォールバックにより確実にCSV / JSONを受け取れます。

---

## Claude用「入札調査スキル」を1クリックで追加する（任意）

Claudeが日本の都道府県名・調達区分（`物品` / `工事` / `役務`）・署名付き `bid_ref` の引き継ぎをより的確に行えるよう、公式スキルパックを用意しています。

1. リリース配布物の **`searching-japanese-bids.zip`** を取得します（または [`skills/searching-japanese-bids/`](skills/searching-japanese-bids/) フォルダをZIP圧縮します）。
2. **Claude.ai → 設定（Settings） → 機能（Features） → スキル（Skills） → 「スキルをアップロード（Upload skill）」** を開きます。
3. `searching-japanese-bids.zip` を選択するだけで設定完了です。

---

## 公開7ツール一覧（Public MVP `v0.10.1`）

| ツール | できること | プロファイル |
|---|---|---|
| `search_bids` | キーワード・都道府県・調達区分（物品/工事/役務）・期間で公告を検索 | Public MVP（無料） |
| `list_recent_bids` | 直近1〜30日間に公告された新着案件の一覧を取得 | Public MVP（無料） |
| `get_bid_detail` | 案件の詳細情報と公式公告ページ・仕様書リンクを取得（`bid_ref` 対応） | Public MVP（無料） |
| `rank_bids` | 選択案件または検索結果を自社キーワード・期限余裕で比較採点 | Public MVP（無料） |
| `extract_bid_requirements` | 公告メタデータから参加資格・期限・確認資料URLを整理（外部本文取得は既定OFF） | Public MVP（無料） |
| `export_bid_shortlist` | 選択順序を保持した16列CSVまたはJSONで候補リストを出力 | Public MVP（無料） |
| `search_bids_app` | 対話型UIパネル **AI Bid Workspace** (`ui://jp-bids/search-results.html`) で検索・選択・CSV出力 | Public MVP（無料） |

## 料金 / Pricing / Harga

| プラン | 料金 | 内容 |
|---|---|---|
| **Public MVP (`v0.10.1`)** | **無料 (Free)** | 公開7ツールすべて＋AI Bid Workspace UI（会員登録・有料プラン・実行時Stripe通信なし） |

---

## 相互運用（補助金・会計との組み合わせ）

- **[Jグランツ MCP](https://github.com/digital-go-jp/jgrants-mcp-server)（デジタル庁）との併用**: 「鹿児島県のIT調達案件と、中小企業向けDX補助金を同時に探して」のように入札と補助金を1つの会話で横断調査できます。設定例: [`examples/jgrants-integration/`](examples/jgrants-integration/) ／ 詳細: [`docs/integrations/jgrants.md`](docs/integrations/jgrants.md)
- **[freee MCP](https://www.npmjs.com/package/freee-mcp)（freee株式会社）との併用**: 入札調査から落札後の取引・請求管理まで連携できます。設定例: [`examples/freee-integration/`](examples/freee-integration/)

> JP Bids MCP・Jグランツ MCP・freee MCPはそれぞれ独立した運営主体のサービスです。

---

## 開発者・ローカル環境向けセットアップ（Developer / Local Setup）

```text
リモートMCP: https://mcp.bid-jp.com/mcp
候補バージョン: 0.10.1（※ npmjs.org 既公開版は jp-bids-mcp@0.10.0）
MCP Registry名: io.github.sugukurukabe/jp-bids
```

> リモートエンドポイント（`https://mcp.bid-jp.com/mcp`）は OAuth 2.0 必須です（未認証リクエストには `401` と `WWW-Authenticate` メタデータURLを返却）。ローカル開発やCLIから認証なしで利用する場合は、以下のローカル `stdio` 経路を使用してください。

### 1. `npx` によるローカル stdio 起動・CLI出力（認証不要）

```bash
# MCP stdio サーバー起動（既定プロファイル: public_mvp 7ツール）
npx --yes jp-bids-mcp

# CLIから直接CSVエクスポート
npx --yes jp-bids-export --prefecture 鹿児島県 --category 役務 --query システム > bids.csv
```

`claude_desktop_config.json` で公開npmパッケージを使う場合：

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

### 2. ソースビルドとローカル開発プロファイル（`full_local`）

リポジトリをクローンしてビルドする場合：

```bash
git clone https://github.com/sugukurukabe/koko-call-mcp.git
cd koko-call-mcp
npm install
npm run build
```

- **通常ローカル起動 (`node dist/server.js`)**: `TokenBucketRateLimiter`（既定 `<= 1 req/sec`）、添付PDF非保存、`stderr` 専用ログでKKJ検索APIへ接続します。
- **開発者用フルプロファイル (`JP_BIDS_PROFILE=full_local`)**: 自己ホスト・ローカル検証限定で、ICSカレンダー出力・社内検討パック・質問書ドラフト・保存検索・Investor Radar（上場銘柄名寄せ）を含む全22ツールが有効になります（詳細: [`docs/investor-radar.md`](docs/investor-radar.md)）。

### 3. オフラインモック検証・受入試験（M1〜M3-B / Gate 1）

外部KKJ APIへ一切通信せずに Claude Desktop 上の UI 描画・双方向通信（M1〜M3-B）や Gate 1 ローカル受入試験（35条件）を再現できます（本番Claude・ChatGPTでの検証記録は [`docs/VERIFICATION_STATUS.md`](docs/VERIFICATION_STATUS.md) を参照）：

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
# ネットワーク遮断ガード下での Gate 1 受入ランナー実行（全35条件・外部通信0件）
node --import ./evidence/q02_batch2/net-guard.batch2.path-null-fix.mjs tests/acceptance/gate1-runner.mjs
```

### 4. メタデータと仕様対応 (`v0.10.1`)

1. **MCPプロトコル対応**: `@modelcontextprotocol/sdk@1.32.2`（`2025-11-25` ネイティブ）および MCP Apps (`2026-01-26` / `@modelcontextprotocol/ext-apps@1.7.4`) を基盤とし、`src/transports/http.ts` のステートレスHTTP境界アダプターにより `2026-07-28` リクエスト契約（`_meta` 版数一致・`Mcp-Method`・メソッド別 `Mcp-Name` 検証）および RFC 9207 `iss` に対応（詳細: [`docs/spec-notes/mcp-2026-07-28.md`](docs/spec-notes/mcp-2026-07-28.md)）。
2. **公式 MCP Registry 定義 (`server.json`)**: `$schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json"` に準拠（`io.github.sugukurukabe/jp-bids`）。
3. **Server Card ディスカバリ (`public/.well-known/mcp/server-card.json`)**: 公開7ツールのスキーマ・OAuth設定・`_meta.ui` バインディングを提供。

---

## データ出典・免責事項・ポリシー

- **データ出典**: 中小企業庁 官公需情報ポータルサイト 検索API（`https://www.kkj.go.jp/s/help/notes/`）。
- **サービス提供者**: スグクル株式会社（政府機関・中小企業庁の公式製品ではありません）。本サーバーは添付PDF原本を保存せず、代理応募・入札手続きも行いません。応札判断の前に必ず発注機関の公式調達書類原本をご確認ください。
- [機能仕様書](docs/FUNCTIONAL_SPEC.md) · [検証状況](docs/VERIFICATION_STATUS.md) · [プライバシーポリシー](https://mcp.bid-jp.com/privacy) · [利用規約](https://mcp.bid-jp.com/terms)
