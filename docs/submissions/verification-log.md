# 申請証跡・検証ログ / Submission Verification Log (v0.10.0)
# Log Bukti Verifikasi Pengajuan (v0.10.0)

> 本記録は Anthropic Connectors Directory / OpenAI ChatGPT Apps の申請ポータル（"Additional notes" 欄）およびリリース監査証跡として使用する。実機確認範囲とローカル自動検証範囲を厳密に区別して記載する（詳細は [`../VERIFICATION_STATUS.md`](../VERIFICATION_STATUS.md) も参照）。

---

## 1. `v0.10.0` ローカル品質・Gate 1 受入検証 (`public_mvp` 公開7ツール)

- **対象バージョン**: `0.10.0` (`JP_BIDS_PROFILE=public_mvp`, 完全無料・公開7ツール・課金コード非実行)
- **MCP-Protocol-Version**: `2025-11-25`（主基準）および `2026-07-28`（ルーティングヘッダー・RFC 9207 `iss` 対応）

### 実行チェック一覧

```bash
# 1. Lint + Typecheck + Server/UI Single-File Build + Vitest 全テスト
npm run check

# 2. マニフェスト・バージョン整合検証 (package.json / server.json / server-card.json / .smithery / CITATION.cff)
npm run registry:validate
npm run release:parity

# 3. 本番依存セキュリティ監査 (Critical 0 / High 0)
npm audit --omit=dev

# 4. OpenAI 申請パッケージ構造・PNG・スキーマ検証 (65/65 PASS)
node scripts/build-openai-package.mjs

# 5. Gate 1 オフライン受入試験ランナー (T01〜T10 全35サブ条件 PASS・外部通信0件・認証トークン完全マスク)
node --import ./evidence/q02_batch2/net-guard.batch2.path-null-fix.mjs tests/acceptance/gate1-runner.mjs
```

---

## 2. 本番リモート実機検証記録 (`https://mcp.bid-jp.com/mcp`)

### 2.1 本番 Claude カスタムコネクタ確認（実施日: 2026-10-21 JST）

- **接続先**: `https://mcp.bid-jp.com/mcp`（Streamable HTTP + OAuth 2.0 DCR / PKCE S256 1クリック同意）
- **確認済み項目**:
  - ✅ OAuth 2.0 認可完了および公開 **7ツール**（`search_bids`, `list_recent_bids`, `get_bid_detail`, `rank_bids`, `extract_bid_requirements`, `export_bid_shortlist`, `search_bids_app`）の認識
  - ✅ `search_bids_app` による実公告検索と `AI Bid Workspace` パネルの初期描画
  - ✅ `get_bid_detail` による署名付き `bid_ref` スナップショットからの詳細・公式リンク復元
  - ✅ UIの「選択CSV」から異なる発注機関（日本学術振興会・防衛省）の2案件を選択し、16列CSVとして正常取得・列整合を確認

### 2.2 本番 ChatGPT 開発者モード確認（実施日: 2026-10-24 JST）

- **接続先**: `https://mcp.bid-jp.com/mcp`（Cloud Run リビジョン `jp-bids-mcp-manual-export-20261024`）
- **確認済み項目**:
  - ✅ サンドボックス iframe 内での `search_bids_app`（`AI Bid Workspace`）描画
  - ✅ 2案件選択 →「選択CSV」実行 → 3段階フォールバックの `CSV 手動取得欄 (2件)`（`ManualExportPanel`）経由で16列CSVをコピー・保存し、案件Key・発注機関・評価理由の対応を確認

### 2.3 公開メタデータ・ヘルスエンドポイント確認

```text
https://mcp.bid-jp.com/health                                             OK 200 application/json
https://mcp.bid-jp.com/readyz                                             OK 200 application/json
https://mcp.bid-jp.com/privacy                                            OK 200 text/html
https://mcp.bid-jp.com/terms                                              OK 200 text/html
https://mcp.bid-jp.com/favicon.png                                        OK 200 image/png
https://mcp.bid-jp.com/.well-known/mcp/server-card.json                   OK 200 application/json
https://mcp.bid-jp.com/.well-known/agents.json                            OK 200 application/json
https://mcp.bid-jp.com/.well-known/mcp-server.json                        OK 200 application/json
https://mcp.bid-jp.com/.well-known/oauth-protected-resource/mcp           OK 200 application/json
https://mcp.bid-jp.com/.well-known/oauth-authorization-server             OK 200 application/json
```

---

## 3. `v0.10.0` 本番デプロイ後の最終スモーク確認テンプレート

`docs/GO_LIVE_TODAY_RUNBOOK.md` に従い `v0.10.0` を Cloud Run に配備した際、以下の最小クエリ（KKJ API負荷保護のため合計5リクエスト以内・1 req/sec厳守）で確認する：

### MCP Inspector 接続方法（OAuth 自動認可）

```bash
npx --yes @modelcontextprotocol/inspector
# Transport Type: Streamable HTTP
# URL: https://mcp.bid-jp.com/mcp
# OAuth 1クリック同意（「許可する / Allow」）でアクセストークンを自動取得（有料キー・審査専用パスワードは不要）
```

### スモーク確認チェックリスト（公開7ツール）

| # | 確認項目 / プロンプト例 | 期待する動作 |
|---|---|---|
| 1 | `tools/list` 確認 | 公開7ツールのみが返り、全ツールに `title`, `outputSchema`, `annotations` が存在する |
| 2 | `東京都・役務で件名に「システム」を含む公告を最大3件検索して AI Bid Workspace を表示して` | `search_bids_app` が呼ばれ、カード一覧とKKJ出典が表示される（0件時は空状態表示） |
| 3 | `最初の案件の bid_ref で詳細と公式URLを確認して` | `get_bid_detail` がスナップショット復元し、`resource_link` 付きで公式URLを返す |
| 4 | `先頭2件の bid_ref を使って「保守」優先でランク付けして` | `rank_bids` が選択2件のみを採点（0〜100, `priority`）し、別案件を混入させない |
| 5 | `同じ2件の順序を保ったまま16列CSVに出力して` | `export_bid_shortlist`（またはUI「選択CSV」）で16列CSVが取得できる |

---

## 4. 既知の仕様制約（審査補足メモ）

1. **完全無料・課金なし (`public_mvp`)**: 公開7ツールすべて無料で利用でき、有料プラン・フリーミアム誘導・Stripe通信は一切存在しません。
2. **外部文書本文取得は既定OFF (`JP_BIDS_DOCUMENT_EXTRACTION=off`)**: 公開エンドポイントでは添付PDFや外部HTMLの本文ダウンロードは行わず、公告メタデータの構造化と公式URLの案内に限定しています（原本PDFは一切保存しません）。
3. **上流KKJレート制限**: インスタンスあたり既定 `1 req/sec` のトークンバケット制御と10分間のメモリ内LRUキャッシュにより、官公需情報ポータルサイトへの過剰アクセスを防止しています。
4. **MCP Apps 非対応ホストへの配慮**: `search_bids_app` は UI リソース（`ui://jp-bids/search-results.html`）と同時にテキスト要約と `structuredContent` を返すため、UI非対応クライアントでも全情報を利用できます。
