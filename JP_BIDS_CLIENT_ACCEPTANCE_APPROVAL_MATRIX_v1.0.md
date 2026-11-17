# JP Bids MCP — クライアント受入試験・本番昇格・公開承認境界マトリクス（`v0.10.1` 公開候補対応・再監査是正版）

| 項目 | 内容 |
|---|---|
| 文書ID | `JP-BIDS-CLIENT-ACCEPTANCE-APPROVAL-MATRIX-v1.0`（第3.4版 — `v0.10.1` `public-candidate-20261117-v6` 是正版） |
| 版・更新日 | 3.4 / 2026-11-17 JST（`PUBLIC-V5-F01` 是正：`run_bounded_step` における `/proc`＋`JP_BIDS_OWNED_STEP_TOKEN`＋隔離PGID＋`timeout_flag` によるタイムアウト後250ms猶予＋SIGKILL完遂・子孫プロセス確実回収、および `PUBLIC-V4-F01` 単調増加時計期限の実装） |
| 対象候補 | `public-candidate-20261117-v6/candidate-repo`（未公開ターゲット版数 **`0.10.1`** / `JP_BIDS_PROFILE=public_mvp` 公開7ツール） |
| 承認上の位置付け | **本書および本候補パッケージの作成は、本番照会・Cloud Build・Cloud Run配備/切替・`git push`・タグ作成・`npm publish`・Registry更新・外部ディレクトリ提出の承認を意味しない。独立再監査完了および管理者の明示的個別承認まで外部変更・本番通信は 0 回を維持する。** |

---

## 1. 版数・作業ツリー・既公開物・本番未確定項目の対応表（単一正本）

旧文書で混在していた「既公開 npm `0.10.0`」「デスクトップ保存コミット `20bef7f`」「過去の Cloud Run Stage 1 `v11`（`f8363c0`）」「今回の是正候補 `0.10.1`」を以下の通り厳密に分離して識別します。

| 識別対象 | 版数 / 識別子 | 実測値・ロック・アーティファクト整合 | 現在の状態・運用ルール |
|---|---|---|---|
| **既公開 npm パッケージ** (`npmjs.org`) | `jp-bids-mcp@0.10.0` | 既に `registry.npmjs.org` に公開済み（本作業ツリーとは宣言依存・実装が異なる） | **再公開・上書き・`v0.10.0` タグ強制更新は厳禁。** `.github/workflows/release.yml` の事前検査（`npm view` `E404` 必須＋`REQUIRE_NPM_UNPUBLISHED=1`）で既公開版は自動停止（fail-closed） |
| **デスクトップ保存ベースライン** | コミット `20bef7f9de3789b25ca1892b2984e6763ec41689` (`c:\Users\USER\Desktop\koko-call-mcp`) | 版数表記 `0.10.0`（再監査差戻し対象） | **原本保全のため無改変で維持（0変更・0 push）。** 当該コミット付属の旧 Cloud Shell 貼付スクリプトは実行対象から除外済み |
| **過去の Cloud Run Stage 1 配備証跡 (`v11`)** | ソース `f8363c0` / 候補リビジョン **`jp-bids-mcp-r8-f8363c0-a7ad36fb14c53c57`** (`0%`) | 2026-11-15 時点記録: `100%` リビジョンは `jp-bids-mcp-manual-export-20261024`（先頭要素は `0%` の `smoke` タグ `jp-bids-mcp-00048-z5j`） | **`v11` に対する過去の `0%` 配備1回承認は `f8363c0` 専用であり、本候補（`0.10.1`）や `20bef7f` へは一切流用しない。** また既存 Stage 2 読取調査 v4 差戻し（`F01`〜`F03` → v5 是正指示）を本書で迂回しない |
| **今回の是正公開候補** (`public-candidate-20261117-v6`) | 未公開版数 **`0.10.1`** | - `package.json` / `package-lock.json` / `server.json` / `server-card.json` / `.smithery` / `plugin.json`: **`0.10.1`**<br>- 実解決SDK: `@modelcontextprotocol/sdk@1.32.2`（宣言 `^1.32.1`）、`@modelcontextprotocol/ext-apps@1.7.4`<br>- `dist/apps/search-results.html`: `698,668` bytes (`sha256: 92532dfb047ca3cac07968258d58dceba204f432bf11bdf3ae7d3c4c69e4d741`)<br>- OpenAI 6ファイルZIP: `207,977` bytes (`sha256: df318aac9852847178b208f8891280c1122d3fa4f612113cc2a8783f0baae24e`)<br>- Claude Skill 3ファイルZIP: `17,133` bytes (`sha256: 23c2c0ae9b8c04e2c4f9cd460029ff7252092b8c9868b57e81e065f683b1c0c2`) | **配布方針**: 将来管理者が公開を承認した場合は、リモート（Cloud Run / Registry / ディレクトリ）と npm パッケージの双方を未公開の新版 **`0.10.1`**（Gitタグ `v0.10.1`）に統一して公開する（`0.10.0` の再公開は行わない） |
| **現在の本番 Cloud Run 実状態・候補イメージ digest** | `UNCONFIRMED_NOT_QUERIED` | 本是正工程では Cloud Shell / GCP / `https://mcp.bid-jp.com` への照会を **0回** としているため、現時点の稼働リビジョン・`generation`・タグ一覧・新規ビルド image `sha256` digest はすべて **未取得（`UNCONFIRMED_NOT_QUERIED`）** | 推定値で埋めず、承認後の Stage 1 実行時に `cloudrun-state-guard.mjs` で実測・固定する |

