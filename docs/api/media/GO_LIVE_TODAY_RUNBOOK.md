# JP Bids MCP `v0.10.1` — 段階的本番配備・公開運用ランブック (Stage 1 / Stage 2 Production & Release Runbook)

> **稼働状況メモ（2026-11-20 JST）**: 本書は `v0.10.1` 公開時の 2段階 Cloud Run 昇格手順書です。その後 **`v0.10.2`**（Cloud Run `jp-bids-mcp-00091-jiq` @ 100%、Firestore Native TTL 全5コレクション `ACTIVE`、npm `jp-bids-mcp@0.10.2`、公式 MCP Registry `0.10.2`）および前段の **Cloudflare Workers エッジゲートウェイ (`mcp.bid-jp.com`)** のカットオーバーまで完了しています。エッジ運用・ロールバック手順は [`./cloudflare-edge-mcp-playbook.md`](./cloudflare-edge-mcp-playbook.md)、最新の検証状態は [`./VERIFICATION_STATUS.md`](./VERIFICATION_STATUS.md) を参照してください。

> **重要（承認境界と前提条件）**:
> 1. **本書は独立再監査完了および管理者の明示的承認後にのみ実行する正式手順書です。** 本書の整備自体は Cloud Shell / GCP 照会、Cloud Build、Cloud Run 配備・トラフィック切替、`git push`、タグ push、`npm publish`、外部ディレクトリ提出の承認を意味しません。
> 2. 過去の `v11`（コミット `f8363c0` / `jp-bids-mcp-r8-f8363c0-a7ad36fb14c53c57`）に対する `0%` 配備1回承認は本候補（`0.10.1`）へ流用できません。また、既存の Stage 2 読取由来調査（v4 差戻し `F01`〜`F03` → v5 是正指示）を継続する場合はその完了が前提であり、本書を使って由来確認や固定切替条件を迂回してはなりません。
> 3. `npmjs.org` には既に **`jp-bids-mcp@0.10.0` が公開済み**です。本候補はリモート・npm・各種マニフェストのすべてを未公開の新バージョン **`0.10.1`** に一本化しています（`v0.10.0` タグの再作成・強制更新・再公開は行いません）。
> 4. 本候補作成時点では外部通信を **0回** に制限しているため、現在の Cloud Run 実稼働リビジョン・`generation`・タグ状態および新規ビルドのコンテナ image `sha256` digest は **`UNCONFIRMED_NOT_QUERIED`（未照会・未確定）** です。実行時に下記 Stage 1 スクリプトが実測・固定します。

- **対象バージョン**: `0.10.1` (`JP_BIDS_PROFILE=public_mvp`・公開7ツール＋AI Bid Workspace UI)
- **本番エンドポイント**: `https://mcp.bid-jp.com/mcp`
- **承認境界正本**: [`JP_BIDS_CLIENT_ACCEPTANCE_APPROVAL_MATRIX_v1.0.md`](../JP_BIDS_CLIENT_ACCEPTANCE_APPROVAL_MATRIX_v1.0.md)

---

## Step 0: ローカル最終プリフライト（外部通信 0 回で実行可能）

```bash
export NPM_CONFIG_UPDATE_NOTIFIER=false
export NO_UPDATE_NOTIFIER=1

# 1. Lint + Typecheck + Server/UI 単一HTMLビルド + 全ユニットテスト + APIドキュメント差分検査
npm run check
npm run docs:check

# 2. v0.10.1 全マニフェスト・レジストリ整合検査
npm run registry:validate
npm run release:parity

# 3. ネットワーク遮断ガード下での Gate 1 受入試験 (35/35 PASS: VM起動 + ローカルヘッドレスブラウザ13項目含む)
node --import ./evidence/q02_batch2/net-guard.batch2.path-null-fix.mjs tests/acceptance/gate1-runner.mjs

# 4. Cloud Shell Stage 1 / Stage 2 スクリプトのオフライン全シナリオ模擬試験 (外部通信0件)
node --import ./evidence/q02_batch2/net-guard.batch2.path-null-fix.mjs ../cloudshell/run-offline-cloudshell-sim.mjs

# 5. OpenAI 6ファイルZIP構造検査 & npm 配布tarball内容確認
# ※ OpenAI検査器は LOCAL_PARTIAL_VALIDATION_WITH_SCHEMA_WARNING_NOT_SUBMITTED
#    および CORE_MCP_OPENAI_EXTENSION_MISMATCH 警告を正直に出力します（提出完了・審査合格とは別です）。
node scripts/build-openai-package.mjs
npm pack --dry-run --ignore-scripts
```

---

