# OpenAI ChatGPT Apps 申請 — 壁さん向け実施手順

> 正本（全フィールド・判断根拠）は [`chatgpt-apps-submission-checklist.md`](./chatgpt-apps-submission-checklist.md)。矛盾があればそちらを優先する。
> このファイルは「壁さんが実際に画面を見ながら何をクリックするか」を時系列で並べたもの。
>
> **Claude for Chromeのようなブラウザ自動操作エージェントには渡さない。** 本人確認（Persona ID verification / 法人確認）を含むため、最初から最後まで壁さん本人がログインして操作する。

---

## 事前に決まっていること（前提）

- 提出前のブロッカー管理正本は [`OPENAI_SUBMISSION_LOCAL_PREPARATION_20261021.md`](./OPENAI_SUBMISSION_LOCAL_PREPARATION_20261021.md)（特に OAI-01/04: KKJ二次利用条件の公式根拠確認）。
- ローカルの `node scripts/build-openai-package.mjs`（6ファイル構成ZIP・65項目構造/画像検査）は **`LOCAL_PARTIAL_VALIDATION_WITH_SCHEMA_WARNING_NOT_SUBMITTED`**（警告 **`CORE_MCP_OPENAI_EXTENSION_MISMATCH`** 付き）であり、ポータル互換性・提出完了・審査合格を意味しない。`v0.10.2` 本番サーバー（Cloudflare エッジ + Cloud Run `jp-bids-mcp-00091-jiq`）は稼働済みだが、本手順（法人確認・ドメイン検証・`0.10.2` 実ホスト画面/動画取得・提出・Case ID 記録）は未完了の残課題である。
- 提出範囲は **`public_mvp` プロファイルの公開7ツール**（`search_bids` / `list_recent_bids` / `get_bid_detail` / `search_bids_app` / `rank_bids` / `extract_bid_requirements` / `export_bid_shortlist`）。リポジトリ内にはローカル開発（`full_local`）向けに `src/lib/billing.ts` と `stripe` 依存が残存しているが、`public_mvp` プロファイルでは課金ツール・Pro API キー・アップグレード誘導は登録されず実行時 Stripe 通信もゼロであり、公開7ツールはすべて完全無料・読み取り専用である。
- ドメイン検証エンドポイント `GET /.well-known/openai-apps-challenge` は実装済み。デプロイ時に `OPENAI_APPS_CHALLENGE_TOKEN` 環境変数を設定すればトークンを返す。
- 認証方式は **OAuth 2.0（PKCE + Dynamic Client Registration、アカウント登録不要の1クリック同意画面）** を使用する（詳細は checklist §4）。

---

## ステップ1: 本人確認・組織確認（Organization Verification）

1. `https://platform.openai.com` にログイン。
2. 左メニュー Settings → Organization → General を開く。
3. 「スグクル株式会社 / Sugukuru Inc.」の法人名義で公開したいので **Business verification** を選ぶ。
   - 求められる情報の例: 法人名、登記情報、代表者情報、担当者の身分証（Persona経由）。
   - 数日かかる場合があるとの報告あり。早めに着手する。
4. 完了したら Verifications タブで「Verified」ステータスと、確認された正式名称（フォームにそのまま使う名称）をメモしておく。
5. 使っているプロジェクトが **Global data residency** であることを確認する（EU data residencyのプロジェクトはApp提出不可）。EUのプロジェクトしかなければ、Dashboardから新規プロジェクト（Global）を作成する。

---

## ステップ2: App Draftの作成とMCPサーバー接続

