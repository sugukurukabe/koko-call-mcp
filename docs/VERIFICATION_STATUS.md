# JP Bids MCP 検証状況と既知の問題 / Verification Status & Known Limitations

更新日: 2026-11-20 JST / 本番稼働・公開版: `0.10.2`（Cloudflare エッジ `mcp.bid-jp.com` + Cloud Run `jp-bids-mcp-00091-jiq` @ `100%` / `npmjs.org` `jp-bids-mcp@0.10.2` / 公式 MCP Registry `io.github.sugukurukabe/jp-bids@0.10.2`）

> **English Summary**: `v0.10.2` (Cloud Run `jp-bids-mcp-00091-jiq`, commit `dfb62b9`, image `sha256:30a66f90...051a539e3c`) is live at 100% traffic behind the Cloudflare Edge Gateway (`jp-bids-edge-gateway` proxied on `https://mcp.bid-jp.com`, SSL/TLS Full (strict), `NRT` PoP), with Firestore Native TTL `ACTIVE` across all 5 OAuth collections, published on npm (`jp-bids-mcp@0.10.2` with Sigstore SLSA provenance) and the Official MCP Registry (`io.github.sugukurukabe/jp-bids@0.10.2`). Automated unit/safety/gateway/Gate 1 checks and live authenticated OAuth PKCE S256 + MCP E2E probes through Cloudflare (`server: cloudflare`, `/feedback`, `tools/list` 7 tools, `resources/read` 699,730 bytes UI, 0 leaked `X-Jpbids-*` headers, 0 KKJ calls, `5xx = 0`) have passed. Interactive Claude/ChatGPT UI walkthrough recordings on `0.10.2` and external Anthropic/OpenAI directory submissions remain tracked separately from the earlier `2026-10-21`/`2026-10-24` reference records below.

実装されている機能、固定データおよびローカル模擬ブラウザによる自動テスト、過去版での実クライアント確認、および `0.10.2` 本番稼働・Cloudflare エッジ切替後の検証済み範囲・未実施事項を厳密に分けて記録します。説明書は[こちら](./USER_GUIDE.ja.md)、機能の入出力・制約は[機能仕様書](./FUNCTIONAL_SPEC.md)、エッジ運用とカットオーバー記録は[Cloudflare運用プレイブック](./cloudflare-edge-mcp-playbook.md)、承認境界と残課題は[承認境界マトリクス](../JP_BIDS_CLIENT_ACCEPTANCE_APPROVAL_MATRIX_v1.0.md)を参照してください。

> **`0.10.2` 本番稼働・Cloudflare エッジ検証状態の正確な区別（2026-11-20 JST 更新）**:
> `0.10.2`（Cloud Build `86284d60-4f64-43b6-9a0b-8438d3f9d3e1`、イメージ `sha256:30a66f905691ed3fc63bfe2ea0e88c496c3e0bfd910c9b93f4f0f3051a539e3c`）は Cloud Run リビジョン **`jp-bids-mcp-00091-jiq`** として **100% 配備完了**（旧 `0.10.1` リビジョン `jp-bids-mcp-00087-kam` はロールバック用として保持）し、前段に Cloudflare Workers エッジゲートウェイ **`jp-bids-edge-gateway`**（`mcp.bid-jp.com/*` Proxied / SSL `Full (strict)` / `NRT` PoP）をカットオーバー済みです。また Firestore Native TTL は OAuth 全5コレクションで `ACTIVE`、npm（`jp-bids-mcp@0.10.2`・Sigstore Provenance `logIndex=4003356750`）・GitHub Release `v0.10.2`・公式 MCP Registry（`0.10.2`）への公開を完了しています。エッジ経由の本番スモーク試験（`/health`・`/readyz`・`server-card.json` `0.10.2`・`/feedback`・OAuth DCR + PKCE S256・`tools/list` 公開7ツール・`resources/read` 699,730 bytes、実 KKJ 通信 0 回）において `server: cloudflare`、`cf-ray: ...-NRT`、`X-Jpbids-*` 内部ヘッダー漏洩 `0` 件、Analytics Engine テレメトリ到達、および Cloud Logging `5xx = 0` 件を確認済みです。一方、**実 Claude / 実 ChatGPT 画面上での `0.10.2` 対話操作録画および外部ディレクトリ提出（OpenAI / Anthropic）は別工程で管理**しており、以下の過去版実機記録を現行版の実ホスト受入証拠として流用しません。