## Step 1: 【要承認: Gate 4A-1】`0.10.1` コミット & `main` ブランチ push（タグ付与なし）

独立再監査合格および管理者の Gate 4A-1 承認後に実行します（まだ `v0.10.1` タグは付けません）。

```bash
# 1. 変更ファイル確認（秘密値・大容量PDF/XMLが含まれないことを確認）
git status --short

# 2. 0.10.1 変更をコミットし、TARGET_SHA を控える
git add -A
git commit -m "release: JP Bids MCP v0.10.1 protocol contract, browser UI gate, and two-stage Cloud Run safety"
TARGET_SHA="$(git rev-parse HEAD)"
echo "Pinned TARGET_SHA=${TARGET_SHA}"

# 3. main ブランチへ通常 push し、GitHub Actions ci.yml 全ジョブ通過を確認する
git push origin HEAD:main
```

- ローカルでビルド済みの `dist/apps/search-results.html` の SHA-256（`EXPECTED_UI_HTML_SHA256`）を控え、GitHub Actions `ci.yml` が `TARGET_SHA` に対して成功したことを確認してから Step 2 へ進みます。

---

## Step 2: 【要承認: Gate 4B-Stage 1】Cloud Run `0%` 候補配備・設定前後照合・16項目検証

管理者の Stage 1 配備承認後、Cloud Shell（または認証済み環境）で **`cloudshell/stage1-deploy-0pct-candidate.sh`** を実行します。

### Stage 1 スクリプトが行う安全制御（本番トラフィック変更 0 回）
1. **稼働状態の明示的固定**: `gcloud run services describe --format=json` を `cloudrun-state-guard.mjs pre-stage1` で解析し、配列添字に依存せず **`percent === 100` が唯一存在するリビジョン**（`prev100Revision`）と既存の全トラフィックタグ・URL・`generation`・Runtime SA・Secret参照・リソース制限を `pre-stage1-service-snapshot.json` に固定します。
2. **クリーン clone と不変 image digest 固定**: 空ディレクトリへ `TARGET_SHA` を直接 checkout（失敗時は GCP 変更 0 回で停止）し、`gcloud builds submit --format=json` から不変の `sha256:<64-hex>`（`BUILT_IMAGE_DIGEST`）を抽出します（失敗時は Cloud Run 変更 0 回で停止）。
3. **決定論的リビジョン名での `--no-traffic` 配備**: `--image="${IMAGE_REPO}@${BUILT_IMAGE_DIGEST}" --revision-suffix="${CAND_REVISION_SUFFIX}" --no-traffic --tag="${CAND_TAG}"` で `0%` 配備します。**応答不明・非ゼロ終了時は再送もトラフィック変更も行わず、1回だけ状態照会して `phase-journal.json` に `OUTCOME_UNKNOWN_HALTED` を記録して停止します。**
4. **設定・Secret参照・SA・全タグの前後一致証明**: `post-stage1-diff` により、`prev100Revision` が引き続き `100%` であること、競合リビジョンが混入していないこと、Runtime SA・Secret参照・環境変数ハッシュ・既存全タグが 100% 保持されていることを `stage1-config-preservation-diff.json` に証明します。
5. **実KKJ通信 0 回の 16項目ランタイム検証とレシート封印**: `verify-cloudrun-candidate.mjs` が候補タグURLに対して `/health`・`/readyz`・`/stats`（版数 `0.10.1`）・`server-card.json`（7ツール）・OAuth 不正拒否（未認証401・偽造Bearer 401・誤PKCE 400）・正当 DCR＋PKCE `S256` 認可（`Cache-Control: no-store`）・認証付き MCP `2025-11-25` & `2026-07-28`（7ツール一致＋`resources/read` `ui://jp-bids/search-results.html` の SHA-256 一致）を検査し、全16項目合格時のみ `stage1-verified-receipt.json` を SHA-256 整合ハッシュ付きで封印します。

```bash
export GCP_PROJECT="ssw-compass-prod-494613"   # 実運用プロジェクトIDを確認して設定
export GCP_REGION="asia-northeast1"
export SERVICE_NAME="jp-bids-mcp"
export IMAGE_REPO="asia-northeast1-docker.pkg.dev/${GCP_PROJECT}/cloud-run-source-deploy/${SERVICE_NAME}"
export TARGET_SHA="<Step 1で確定した40桁コミットSHA>"
export EXPECTED_UI_HTML_SHA256="<dist/apps/search-results.html の64桁SHA-256>"
export STAGE1_WORK_DIR="$HOME/jp-bids-stage1-${TARGET_SHA:0:12}"

bash ./cloudshell/stage1-deploy-0pct-candidate.sh \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --service="$SERVICE_NAME" \
  --repo-url="https://github.com/sugukurukabe/koko-call-mcp.git" \
  --target-sha="$TARGET_SHA" \
  --image-repo="$IMAGE_REPO" \
  --candidate-suffix="v0101-${TARGET_SHA:0:8}" \
  --candidate-tag="cand-v0101" \
  --expected-version="0.10.1" \
  --expected-ui-sha256="$EXPECTED_UI_HTML_SHA256" \
  --work-dir="$STAGE1_WORK_DIR"
```

