# JP Bids MCP `v0.10.0` — 即日公開・一般ユーザー導入ランブック (Go-Live Today Runbook)

**対象バージョン**: `0.10.0` (`JP_BIDS_PROFILE=public_mvp`・完全無料・公開7ツール＋AI Bid Workspace UI)  
**本番エンドポイント**: `https://mcp.bid-jp.com/mcp`  
**目的**: ローカル検証完了状態から、**① GitHub 反映 → ② Cloud Run 無停止段階デプロイ → ③ npm / MCP Registry / Skill ZIP 公開 → ④ ChatGPT App & Claude Connector 提出** までを最短・安全に今日完了するためのコピペ実行手順書です。

---

## 事前確認（ローカル最終プリフライト — 約10分）

外部反映の前に、ローカルで全チェックがグリーンであることを確認します（KKJ API への実通信は一切発生しません）。

```bash
# 1. Lint + Typecheck + 単一HTMLバンドルビルド + 全テスト + TypeDoc同期
npm run check
npm run docs:api

# 2. v0.10.0 マニフェスト整合 & 本番依存監査 (Critical 0 / High 0)
npm run registry:validate
npm run release:parity
npm audit --omit=dev

# 3. ネットワーク遮断ガード下での Gate 1 受入試験 (35/35 PASS・外部通信0件)
node --import ./evidence/q02_batch2/net-guard.batch2.path-null-fix.mjs tests/acceptance/gate1-runner.mjs

# 4. OpenAI 申請パッケージ検証 (65/65 PASS) & npm 配布tarball内容確認
# (※ npmjs.org には既に jp-bids-mcp@0.10.0 が公開済みのため、ローカルtarball検証には npm pack --dry-run を使用します)
node scripts/build-openai-package.mjs
npm pack --dry-run --ignore-scripts
```

---

## Step 1: `git commit` & `git push`（GitHub Actions `ci.yml` 通過 — 約15分）

> タグはまだ付けません（`v*.*.*` タグ push は `release.yml` 経由で `npm publish` を自動起動するため、Step 3 の注意点を確認してから実施します）。

```bash
# 1. 変更ファイル確認（秘密値・大容量PDF/XML・不要な一時ファイルが含まれないことを確認）
git status --short

# 2. v0.10.0 変更をステージングしてコミット
git add -A
git commit -m "release: JP Bids MCP v0.10.0 Public MVP hardening, 1-click onboarding, and 35/35 Gate 1 proof"

# 3. main ブランチへ push（GitHub Actions ci.yml が自動起動）
git push origin HEAD:main
```

- GitHub Actions の **`ci.yml`** が全ジョブ緑（PASS）で完了したことを確認してから Step 2 へ進みます。

---

## Step 2: Cloud Run 本番デプロイ（`--no-traffic` 検証 → カナリア → 100%切替 — 約30分）

本番トラフィックをいきなり切り替えず、**トラフィック0%のタグ付きURLで公開7ツールとOAuth 2.0を実機検証してから**段階的に切り替えます。

### 2.1 ロールバック用リビジョン名の固定と `--no-traffic` デプロイ

```bash
# 環境に合わせてプロジェクトID・リージョン・サービス名を指定
export GCP_PROJECT="ssw-compass-prod-494613"   # 実運用プロジェクトIDを確認して設定
export GCP_REGION="asia-northeast1"
export SERVICE_NAME="jp-bids-mcp"
export CAND_TAG="cand-v0-10-0"

# 1. 現在の100%稼働リビジョン名を取得して控える（即時ロールバック先）
PREV_REVISION=$(gcloud run services describe "$SERVICE_NAME" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --format='value(status.traffic[0].revisionName)')
echo "Rollback target revision: $PREV_REVISION"

# 2. Cloud Build でコンテナイメージをビルド（dist/apps/search-results.html 同梱）
IMAGE_URI="asia-northeast1-docker.pkg.dev/${GCP_PROJECT}/cloud-run-source-deploy/${SERVICE_NAME}:v0.10.0"
gcloud builds submit --project="$GCP_PROJECT" --tag "$IMAGE_URI" .

# 3. 本番トラフィックを変えずに (--no-traffic) タグ付きリビジョンとして配備
gcloud run deploy "$SERVICE_NAME" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --image="$IMAGE_URI" \
  --no-traffic \
  --tag="$CAND_TAG" \
  --update-env-vars="JP_BIDS_PROFILE=public_mvp,JP_BIDS_DOCUMENT_EXTRACTION=off,JP_BIDS_BASE_URL=https://mcp.bid-jp.com"

# 4. タグ付き検証URLを取得
CAND_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --format="value(status.traffic.filter(tag:${CAND_TAG}).url)")
echo "Candidate URL: $CAND_URL"
```