## 【過去版参考実績】本番Claudeで確認した範囲（2026-10-21 JST）

| 操作 | 確認内容 | 証拠の範囲 |
| --- | --- | --- |
| カスタム接続 | 正規URL `https://mcp.bid-jp.com/mcp` でOAuth認可、7ツールの認識 | 接続・プロトコル確認と実クライアントの確認 |
| `search_bids_app` | 実公告の検索とAI Bid Workspaceの初期表示 | 実公告を表示した画面。全UI操作の確認ではない |
| `get_bid_detail` | 検索で得た署名付きスナップショットの復元 | 公式公告の本文を再取得・照合したという意味ではない |
| UIの「選択CSV」 | 日本学術振興会・防衛省の2案件を選び、CSVファイルを取得 | 2026-10-21 JST。16列として解析でき、選択案件・機関・理由の対応を確認 |

## 本番ChatGPT（開発者モード）で確認した範囲

対象配備: Cloud Runリビジョン `jp-bids-mcp-manual-export-20261024`（コミット `9afe0c6ffb1ec18930c1b358d43ecec784ff7da7`、イメージdigest `sha256:3eb275f02f164d975d1790a5e1043461005e044b0b57c905ab38d0ec8bdb46e9`）

| 操作 | 確認内容 | 証拠の範囲 |
| --- | --- | --- |
| `search_bids_app` | 実公告の検索とAI Bid Workspaceの表示 | 2026-10-24 JST。サンドボックスiframe内での描画を確認 |
| UIの「選択CSV」（手動取得欄） | 2案件を選択して「選択CSV」を実行し、`CSV 手動取得欄 (2件)` からコピーして16列CSVを保存 | 2026-10-24 JST。ヘッダー16列・データ2行、選択案件・機関・評価理由の対応を確認。保存時の文字コードは貼り付け先エディタの設定に依存 |

上記の実機結果は、既存の画面・取得ファイル・実行報告に基づく記録です。UI内部で受信した生JSON-RPC応答と保存ファイルの完全バイト一致までを証明するものではありません。また、上流公告データに未収録の項目（`procedure_type`、`tender_submission_deadline`、`opening_tenders_event`）は空欄のまま出力されます。

順位付け・要件抽出・CSV出力については、検索条件を各ツールへ指定した独立検索モードの実行報告もあります。これは、同じ `bid_refs` を引き継ぎ再検索なしで一連操作を完了した試験とは区別します。

## 固定データとMCPプロトコルの自動テスト

公開リポジトリ（`SUGUKURU-CO-LTD/jp-bids-mcp`、Public版 `0.10.0`）のコミット `9afe0c6ffb1ec18930c1b358d43ecec784ff7da7` 時点では28ファイル・222テスト（公開 `main` `4a3ca72` 時点では28ファイル・224テスト、ローカル是正候補 `0fa2e9b` / `f8363c0` では29ファイル・229テスト）の成功を確認しています。また、本公開候補ツリー（`public-candidate-20261117-v6`、`sugukurukabe/koko-call-mcp` ベース、版数 `0.10.1`）では `npm run check`（43テストファイル・305テスト合格）、オフライン Gate 1 受入試験（35条件：オフライン構造検査・Node VM 起動検査・ローカルヘッドレスブラウザ UI 13項目実操作）、`PUBLIC-V5-F01` 子孫プロセス確実回収プローブ（5条件：`/proc` 走査＋`JP_BIDS_OWNED_STEP_TOKEN`＋隔離PGID＋`timeout_flag` 完遂検証）、および Cloud Shell Stage 1/Stage 2 オフライン模擬試験（42シナリオ：標準v1＋正規v2 `Service GET` `etag`・単調増加時計期限付き非同期 `Operation` 追跡・`trafficStatuses` 収束・接続先固定化・子孫プロセス回収を含む）が外部通信 0 回で通過しています。

