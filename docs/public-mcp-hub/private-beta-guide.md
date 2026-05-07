# Public MCP JP Gateway — Private Beta 検証ガイド
# Public MCP JP Gateway — Private Beta Validation Guide
# Public MCP JP Gateway — Panduan Validasi Private Beta

対象期間 / Target period / Periode target: Week 7-10（MVP完成から約3-4週間後）
目標参加者数 / Target participants / Jumlah peserta target: 5-10名

---

## ベータ参加者プロファイル / Beta Participant Profiles / Profil Peserta Beta

以下のいずれかに該当する方を優先的に招待する:

| プロファイル | 入札経験 | 補助金経験 | freee/MF使用 |
|---|---|---|---|
| 入札担当者（中小企業） | 高 | 低-中 | 任意 |
| 行政書士（公共調達専門） | 高 | 高 | 低 |
| 中小企業経営者 | 中 | 中 | 高 |
| 自治体DX担当 | 高 | 高 | 低 |
| 公共調達SaaS開発者 | 中 | 低 | 低 |
| 派遣会社経理担当 | 低 | 中 | 高（MF利用）|

---

## セットアップ / Setup / Pengaturan

### 1. Gateway をローカルで起動する

```bash
cd gateway
cp .env.example .env   # 環境変数を設定する
npm run dev:http       # http://127.0.0.1:8090/mcp で起動
```

### 必要な環境変数 / Required Environment Variables

`.env.example`:

```
# JP Bids MCP の Pro APIキー
GATEWAY_CHILD_TOKEN_JP_BIDS=your-jp-bids-pro-api-key

# freee OAuth トークン（テスト用 / 環境変数フォールバック）
GATEWAY_CHILD_TOKEN_FREEE=your-freee-oauth-token

# Jグランツ MCP エンドポイント（デフォルト: http://localhost:8000）
# 別途 Jグランツ MCP を起動しておく必要がある
# JGRANTS_MCP_ENDPOINT=http://localhost:8000

# MoneyForward クラウド会計 OAuth トークン
# 標準: X-Mcp-Child-Authorization-moneyforward-ca ヘッダで渡す（下記参照）
# フォールバック（サーバー運用時のみ）: 環境変数で固定値も可
# GATEWAY_CHILD_TOKEN_MONEYFORWARD_CA_OAUTH=your-mf-oauth-token
```

### 2a. MoneyForward アプリポータルの事前設定

MoneyForward クラウド会計 MCP を利用するには、事前にアプリポータルでの設定が必要です。