---

## 2. 厳守すべき技術・運用ガードレール

1. **ランタイム・コード境界の正確な管理**:
   - `stdout` への `console.log` 出力ゼロ、`any` 使用ゼロ、添付PDF・大規模生XMLの保存/コミットゼロ。
   - KKJ API レート制限（既定 `1 req/sec`、実KKJスモーク実施時も1セッション最大5リクエスト以内、`JP_BIDS_DOCUMENT_EXTRACTION=off`）。
   - **課金コードの正確な境界表記**: リポジトリ内にはローカル開発プロファイル（`JP_BIDS_PROFILE=full_local`）向けに `src/lib/billing.ts` および `package.json` の `stripe` 依存が残存しているが、公開プロファイル `JP_BIDS_PROFILE=public_mvp` では課金ツール・Proキー判定・Stripe API通信は一切登録・実行されず公開7ツールのみが有効となる（「コードベースから完全撤廃」といった事実に反する表現は用いない）。
2. **MCP プロトコル表明と実SDK境界の一致（`PUBLIC-V0100-F01` / `PUBLIC-V2-F04` 対応）**:
   - 実行時SDKは `@modelcontextprotocol/sdk@1.32.2`（ネイティブ `2025-11-25` 実装）であり、`src/transports/http.ts` の境界アダプターにより `2026-07-28` ステートレスHTTP契約（単一JSON-RPCオブジェクト、`Mcp-Session-Id` 拒否、`initialize` 拒否、`params._meta["io.modelcontextprotocol/protocolVersion"] === "2026-07-28"` 必須、`Mcp-Method` 一致、メソッド別 `Mcp-Name` 検証＋Base64 sentinel `=?base64?...?=` 復号、検証失敗時の `JSONRPCErrorResponseSchema` 準拠 `-32020` JSON-RPCエラー応答、未知メソッド `-32601` 時の HTTP `404` 応答）を検証・中継する。SDK v2 ネイティブ機能（`server/discover` 等）は未実装として正直に区別する。
3. **Cloud Run 昇格・復帰の正規 v2 API 契約・単調増加時計期限付き `Operation` 追跡・子孫プロセス確実回収・接続先固定（`PUBLIC-V0100-F02` / `PUBLIC-V2-F01`〜`F03` / `PUBLIC-V3-F01`〜`F03` / `PUBLIC-V4-F01` / `PUBLIC-V5-F01` 対応）**:
   - 配列先頭要素の盲目的参照、最新作成リビジョン名の盲目的昇格、無条件エラーtrapによるトラフィック変更、ロールバック失敗の握り潰し、および v1 `resourceVersion` の流用や本番経路での任意 API 接続先上書きは全面禁止。
   - 接続先オリジンは `https://run.googleapis.com` に固定し、上書き指定（`--cloudrun-api-base` や `CLOUDRUN_API_BASE`）は `gcloud auth print-access-token` 呼出前に即座に拒否する。
   - 配備と昇格は必ず **Stage 1（`cloudshell/stage1-deploy-0pct-candidate.sh`：v1＋v2 `Service GET` 照合・`--rpc-timeout-seconds` 境界・`uid`/正規 `etag` 固定・`0%` 配備・設定前後差分照合・16項目検証・署名レシート封印、トラフィック変更 0回）** と **Stage 2（`cloudshell/stage2-promote-verified-candidate.sh`：厳格な正整数 `max-age-seconds` [1, 86400] 検査・v1＋v2 相互照合・`trafficStatuses` 一致検査・正規 v2 トップレベル `etag` 前提条件付き `services.patch` → 返却 `Operation` の名前検証および単調増加時計に基づく共通期限内での sleep/トークン取得/`curl --max-time`/応答後期限再確認・250ms 子プロセス終了猶予付き poll → `Operation.done === true && !Operation.error` かつ `trafficStatuses` 収束確認 → 候補URL＋本番ドメイン双方の16項目検証 → 同一契約・同一単調期限付き最大1回ロールバック）** に分離し、両シェルとも `phase-journal.json` の書込失敗時は変更RPCを送出せず停止する（変更後の記録失敗時も完了JSONを出さず `UNKNOWN_OR_MAY_HAVE_STARTED` として停止）。