- `multi-organization-parity.test.ts`（公開リポジトリ `SUGUKURU-CO-LTD/jp-bids-mcp` 側）: 複数の発注機関を含む固定データで、機関名・評価理由の対応と配列順を変えた場合の混入の有無を検査。
- `csv-pipeline-fidelity.test.ts`（公開リポジトリ `SUGUKURU-CO-LTD/jp-bids-mcp` 側）: MCP SDKのClientとInMemoryTransportを使用。検索モード・選択モードのCSVについて、ヘッダーと各行の16列、件数、案件Key、機関と理由の対応を検査。連続実行と選択モードでの検索呼出0回も検査。
- `manual-export-fallback.test.ts` / `export-fallback-races.test.ts` / `search-results-lifecycle.test.ts`: `downloadFile` およびクリップボード失敗時の `ManualExportPanel` フォールバック、16列/21列CSVおよびJSON検証、非同期競合（`isStale` ガードによる古い操作・チャット・クリップボード完了結果の破棄）、および `strict: true` 下での初期化・再試行ライフサイクルを検査。
- ユニットテスト内のBOM付与はUI処理の検証であり、実ブラウザ・OSクリップボードの挙動とは区別します。

[PR #14](https://github.com/SUGUKURU-CO-LTD/jp-bids-mcp/pull/14) · [マージ後CI](https://github.com/SUGUKURU-CO-LTD/jp-bids-mcp/actions/runs/39462427037) · [マージ後CodeQL](https://github.com/SUGUKURU-CO-LTD/jp-bids-mcp/actions/runs/39462427061)

## 既知の問題と未確認事項

| 項目 | 状態 | 利用・調査上の扱い |
| --- | --- | --- |
| 過去の環境省行で、理由が財務省となっていた不整合 | 原因未確定。固定データ試験では再現せず | 生応答とチャット表示を独立比較できないため、サーバー・AIクライアントのどちらが原因か断定しない |
| 過去の1件CSVの取得経緯 | 未確認 | 通信・表示・保存のどの経路だったか推定で補わない |
| 直接ツール呼出に非対応のホスト | コード上、チャット依頼または操作文コピーへ分岐 | 依頼送信通知だけでCSV取得完了としない。すべてのホストでの実機確認は未実施 |
| 全件CSV、全UI操作、すべての保存・コピー分岐 | 本番の全経路確認は未実施 | 2件の選択CSV取得から成功範囲を拡張しない |
| 発注機関の公式原本本文照合・添付資料本文の抽出 | 今回の本番検証の範囲外 | URLの到達性や資料URLの特定を、本文照合・抽出成功として扱わない |
| 現行本番リモート接続での他クライアント利用 | 未確認 | 過去のChatGPTモック試験と分ける |
| 過去の実KKJ通信の工程累計 | 未確定 | 最終成功実行の通信数を工程全体の通信数に置き換えない |
| 旧接続で4ツール、新規接続で7ツールとなった差 | 原因未確定 | 個別接続の確認結果を、外部ディレクトリ全体の不具合と断定しない |

不整合が見つかったCSVは業務判断に使わず、元ファイルと選択状態を保全して報告してください。「不具合修正済み」「全経路合格」という表現は使用していません。

## 過去のモック実証と正式受入

公開リポジトリ側の[技術Showcase](https://github.com/SUGUKURU-CO-LTD/jp-bids-mcp/blob/main/docs/showcase/README.md)（※本ローカルリポジトリ `sugukurukabe/koko-call-mcp` には `docs/showcase/` 未収録）は、ローカルフィクスチャを使ったClaude Desktop・ChatGPTの過去の実証記録を含みます。現行本番接続での実公告検証とは別です。

正式Gate 1の35条件は別管理の受入計画です。本ページの実機確認やCI成功をもって、その全条件が完了したとは判定していません。なお、`docs/audit/JP_BIDS_MCP_COMPREHENSIVE_AUDIT_PACKET_20261102_v1.2.md` は過去時点の監査提出物をSHA-256固定の保全証跡として無改変のまま保持しているものであり、同文書内の旧GCPプロジェクト／旧リビジョン表記は現行本番（`ssw-compass-prod-494613` / `jp-bids-mcp-manual-export-20261024`）の正本ではありません。

## 更新ルール

新しい結果には、日付、クライアント・接続、対象バージョンまたはコミット、操作、証拠、確認範囲を記載します。コードから確認した仕様と、実機で確認した挙動を分けます。利用者の個人情報、認証情報、署名付き参照を公開証拠に含めません。