1. [マネーフォワード クラウド管理コンソール](https://biz-admin.moneyforward.com/app) で「全権管理」権限を持つユーザーでログイン
2. [アプリポータル](https://app-portal.moneyforward.com/) を開き「マネーフォワード IDでログイン」
3. 事業者を選択 → 「ユーザー」 → 連携操作するユーザーをクリック
4. 「編集」→「アプリ連携権限」の「アプリ連携」「クラウド会計・確定申告」にチェック → 「保存」

詳細手順: [マネーフォワード クラウド会計MCPサーバーについて](https://biz.moneyforward.com/support/account/guide/others/ot10.html)

OAuth トークンは MCPクライアント（Cursor / Claude / Gemini CLI）が自動的に取得します。
Gemini CLI を使う場合は alpha endpoint (`https://alpha.mcp.developers.biz.moneyforward.com/mcp/ca/v3`) を使用してください。

### 2b. Cursor で接続する（MoneyForward 含む）

`.cursor/mcp.json` に追加:

```json
{
  "mcpServers": {
    "public-mcp-jp-gateway": {
      "url": "http://127.0.0.1:8090/mcp",
      "headers": {
        "X-Mcp-Child-Authorization-moneyforward-ca": "Bearer <ここにMoneyForwardのOAuthトークン>"
      }
    }
  }
}
```

**セキュリティ注意 / Security note / Catatan keamanan:**
MoneyForward の OAuth アクセストークンは Gateway の監査ログに保存されません。
`actor_hash`（Gateway Pro API キーの SHA-256 ハッシュ）とは完全に別々に扱われ、
Gateway は受け取ったトークンを MoneyForward MCP にそのまま転送するだけです。

### 2c. MoneyForward なしで Cursor で接続する（入札・補助金・農業統計・法人番号のみ）

```json
{
  "mcpServers": {
    "public-mcp-jp-gateway": {
      "url": "http://127.0.0.1:8090/mcp"
    }
  }
}
```

### 3. デモシナリオを実行する

**まず最初に呼ぶツール:**
```
Gatewayで最初に試すべきデモを教えて。get_gateway_demo を使って。
```

**シナリオ A（入札 + 補助金の同時調査）:**
```
鹿児島県のIT関連入札を探し、同時に使えるDX補助金も教えてください。
```

**シナリオ B（月次会計クローズ — 公開 child MCP 貫通フロー）:**
```
鹿児島県の農業/IT案件を探して、使える補助金を確認し、法人番号とMoneyForwardで会計確認するところまで案内してください。実行前に承認が必要な操作は止めて確認してください。
```

> このシナリオには MoneyForward OAuth トークンが必要です。
> X-Mcp-Child-Authorization-moneyforward-ca ヘッダを Cursor の MCP 設定に追加してください。

**シナリオ C（会社プロファイルに合わせた総合分析）:**
```
農業関連のシステム導入案件を分析してください。
会社情報: 業種=農業, 所在地=鹿児島県
```

**シナリオ D（接続確認）:**
```
どのMCPサーバーに接続されていますか？それぞれ使えるツールを教えてください。
```

---

## 計測指標 / Measurement Metrics / Metrik Pengukuran

### 定量指標 / Quantitative Metrics / Metrik Kuantitatif

| 指標 | 測定方法 | 目標値 |
|---|---|---|
| 接続完了率 | セットアップ完了者 / 招待者 | ≥ 70% |
| tool call成功率 | 成功call / 全call | ≥ 80% |
| 複数MCP横断実行回数 | 監査ログから集計 | 週3回以上/ユーザー |
| セッションあたり平均tool call数 | 監査ログから集計 | ≥ 3 |
| 調査時間削減（自己申告） | アンケート | ≥ 50% 削減 |

### 定性指標 / Qualitative Metrics / Metrik Kualitatif

以下の発言が出たかどうかを記録する:

**Go サイン（肯定的）:**
- 「自社の他のデータ（CRMや在庫）もつなぎたい」
- 「チームメンバーにも使わせたい」
- 「月額〇〇円なら払う」
- 「監査ログが出せるなら社内承認を取りやすい」
- 「freeeとの連携は必須」

**No-Go サイン（否定的）:**
- 「JP Bidsだけで十分。Gatewayは必要ない」
- 「設定が複雑すぎる」
- 「freee連携は怖い（データが外に出る感じ）」
- 「結果が信頼できない（一次情報を自分で確認する方が早い）」

---

## アンケート設計 / Survey Design / Desain Survei

ベータ期間終了後に以下を確認する:

### 必須質問 / Required Questions

1. **使用頻度**: Gateway（複数MCP横断）を週に何回使いましたか？
   - 0回 / 1-2回 / 3-5回 / 5回以上

2. **価値実感**: 入札・補助金・会計を同時に調べられることで、作業時間が短縮されましたか？
   - 変わらない / 少し短縮 / かなり短縮（50%以上）

3. **支払い意思**: 以下の機能セットに対して月額いくらまで払えますか？
   - 機能: 入札+補助金並列検索 / 監査ログ / チーム共有 / 組織ポリシー
   - 払わない / 500円 / 1,000円 / 3,000円 / 5,000円以上

4. **追加接続ニーズ**: 他につなぎたいサービスは何ですか？（自由記述）

5. **最大の摩擦**: 使いにくかった点は何でしたか？（自由記述）

---

## Go / No-Go 判断フレームワーク / Go / No-Go Decision Framework

### Go 判定（Enterprise SaaS 化）

以下を3件以上満たす場合:

- [ ] 複数MCP横断実行が週3回以上 / ユーザーの 50%以上で確認
- [ ] 「他のサービスもつなぎたい」という要望が参加者の 30%以上から出る
- [ ] 支払い意思が月額1,000円以上のユーザーが 20%以上
- [ ] 「監査ログ/権限管理があれば社内で使える」という声が出る
- [ ] JP Bids単体との差別化（入札+補助金同時検索）が明確に評価される

### Pivot 判定（連携テンプレート集として畳む）

以下のいずれかが確認された場合:

- [ ] 複数MCP横断実行が週1回未満のユーザーが 80%以上
- [ ] 「JP Bidsだけで十分」が多数意見
- [ ] freee連携でデータ漏洩懸念が強く、接続が忌避される
- [ ] 支払い意思のあるユーザーが参加者の 5%未満

Pivot時の対応: Gateway SaaSの開発は中断し、JP Bids MCP Proの
`examples/jgrants-integration/` と `examples/freee-integration/` を
充実させて「自分でつなぐための設定テンプレート」として提供する。

---

## 運営チェックリスト / Operational Checklist / Daftar Periksa Operasional

### Week 7（Private Beta 開始前）

- [ ] Gateway を Cloud Run にデプロイ（`public-mcp-jp-gateway` サービス）
- [ ] Jグランツ MCP のリモートエンドポイントを設定
- [ ] ベータ参加者 5名以上に招待メール送信
- [ ] Slack チャンネル `#gateway-beta` を作成
- [ ] 監査ログが Cloud Logging に入っていることを確認（`npm run remote:health`）

### Week 8-9（ベータ期間中）

- [ ] 毎週月曜日に監査ログの集計を確認
- [ ] フィードバックが来た日はその日中にSlack で返答
- [ ] バグ報告は 24時間以内に修正 or 回避策を提示

### Week 10（ベータ期間終了）

- [ ] アンケートを送付
- [ ] 監査ログから定量指標を集計
- [ ] Go / No-Go 判断を壁が行う
- [ ] 結果を `docs/public-mcp-hub/beta-results.md` にまとめる

---

## 環境変数リファレンス / Environment Variables Reference

| 変数名 | 必須 | 説明 |
|---|---|---|
| `GATEWAY_JWT_SECRET` | 本番 | JWT署名シークレット（本番必須） |
| `GATEWAY_PRO_API_KEYS` | 任意 | Proキー（カンマ区切り）、未設定=全員Pro |
| `GATEWAY_CHILD_TOKEN_JP_BIDS` | 推奨 | JP Bids MCP用APIキー |
| `GATEWAY_CHILD_TOKEN_FREEE` | freee連携時 | freee OAuthトークン（環境変数フォールバック） |
| `GATEWAY_CHILD_TOKEN_MONEYFORWARD_CA_OAUTH` | 任意 | MF OAuthトークン（ヘッダが優先。サーバー固定運用向け） |
| `ALLOWED_ORIGINS` | 本番 | CORSオリジン許可リスト |
| `PORT` | 任意 | リスニングポート（デフォルト: 8090） |

**MoneyForward の認証について:**
MoneyForward クラウド会計 MCP の OAuth トークンは、原則としてリクエストヘッダ
`X-Mcp-Child-Authorization-moneyforward-ca: Bearer <token>` で渡します。
環境変数 `GATEWAY_CHILD_TOKEN_MONEYFORWARD_CA_OAUTH` はサーバー側で固定トークンを使う場合のフォールバックです。
