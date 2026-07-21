# OpenAI ChatGPT Apps 申請 — 壁さん向け実施手順

> 正本（全フィールド・判断根拠）は [`chatgpt-apps-submission-checklist.md`](./chatgpt-apps-submission-checklist.md)。矛盾があればそちらを優先する。
> このファイルは「壁さんが実際に画面を見ながら何をクリックするか」を時系列で並べたもの。
>
> **Claude for Chromeのようなブラウザ自動操作エージェントには渡さない。** 本人確認（Persona ID verification / 法人確認）を含むため、最初から最後まで壁さん本人がログインして操作する。

---

## 事前に決まっていること（前提）

- 提出範囲は **Freeティア4ツールのみ**（`search_bids` / `rank_bids` / `list_recent_bids` / `get_bid_detail`）。Pro13ツール＋MCP Appは今回対象外。
- ドメイン検証エンドポイント `GET /.well-known/openai-apps-challenge` は実装済み。デプロイ時に `OPENAI_APPS_CHALLENGE_TOKEN` 環境変数を設定すればトークンを返す。
- 認証方式は「固定Bearerトークン（API key的な使い方）」を第一候補とする。ダッシュボードの実際の選択肢を見てから決める（詳細は checklist §4）。

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
4. **Scan Tools** を実行する。4ツール（`search_bids` / `rank_bids` / `list_recent_bids` / `get_bid_detail`）だけが検出されることを確認する。
   - もし17ツール全部やMCP Appまで見えてしまったら、それは接続時の認証がPro tierとして扱われている（OAuthで繋いでしまった等）。ステップ3の認証設定を見直す。

---

## ステップ3: 認証方式の設定

ダッシュボードの認証設定画面を見て、以下のどちらが選べるか確認する。

- **「API Key」「Custom Header」「No special auth（reviewer provides header）」のような選択肢がある場合**（推奨パス）:
  - ヘッダー名: `Authorization`
  - ヘッダー値: `Bearer chatgpt-reviewer-demo`（この文字列は`JP_BIDS_PRO_API_KEYS`に登録していない値なら何でもよい。すでに登録済みでないことを事前に確認）
  - これでFree tierとして4ツールだけが見えるはずです。

- **OAuthしか選べない場合**:
  - 一旦立ち止まって私（AIアシスタント）に相談してください。現状のコードではOAuth接続は自動的にPro tier（全17ツール）になってしまうため、そのまま接続するとスコープ決定（Free4ツールのみ）と矛盾します。コード側の追加対応が必要になります。

---

## ステップ4: App Info・スクリーンショット・動画の入力

`chatgpt-apps-submission-checklist.md` §6〜8 と `docs/submissions/chatgpt-app-submission.json` を見ながら、以下を用意・入力する。

1. **App Info**: `chatgpt-app-submission.json` の `app_info` フィールドをそのまま入力（display_name, subtitle, description, category）。
2. **ロゴ**: 64×64のSVGアイコンを用意する（未用意なら教えてください。既存の `public/favicon.png` から作成できます）。
3. **スクリーンショット**: ChatGPT Developer Modeで実際にこのMCPサーバーを接続し、checklist §7 の4プロンプトを実行してキャプチャする（幅706px目安）。
4. **動画**: checklist §8 のスクリプト通りにChatGPT web版とモバイル版で操作を録画し、YouTube限定公開かGoogle Driveにアップロードしてリンクを控える。
5. **Test cases**: `chatgpt-app-submission.json` の `test_cases`（5件）・`negative_test_cases`（3件）を、まず自分で実際にChatGPTで試してから、フォームの該当欄に転記する。

このステップで手が止まったら、その時点の画面や質問内容を教えてください。文言の作成やJSON側の調整はこちらで続けられます。

---

## ステップ5: Tool justification の入力

Scan Toolsで4ツールの `readOnlyHint` / `destructiveHint` / `openWorldHint` が読み取られたら、`chatgpt-app-submission.json` の `justifications` をツールごとにそのまま貼り付ける。

`openWorldHint: true` について指摘や違和感があれば、checklist §5 の説明（MCP公式仕様とOpenAI独自定義の違い）をそのまま審査コメント欄に補足してもよい。もし提出後に「annotation does not match behavior」でリジェクトされた場合は、私に連絡してください。該当4ファイルの `openWorldHint` を `false` に変更して再デプロイ・再スキャンします。

---

## ステップ6: コンプライアンス確認・最終提出

1. checklist §10 のチェックボックスを一通り確認する（Free4ツールのみなので商用取引・課金関連はすべて「該当なし」でOK）。
2. 全項目を入力し終えたら **Submit for review** を押す。
3. 確認メールに記載される **Case ID** を控える。
4. 私に Case ID と提出日を伝えてください。`docs/submissions/mcp-directories.md` の状態表を更新します。

---

## 困ったときは

- ダッシュボードのフィールド名や選択肢が本ドキュメントと違う場合は、意味が一致する欄に読み替えて入力し、判断に迷ったら私に画面のスクリーンショットや文言を共有してください。
- リジェクトメールが届いたら、そのまま本文を共有してください。原因の切り分けと再提出用の修正を一緒に進めます。