1. Dashboard → Apps → 「Create App」（または類似ボタン）。
2. MCP Server URLに `https://mcp.bid-jp.com/mcp` を入力。
3. **ドメイン検証**が要求されたら:
   a. 画面に表示されたトークン文字列をコピーする。
   b. Cloud Runのサービス設定で環境変数 `OPENAI_APPS_CHALLENGE_TOKEN` にそのトークンをセットして即座に再デプロイする（`gcloud run services update jp-bids-mcp --region=asia-northeast1 --update-env-vars=OPENAI_APPS_CHALLENGE_TOKEN=<コピーした値>`）。
   c. デプロイ完了を待つ（`curl https://mcp.bid-jp.com/.well-known/openai-apps-challenge` でトークンがそのまま返ることを確認）。
   d. ダッシュボードに戻り、フォームを開いたまま「Verify Domain」を押す。**フォームを閉じずに素早く行う**（トークンはこの申請フローの間だけ有効な使い捨て値）。
   e. 検証が終わったら、環境変数を戻す/消しても構わない（次回の申請や更新時にまた別トークンが発行される）。

---

## ステップ3: 認証方式の設定と Scan Tools

1. ダッシュボードの認証設定画面で **OAuth 2.0** を選択する（Dynamic Client Registration 対応。静的 `client_id` が必須の場合は `/oauth/register` エンドポイントで発行可能）。
2. OAuth 同意画面（`/oauth/authorize`）で「許可する」を1クリックし、接続を完了させる。
3. **Scan Tools** を実行する。公開7ツール（`search_bids` / `list_recent_bids` / `get_bid_detail` / `search_bids_app` / `rank_bids` / `extract_bid_requirements` / `export_bid_shortlist`）が検出されることを確認する。

---

## ステップ4: App Info・スクリーンショット・動画の入力

`chatgpt-apps-submission-checklist.md` §6〜8 と `docs/submissions/chatgpt-app-submission.json`（および `plugins/jp-bids-mcp/`）を見ながら、以下を用意・入力する。

1. **App Info**: `chatgpt-app-submission.json` の `app_info` フィールドを入力（display_name, subtitle, description, category）。
2. **ロゴ / アイコン**: `plugins/jp-bids-mcp/assets/` 内の検証済みアイコン（`node scripts/build-openai-package.mjs` で `artifacts/openai-package/` にパッケージ化可能）を使用する。
3. **スクリーンショット**: ChatGPT Developer Modeで `https://mcp.bid-jp.com/mcp` を接続し、checklist §7 の公開7ツール・UIワークスペース画面をキャプチャする（幅706px目安）。
4. **動画**: checklist §8 のスクリプト通りにChatGPT web版とモバイル版で操作を録画し、YouTube限定公開かGoogle Driveにアップロードしてリンクを控える。
5. **Test cases**: `chatgpt-app-submission.json` の `test_cases`（5件）・`negative_test_cases`（3件）を、まず自分で実際にChatGPTで試してから、フォームの該当欄に転記する。

このステップで手が止まったら、その時点の画面や質問内容を教えてください。文言の作成やJSON側の調整はこちらで続けられます。

---

## ステップ5: Tool justification の入力

Scan Toolsで公開7ツールの `readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint` が読み取られたら、`chatgpt-app-submission.json` の `justifications` をツールごとにそのまま貼り付ける。

`openWorldHint: true` について指摘や違和感があれば、checklist §5 の説明（MCP公式仕様とOpenAI独自定義の違い）をそのまま審査コメント欄に補足してもよい。もし提出後に「annotation does not match behavior」でリジェクトされた場合は、私に連絡してください。公開7ツールの `openWorldHint` を `false` に変更して再デプロイ・再スキャンします。

---

## ステップ6: コンプライアンス確認・最終提出

1. checklist §10 のチェックボックスを一通り確認する（公開7ツールは完全無料・読み取り専用なので商用取引・課金関連はすべて「該当なし」）。
2. 全項目を入力し終えたら **Submit for review** を押す。
3. 確認メールに記載される **Case ID** を控える。
4. 私に Case ID と提出日を伝えてください。`docs/submissions/mcp-directories.md` の状態表を更新します。

---

## 困ったときは

- ダッシュボードのフィールド名や選択肢が本ドキュメントと違う場合は、意味が一致する欄に読み替えて入力し、判断に迷ったら私に画面のスクリーンショットや文言を共有してください。
- リジェクトメールが届いたら、そのまま本文を共有してください。原因の切り分けと再提出用の修正を一緒に進めます。