### 2.2 タグ付きURL（`$CAND_URL`）に対するスモークテスト

```bash
# (a) ヘルスチェック & Ready チェック -> 200 OK
curl -fsS "${CAND_URL}/health"
curl -fsS "${CAND_URL}/readyz"

# (b) OAuth メタデータ確認 -> 200 OK ("S256" 含有)
curl -fsS "${CAND_URL}/.well-known/oauth-protected-resource/mcp"
curl -fsS "${CAND_URL}/.well-known/oauth-authorization-server"

# (c) 未認証 POST /mcp が 401 + WWW-Authenticate を返すことを確認
curl -i -s "${CAND_URL}/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -n 15

# (d) GET /mcp および DELETE /mcp が 405 を返すことを確認
curl -s -o /dev/null -w "GET /mcp -> %{http_code}\n" "${CAND_URL}/mcp"
curl -s -X DELETE -o /dev/null -w "DELETE /mcp -> %{http_code}\n" "${CAND_URL}/mcp"
```

### 2.3 カナリア 10% → 本番 100% 切替（＆緊急ロールバックコマンド）

```bash
# 1. 新リビジョン名を取得
NEW_REVISION=$(gcloud run services describe "$SERVICE_NAME" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --format="value(status.latestCreatedRevisionName)")
echo "New revision: $NEW_REVISION"

# 2. 10% カナリア切替 + 本番ドメインヘルス確認
gcloud run services update-traffic "$SERVICE_NAME" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --to-revisions="${NEW_REVISION}=10,${PREV_REVISION}=90"

JP_BIDS_REMOTE_BASE_URL=https://mcp.bid-jp.com npm run remote:health

# 3. 問題なければ 100% 本番切替
gcloud run services update-traffic "$SERVICE_NAME" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --to-revisions="${NEW_REVISION}=100"

JP_BIDS_REMOTE_BASE_URL=https://mcp.bid-jp.com npm run remote:health
```

> **【異常時の1コマンド即時ロールバック】**:  
> いずれかの確認で異常が見つかった場合は、以下の1コマンドで即座に旧リビジョン100%へ戻せます：
> ```bash
> gcloud run services update-traffic "$SERVICE_NAME" \
>   --project="$GCP_PROJECT" \
>   --region="$GCP_REGION" \
>   --to-revisions="${PREV_REVISION}=100"
> ```

---

## Step 3: MCP Registry・Skill ZIP 配布・npm 次期パッチ（`0.10.1`）公開（約20分）

> **重要な実環境前提（`npmjs.org` 版数重複防止）**:
> - **Cloud Run 本番稼働（Step 2）および OpenAI ChatGPT Apps / Anthropic Connectors Directory 提出（Step 4）は、現行の `0.10.0` のまま今すぐ完結できます**（いずれもリモート `https://mcp.bid-jp.com/mcp` を参照するため npm 再公開を待つ必要はありません）。
> - 一方、公式 `npmjs.org` には既に **`jp-bids-mcp@0.10.0` が公開済み**であり、npm の仕様上同一バージョンへの上書き公開はできません（そのまま `v0.10.0` タグを push すると `release.yml` の `npm publish` がバージョン重複エラーとなります）。
> - したがって、ローカル用の `npx jp-bids-mcp` パッケージまで今回の更新内容で再公開する場合は、パッチ版数を **`0.10.1`** に上げて `v0.10.1` タグを push してください。

### 3A. 今日すぐ実施（`0.10.0` のまま MCP Registry 反映 & GitHub Release 配布物添付）

```bash
# 1. 公式 MCP Registry (io.github.sugukurukabe/jp-bids) のメタデータを更新
mcp-publisher login github
npm run registry:validate
mcp-publisher publish

# 2. GitHub Release に一般ユーザー向け 1クリック配布ファイルを添付（gh CLI 使用例）
# ※ release:gate は dist/ を再生成するため、永続保存先の artifacts/skills/searching-japanese-bids.zip
#   （または再生成後の dist/searching-japanese-bids.zip）を指定します。
gh release upload v0.10.0 \
  artifacts/skills/searching-japanese-bids.zip \
  artifacts/openai-package/jp-bids-submission-candidate-20261022.zip \
  --clobber
```

