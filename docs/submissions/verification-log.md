# 申請証跡・検証ログ / Submission Verification Log (`v0.10.1` Candidate)
# Log Bukti Verifikasi Pengajuan (Kandidat `v0.10.1`)

> 本記録は Anthropic Connectors Directory / OpenAI ChatGPT Apps の申請準備監査およびリリース証跡として使用する。**ローカル自動・模擬ブラウザ検証範囲**、**過去版での本番実機確認範囲**、および**現時点の未確認・未提出事項**を厳密に区別して記載する（詳細は [`../VERIFICATION_STATUS.md`](../VERIFICATION_STATUS.md) および [`../../JP_BIDS_CLIENT_ACCEPTANCE_APPROVAL_MATRIX_v1.0.md`](../../JP_BIDS_CLIENT_ACCEPTANCE_APPROVAL_MATRIX_v1.0.md) を参照）。

---

## 1. `v0.10.1` 候補 ローカル品質・プロトコル・模擬ブラウザ UI・Cloud Shell 検証 (`public_mvp` 公開7ツール)

- **対象候補バージョン**: `0.10.1`（未公開 / `JP_BIDS_PROFILE=public_mvp` 公開7ツール / ※ `npmjs.org` 既公開版は `0.10.0`）
- **実行時SDKとMCPプロトコル対応範囲**:
  - `@modelcontextprotocol/sdk@1.32.2`（宣言 `^1.32.1`、ネイティブ `2025-11-25` 対応）＋ `@modelcontextprotocol/ext-apps@1.7.4`
  - `src/transports/http.ts` のステートレスHTTP境界アダプターにより `2026-07-28` リクエスト契約（単一JSON-RPCオブジェクト、`Mcp-Session-Id` / `initialize` 拒否、`params._meta["io.modelcontextprotocol/protocolVersion"] === "2026-07-28"` 必須、`Mcp-Method` 一致、メソッド別 `Mcp-Name` 検証：`tools/call`・`prompts/get` は `params.name`、`resources/read` 等は `params.uri`）を検証・中継（SDK v2 ネイティブ拡張は未実装として区別）
- **OpenAI パッケージローカル検査結果**:
  - 6ファイル構成ZIP（`207,977` bytes, `sha256: df318aac9852847178b208f8891280c1122d3fa4f612113cc2a8783f0baae24e` — 実測正本 `evidence/openai-validation-report.json`）、ローカル構造・画像・ZIP検査 `65/65` 通過
  - 判定ステータス: **`LOCAL_PARTIAL_VALIDATION_WITH_SCHEMA_WARNING_NOT_SUBMITTED`**（警告 **`CORE_MCP_OPENAI_EXTENSION_MISMATCH`** あり。ポータル互換性・提出完了・審査合格とは別）
- **依存脆弱性監査の紐付け**:
  - 対象ロックファイル: `candidate-repo/package-lock.json`（版数 `0.10.1`、解決依存ツリーは 2026-11-16 JST 監査済み `20bef7f` CI run `43852898469` と同一構成）
  - 監査コマンド: `NPM_CONFIG_UPDATE_NOTIFIER=false NO_UPDATE_NOTIFIER=1 npm audit --omit=dev`（2026-11-16 時点オンライン実行結果 `0` 件の転用。本是正工程では外部通信 `0` 回のため、公開承認後のプリフライトでオンライン再照合を実施する）

### 実行コマンド（外部通信 0 回）

```bash
export NPM_CONFIG_UPDATE_NOTIFIER=false
export NO_UPDATE_NOTIFIER=1

# 1. Lint + Typecheck + Server/UI Single-File Build + Vitest 全テスト + APIドキュメント整合
npm run check
npm run docs:check

# 2. マニフェスト・バージョン整合検証 (0.10.1)
npm run registry:validate
npm run release:parity

# 3. OpenAI 6ファイルZIP ローカル構造・PNG検査 (LOCAL_PARTIAL_VALIDATION_WITH_SCHEMA_WARNING_NOT_SUBMITTED)
node scripts/build-openai-package.mjs

# 4. Gate 1 オフライン受入試験ランナー (T01〜T10 全35サブ条件: Node VM起動検査 + ローカル模擬ブラウザ13項目含む)
node --import ./evidence/q02_batch2/net-guard.batch2.path-null-fix.mjs tests/acceptance/gate1-runner.mjs

# 5. Cloud Shell Stage 1 / Stage 2 オフライン模擬試験 (16シナリオ PASS・外部通信0件)
node --import ./evidence/q02_batch2/net-guard.batch2.path-null-fix.mjs ../cloudshell/run-offline-cloudshell-sim.mjs
```