- 実行後、`$STAGE1_WORK_DIR/stage1-verified-receipt.json` と `$STAGE1_WORK_DIR/stage1-config-preservation-diff.json` を確認し、**Stage 2 昇格の個別承認**を得てから Step 3 へ進みます。

---

## Step 3: 【要承認: Gate 4B-Stage 2】検証済み候補の `100%` 昇格と所有権確認付き復帰制御

Stage 1 封印レシートの鮮度内（既定900秒以内、期限切れ時は Stage 1 検証を再取得）に、**`cloudshell/stage2-promote-verified-candidate.sh`** を実行します。

### Stage 2 スクリプトが行う安全制御
1. **API 接続先固定（`https://run.googleapis.com`）と厳格な期限引数・直前ゲート（`pre-stage2-gate`）**: 本番経路では `https://run.googleapis.com` のみを許可し、任意の API 上書き指定（`--cloudrun-api-base`・`CLOUDRUN_API_BASE`）は `gcloud auth print-access-token` 呼出前に非ゼロ停止します。`--max-age-seconds` / `MAX_AGE_SECONDS` が `[1, 86400]` の有限正整数であることを検証した上、v1（`gcloud run services describe`）と正規 Cloud Run v2 `Service GET` の双方を取得し、`name`・`uid`・`generation`・`observedGeneration`・`reconciling === false`・`trafficStatuses` 収束・トップレベル不透明 `etag`・全タグ・image `sha256` digest・SA・Secret参照一致を検査し、候補URLへ16項目ランタイム検証を再実行します。1つでも不一致があれば **変更 0 回で停止**します。
2. **Cloud Run v2 `services.patch`（正規 `etag` 前提条件付き）と単調増加時計期限付き非同期 `Operation` 追跡**: レシートに固定された候補リビジョン名（`<CAND_REVISION>=100`）と全保持タグ、v2 `Service GET` 由来の `etag` を含む JSON ペイロードを `https://run.googleapis.com/v2/...` へ `--rpc-timeout-seconds` 上限内で送信し、応答を `Operation` として解析・名前検証した上で、単調増加時計に基づく共通期限（`--op-timeout-seconds`）内で sleep・トークン取得・`curl --max-time`（250ms 子プロセス終了猶予付き）・応答後期限再確認を行う読取専用 poll を実行します。`409`/`412` 競合時は第三者状態を一切上書きせず `CONCURRENT_MODIFICATION_ABORTED` で停止し、`Operation.error` / タイムアウト / 期限後応答 / poll 障害 / 応答不明時は再送も盲目的ロールバックも行わず停止します。
3. **`trafficStatuses` 収束確認・双方16項目検証・同一契約の上限1回ロールバック**: `Operation.done === true && !Operation.error` 後に最新の v2 `Service GET` で `observedGeneration >= generation`、非 `reconciling`、および `trafficStatuses`（実サービング状態）が `CAND_REVISION=100` に収束したことを確認した上で、`CAND_URL` と `https://mcp.bid-jp.com` の双方で全16項目検証を実行します。万一失敗した場合は v1＋v2 双方で第三者変更がないことを確認し、同一の `etag` 前提条件付き `services.patch`＋`Operation` 追跡＋`trafficStatuses` 収束照合により最大1回のみ `prev100Revision=100` へ復帰します（両シェルとも `phase-journal.json` 書込失敗時は変更RPCを送出せず停止し、変更後の記録失敗時は `UNKNOWN_OR_MAY_HAVE_STARTED` として非ゼロ停止します）。

```bash
export STAGE2_WORK_DIR="${STAGE1_WORK_DIR}/stage2"

bash ./cloudshell/stage2-promote-verified-candidate.sh \
  --receipt="${STAGE1_WORK_DIR}/stage1-verified-receipt.json" \
  --production-url="https://mcp.bid-jp.com" \
  --max-receipt-age-seconds=900 \
  --work-dir="$STAGE2_WORK_DIR"
```