### 3B. npm パッケージ自体も更新公開する場合（`0.10.1` パッチリリース）

```bash
# 1. package.json / package-lock.json / server.json / src/lib/version.ts / CITATION.cff /
#    public/index.html / public/.well-known/* / .smithery/shttp/manifest.json / plugin.json を 0.10.1 に揃える
npm version 0.10.1 --no-git-tag-version
# (各マニフェストを 0.10.1 に更新後、npm run server-card:generate && npm run release:parity && npm run registry:validate で確認)

# 2. コミットして v0.10.1 タグを push（release.yml が npm publish --provenance を自動実行）
git add -A
git commit -m "chore(release): v0.10.1"
git push origin HEAD:main
git tag v0.10.1
git push origin v0.10.1
```

---

## Step 4: 一般ユーザーが1クリックで使えるようにするディレクトリ提出（約2〜4時間＋審査待機）

### 4.1 OpenAI ChatGPT Apps Directory 提出（6ステップ）

詳細原稿・ツール別 justification は [`docs/submissions/chatgpt-apps-submission-checklist.md`](./submissions/chatgpt-apps-submission-checklist.md) および [`docs/submissions/chatgpt-app-submission-instructions.md`](./submissions/chatgpt-app-submission-instructions.md) に完備しています。**本人確認（Persona ID）を含むため、ブラウザ自動操作を使わず代表者・担当者ご本人が操作してください。**

1. **事前確認（`OAI-01/03/04`）**: KKJ留意事項（`https://www.kkj.go.jp/s/help/notes/`）の根拠記録と `https://mcp.bid-jp.com/privacy` の記載内容を最終確認する。
2. **法人・本人確認（Organization Verification）**: `https://platform.openai.com` → `Settings → Organization → General` で **Business verification**（`スグクル株式会社 / Sugukuru Inc.`）を完了し、対象プロジェクトが **Global data residency** であることを確認する。
3. **App Draft 作成 & ドメイン所有確認**:
   - Dashboard → Apps → Create App で MCP Server URL に `https://mcp.bid-jp.com/mcp` を入力。
   - チャレンジトークンが表示されたら Cloud Run に一時設定して Verify Domain を押す：
     ```bash
     gcloud run services update "$SERVICE_NAME" \
       --project="$GCP_PROJECT" \
       --region="$GCP_REGION" \
       --update-env-vars="OPENAI_APPS_CHALLENGE_TOKEN=<画面に表示されたトークン>"
     curl -fsS https://mcp.bid-jp.com/.well-known/openai-apps-challenge
     ```
4. **OAuth 2.0 設定 & Scan Tools**: 認証方式に **OAuth 2.0**（DCR + PKCE S256、1クリック同意）を選び、`Scan Tools` で公開 **7ツール**（`search_bids`, `list_recent_bids`, `get_bid_detail`, `rank_bids`, `extract_bid_requirements`, `export_bid_shortlist`, `search_bids_app`）が検出されることを確認する。
5. **App Info・画像・動画・テストケース入力**:
   - アイコン: `plugins/jp-bids-mcp/assets/logo.png` (512×512) & `composer-icon.png` (64×64)。
   - スクリーンショット（4〜5枚）および Web版＋モバイル版の1〜2分操作動画URLを添付し、`plugins/jp-bids-mcp/plugin.json` 内のポジティブ5件・ネガティブ3件のテストケースを転記する。
6. **Tool Justifications 貼付 & Submit for review**: `docs/submissions/chatgpt-app-submission.json` の各ツール justification を貼り付け、課金なし（`commerce: false`）を確認して提出し、発行された **Case ID** を [`docs/submissions/mcp-directories.md`](./submissions/mcp-directories.md) に記録する。

### 4.2 Anthropic Connectors Directory 更新・提出

1. Claude Admin / Connectors 提出画面を開く。
2. [`docs/submissions/anthropic-connector-checklist.md`](./submissions/anthropic-connector-checklist.md) の `v0.10.0` 原稿（**完全無料・公開7ツール・1クリックOAuth同意・審査用パスワード不要**）および `docs/submissions/assets/` のスクリーンショット5枚を反映して提出する。
3. 提出日を [`docs/submissions/mcp-directories.md`](./submissions/mcp-directories.md) に記録する。