---

## 3. ゲート別承認境界・現在の達成状態・残課題（`v0.10.1` 候補）

| ゲート / 段階 | 許可される操作範囲 | 厳格な禁止事項 | 現在の検証状態 (`0.10.1` 候補) | 固定済み証拠 / 未完了の残課題 |
|---|---|---|---|---|
| **Gate 1<br>【ローカル受入・UI模擬ブラウザ検証】** | - `net-guard.batch2.path-null-fix.mjs` 配下での `gate1-runner.mjs`（T01〜T10 全35サブ条件）実行<br>- Node VM モジュール起動検査＋ローカル `127.0.0.1` ヘッドレスブラウザ（opaque sandbox iframe）による UI 13項目実操作・3種故障注入の負例検査<br>- Cloud Shell Stage 1/Stage 2 スクリプトのオフライン模擬試験 | - 外部インターネット通信（`0` 件厳守）<br>- 構造検査のみを「実描画合格」と誤記すること<br>- ルート要素ID変更のみを故障注入とみなすこと | **[ローカル完了 — 独立再監査待ち]**<br>- Gate 1: `35/35 PASS`（外部通信 `0` 件）<br>- `2026-07-28` プロトコル正例/負例プローブ合格<br>- UI ローカル模擬ブラウザ `13/13 PASS`＋JS先頭 `throw` 等の負例3種すべて検出確認<br>- Cloud Shell オフライン模擬試験 全シナリオ PASS | - `evidence/f01-protocol-probes-after.json`<br>- `evidence/f03-ui-browser-acceptance-after.json`<br>- `evidence/f03-ui-negative-controls-after.json`<br>- `evidence/cloudshell-offline-sim-results.json`<br>- `candidate-repo/evidence/gate1/gate1-summary.json` |
| **Gate 2<br>【実ホスト（Claude / ChatGPT）接続確認】** | - 承認・配備後の候補に対する実 Claude.ai / Claude Desktop / ChatGPT 上での接続・`AI Bid Workspace` 表示・選択CSV確認 | - 過去版（`2026-10-21` / `2026-10-24` の `9afe0c6` 等）の実機記録を、`0.10.1` ビルドの実ホスト受入完了証拠として代用すること | **[未実施 (`NOT_EXECUTED_ON_0_10_1`)]**<br>- ローカルヘッドレスブラウザ模擬ホスト検証のみ完了。**実 ChatGPT / 実 Claude クライアント上での `0.10.1` バンドル検証は未実施の残課題** | - 過去版実績は `docs/VERIFICATION_STATUS.md` に参考記録として分離保持<br>- **残課題**: Stage 1/2 承認後に実ホスト画面確認を実施・記録する |
| **Gate 3<br>【実KKJ API 最小スモーク】** | - 承認後、`JP_BIDS_DOCUMENT_EXTRACTION=off`・`1 req/sec`・最大5リクエスト以内での実KKJ検索・`bid_ref` 詳細・16列CSV確認 | - バースト送信、5回超の試行、添付PDF本文取得・保存 | **[未実施（本工程は実KKJ通信 0回）]** | - **残課題**: 管理者の実通信承認後に5リクエスト以内で実施 |
| **Gate 4A-1<br>【GitHub `0.10.1` コミット & 通常 push】** | - 再監査合格・承認後、`0.10.1` 候補をコミットして `main` へ push し `ci.yml` 通過を確認する | - 未承認での commit / push<br>- タグの同時 push | **[未実施（ローカル別領域で待機）]** | - **残課題**: 再監査合格後の管理者承認 |
| **Gate 4B-Stage 1<br>【Cloud Run `0%` 候補配備・検証】** | - `cloudshell/stage1-deploy-0pct-candidate.sh` による事前状態固定（`percent === 100` 完全一致＋全タグ保持）、クリーン clone、Cloud Build immutable `sha256` digest 抽出、`--no-traffic` リビジョン配備、設定/SA/SecretRef 前後差分照合、16項目ランタイム検証、`stage1-verified-receipt.json` 封印 | - トラフィック切替（Stage 1 では `update-traffic` 0回）<br>- 応答不明時の再送や盲目的ロールバック | **[手順・検証器整備済み / 本番未実行]** | - 実行スクリプト: `cloudshell/stage1-deploy-0pct-candidate.sh`<br>- 検証器: `cloudshell/cloudrun-state-guard.mjs`, `cloudshell/verify-cloudrun-candidate.mjs` |
| **Gate 4B-Stage 2<br>【Cloud Run 検証済み候補 `100%` 昇格】** | - Stage 1 レシート確認・個別承認後、`cloudshell/stage2-promote-verified-candidate.sh` による鮮度・`generation`・競合・全タグ・digest・SA直前照合、単発 `100%` 切替、候補URL＋`https://mcp.bid-jp.com` 双方の16項目検証（失敗時は所有権確認のうえ上限1回のみ旧 `100%` へ復帰し復帰後照合） | - 未検証または競合発生時の昇格<br>- 応答不明時の再送・盲目的復帰<br>- 第三者変更の上書き | **[手順・検証器整備済み / 本番未実行]** | - 実行スクリプト: `cloudshell/stage2-promote-verified-candidate.sh` |
| **Gate 4A-2 & 4C<br>【Gitタグ `v0.10.1` & npm 初回公開】** | - Stage 2 完了確認および個別承認後、未公開の **`v0.10.1`** タグを push し `.github/workflows/release.yml`（タグ一致検査＋`npm view jp-bids-mcp@0.10.1` 未公開確認＋`release:gate` → `npm publish --provenance`）を実行 | - 既公開 **`v0.10.0`** に対するタグ再付与・強制更新・再公開試行 | **[未実施 / ワークフロー安全弁実装済み]** | - `.github/workflows/release.yml` に既公開版 fail-closed 停止ゲートを実装済み |
| **Gate 4D<br>【Registry & ディレクトリ申請】** | - `mcp-publisher publish` (`0.10.1`)<br>- GitHub Release `v0.10.1` への `searching-japanese-bids.zip` 添付<br>- OpenAI ChatGPT Apps / Anthropic Connectors Directory 提出 | - ローカル構造検査（6ファイルZIP・65項目）を「ポータル互換確認済み・審査合格」と誤認・記載すること | **[ローカル資材生成済み / 未提出・残課題あり]** | - **OpenAI 検査状態**: `LOCAL_PARTIAL_VALIDATION_WITH_SCHEMA_WARNING_NOT_SUBMITTED`（警告 `CORE_MCP_OPENAI_EXTENSION_MISMATCH` あり）<br>- **未完了の外部残課題**: ① KKJ二次利用条件根拠確認 (`OAI-01/04`)、② OpenAI Business / 本人確認、③ ドメイン所有チャレンジ検証、④ `0.10.1` 実ホスト画面・録画資料、⑤ 提出 Case ID 取得 |

---

## 4. セキュリティ監査結果の証跡紐付け

- **監査実行日時**: `2026-11-16 JST`（オフラインロックファイル照合および `20bef7f` CI run `43852898469` 記録との対応確認）
- **対象ロックファイル**: `candidate-repo/package-lock.json`（版数 `0.10.1`、依存ツリーは `c:\Users\USER\Desktop\koko-call-mcp\package-lock.json` と同一の解決パッケージ群：`@modelcontextprotocol/sdk@1.32.2`, `@hono/node-server@1.19.13` 等）
- **検査コマンド（オンライン実行時）**: `NPM_CONFIG_UPDATE_NOTIFIER=false NO_UPDATE_NOTIFIER=1 npm audit --omit=dev`（および開発依存込み `npm audit`）
- **注意点**: 本是正作業では外部通信 0 回方針のため `registry.npmjs.org` への新規オンライン脆弱性DB照会は行っておらず、直近オンライン監査時点（2026-11-16、`0` 件）からの転用であることを明記する。公開前プリフライト（オンライン許可後）で再実行して最新アドバイザリDBと照合すること。