- 完了後、`$STAGE2_WORK_DIR/stage2-promotion-complete.json` に `FINAL_OUTCOME: "PROMOTED_AND_VERIFIED"` が記録されていることを確認します。
- 続けて **Gate 2（実クライアント確認）** として、実際の Claude および ChatGPT から `https://mcp.bid-jp.com/mcp` へ接続し、`0.10.1` での `search_bids_app`（AI Bid Workspace）描画・選択2件16列CSV出力を実機確認して [`docs/VERIFICATION_STATUS.md`](./VERIFICATION_STATUS.md) に記録します。

---

## Step 4: 【要承認: Gate 4A-2 / 4C / 4D】`v0.10.1` npm 公開・MCP Registry・スキル配布

Stage 2 本番稼働確認後、管理者の公開承認を得て実施します。

```bash
# 1. オンライン環境で最新の脆弱性DBと照合 (Critical 0 / High 0 を再確認して日時を記録)
NPM_CONFIG_UPDATE_NOTIFIER=false NO_UPDATE_NOTIFIER=1 npm audit --omit=dev

# 2. 未公開版 v0.10.1 タグを作成して push
# (.github/workflows/release.yml がタグ一致と npm view jp-bids-mcp@0.10.1 の E404 未公開を検証した上で
#  release:gate -> npm publish --access public --provenance --ignore-scripts を実行)
git tag v0.10.1 "$TARGET_SHA"
git push origin v0.10.1

# 3. 公式 MCP Registry (io.github.sugukurukabe/jp-bids) を 0.10.1 に更新
mcp-publisher login github
npm run registry:validate
mcp-publisher publish

# 4. GitHub Release v0.10.1 に Claude 用スキルZIPを添付
gh release upload v0.10.1 \
  artifacts/skills/searching-japanese-bids.zip \
  --clobber
```

---

## Step 5: 【要承認・手動対応: Gate 4D】外部ディレクトリ提出と残課題解消

### 5.1 OpenAI ChatGPT Apps Directory 提出前の必須解消事項（未完了の残課題）

ローカルの `node scripts/build-openai-package.mjs`（6ファイルZIP・65項目構造/画像検査）は **`LOCAL_PARTIAL_VALIDATION_WITH_SCHEMA_WARNING_NOT_SUBMITTED`** であり、コアプラグインスキーマと OpenAI 拡張フィールドの差異に関する警告 **`CORE_MCP_OPENAI_EXTENSION_MISMATCH`** を伴います。これはローカル構造検査であり、OpenAI ポータルでの互換性・提出完了・審査合格を意味しません。提出前に必ず代表者・担当者本人が以下を完了してください（詳細: [`docs/submissions/chatgpt-apps-submission-checklist.md`](./submissions/chatgpt-apps-submission-checklist.md) / [`docs/submissions/chatgpt-app-submission-instructions.md`](./submissions/chatgpt-app-submission-instructions.md)）：

1. **KKJ 二次利用・第三者提供条件の公式根拠確認（`OAI-01/04`）**: [`docs/submissions/OPENAI_SUBMISSION_LOCAL_PREPARATION_20261021.md`](./submissions/OPENAI_SUBMISSION_LOCAL_PREPARATION_20261021.md) に従い根拠を確認・記録する。
2. **Organization / Business Verification**: `https://platform.openai.com`（Global data residency プロジェクト）で `スグクル株式会社 / Sugukuru Inc.` の法人・本人確認（Persona ID）を完了する（ブラウザ自動操作不可）。
3. **ドメイン所有チャレンジ検証**: App Draft 作成時に発行されるトークンを `OPENAI_APPS_CHALLENGE_TOKEN` に設定し、`https://mcp.bid-jp.com/.well-known/openai-apps-challenge` の一致検証を完了する。
4. **`0.10.1` 実ホスト画面キャプチャ・Web/モバイル操作動画の準備**: `0.10.1` 本番稼働後に実 ChatGPT Developer Mode でスクリーンショットおよびウォークスルー動画を撮影する（過去版の実績で代用しない）。
5. **提出と Case ID 記録**: 提出完了後に発行される **Case ID** を [`docs/submissions/mcp-directories.md`](./submissions/mcp-directories.md) に記録する。

### 5.2 Anthropic Connectors Directory 更新・提出

1. `0.10.1` 本番稼働後、実 Claude.ai カスタムコネクタで公開7ツールと `AI Bid Workspace` の動作を確認する。
2. [`docs/submissions/anthropic-connector-checklist.md`](./submissions/anthropic-connector-checklist.md) の `0.10.1` 記載内容に基づき提出・更新し、提出日と確認証跡を [`docs/submissions/mcp-directories.md`](./submissions/mcp-directories.md) に記録する。