---

## 2. 本番リモート実機検証記録の境界（過去版実績と `0.10.1` 未実施事項の分離）

> **重要**: 本 `0.10.1` 候補ビルドについては、外部通信 `0` 回方針のため **Cloud Run 配備・本番照会（`UNCONFIRMED_NOT_QUERIED`）および実 Claude / 実 ChatGPT クライアント上での実機表示・操作確認（`NOT_EXECUTED_ON_0_10_1`）はいずれも未実施**です。以下の 2.1・2.2 は過去版時点の参考記録であり、`0.10.1` の受入完了証拠として代用しません。

### 2.1 【過去版参考記録】本番 Claude カスタムコネクタ確認（実施日: 2026-10-21 JST）
- **接続先**: `https://mcp.bid-jp.com/mcp`（過去版稼働時点）
- **当時の確認範囲**: OAuth 2.0 認可、7ツール認識、`search_bids_app` 初期表示、`get_bid_detail` スナップショット復元、UI「選択CSV」による2案件（日本学術振興会・防衛省）の16列CSV取得。

### 2.2 【過去版参考記録】本番 ChatGPT 開発者モード確認（実施日: 2026-10-24 JST）
- **対象配備**: Cloud Run リビジョン `jp-bids-mcp-manual-export-20261024`（過去コミット `9afe0c6ffb1ec18930c1b358d43ecec784ff7da7`）
- **当時の確認範囲**: サンドボックス iframe 内での `search_bids_app` 表示、および2案件選択後の `CSV 手動取得欄 (2件)`（`ManualExportPanel`）経由での16列CSV取得。

---

## 3. `0.10.1` 本番昇格承認後の最終スモーク確認テンプレート（未実施・承認後用）

再監査合格および管理者の明示的承認後、[`docs/GO_LIVE_TODAY_RUNBOOK.md`](../GO_LIVE_TODAY_RUNBOOK.md) の Stage 1（`0%` 配備・16項目自動検証）および Stage 2（`100%` 昇格・16項目自動検証）完了後に、実クライアントおよび最小実KKJクエリ（合計5リクエスト以内・`1 req/sec` 厳守）で以下を確認・記録する：

| # | 確認項目 / プロンプト例 | 期待する動作 |
|---|---|---|
| 1 | 実 Claude / 実 ChatGPT での OAuth 接続 & `tools/list` | 公開7ツールのみが認識され、`title`, `outputSchema`, `annotations` が読み取られる |
| 2 | `東京都・役務で件名に「システム」を含む公告を最大3件検索して AI Bid Workspace を表示して` | `0.10.1` の `search_bids_app`（`sha256: 92532dfb...`）が描画され、カード一覧とKKJ出典が表示される |
| 3 | `最初の案件の bid_ref で詳細と公式URLを確認して` | `get_bid_detail` がスナップショット復元し、`resource_link` 付きで公式URLを返す |
| 4 | `先頭2件の bid_ref を使って「保守」優先でランク付けして` | `rank_bids` が選択2件のみを採点し、別案件を混入させない |
| 5 | `同じ2件の順序を保ったまま16列CSVに出力して` | `export_bid_shortlist`（およびUI「選択CSV」）で16列CSVが取得できる |

---

## 4. 仕様境界に関する正確な補足メモ

1. **公開プロファイルの非課金境界 (`public_mvp`)**: リポジトリ内にはローカル開発プロファイル（`JP_BIDS_PROFILE=full_local`）向けに `src/lib/billing.ts` および `package.json` の `stripe` 依存が残存しているが、`JP_BIDS_PROFILE=public_mvp` では課金ツール・Proキー判定・フリーミアム誘導は登録されず、実行時の Stripe 通信もゼロであり、公開7ツールはすべて無料で提供される。
2. **外部文書本文取得は既定OFF (`JP_BIDS_DOCUMENT_EXTRACTION=off`)**: 公開エンドポイントでは添付PDFや外部HTMLの本文ダウンロードは行わず、公告メタデータの構造化と公式URLの案内に限定している（原本PDFは一切保存しない）。
3. **上流KKJレート制限**: インスタンスあたり既定 `1 req/sec` のトークンバケット制御と10分間のメモリ内LRUキャッシュにより、官公需情報ポータルサイトへの過剰アクセスを防止している。
4. **MCP Apps 非対応ホストへの配慮**: `search_bids_app` は UI リソース（`ui://jp-bids/search-results.html`）と同時にテキスト要約と `structuredContent` を返すため、UI非対応クライアントでも全情報を利用できる。
