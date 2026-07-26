# 個人Claudeアカウントでの申請前 動作確認 / Personal-account Pre-submission Smoke

> 申請ボタンを押す前に、あなたの個人Claude.aiアカウントで実際に接続して動くか確認するための手順。
> Verify the connector actually works in your personal Claude.ai before submitting.

最終確認日 / Last endpoint check: 2026-06-28
- `https://mcp.bid-jp.com/readyz` → OK
- `https://mcp.bid-jp.com/mcp` (GET) → 405（正常: POSTのみ受付）
- `npm run remote:mcp` → ALL CHECKS PASSED（17 tools / 6 prompts / 4 resources / MCP App UI）
- `npm run registry:validate` → passed

つまりサーバ側は準備OK。あとはClaude.ai側で接続体験を見るだけ。

---

## Step 1. コネクタを追加 / Add the connector

1. 個人アカウントで `https://claude.ai` にログイン。
2. Settings → **Connectors** → **Add custom connector**。
3. URL に入力: `https://mcp.bid-jp.com/mcp`
4. **Connect** を押すと OAuth 画面（`mcp.bid-jp.com`）に飛ぶ → ログイン/許可。
   - Dynamic Client Registration + PKCE(S256) で自動登録される。
5. 接続成功すると、コネクタが「Connected」になる。

> beta期間（〜2026-10-01）は、OAuth接続で**全17ツール**が見える想定。
> beta後はFree鍵だと4ツール（search_bids / rank_bids / list_recent_bids / get_bid_detail）になる。

---

## Step 2. ツール・プロンプト・リソースが見えるか / Surface check

コネクタ設定画面、または新規チャットの「ツール一覧」で確認:

- **Tools（17）**: search_bids, rank_bids, list_recent_bids, get_bid_detail, search_bids_app, explain_bid_fit, assess_bid_qualification, extract_bid_requirements, export_bid_shortlist, create_bid_calendar, create_bid_review_packet, draft_bid_questions, analyze_past_awards, summarize_bids_by_org, save_search, check_saved_search, list_saved_searches
- **Prompts（6）**: morning_bid_briefing, bid_discovery_workspace, competitor_radar, bid_review_packet_workflow, qualification_and_question_draft, bid_due_alert
- **Resources**: attribution://kkj, docs://api-reference, codes://prefectures, ui://jp-bids/search-results.html

---

## Step 3. 代表プロンプトを実行 / Run representative prompts

| # | プロンプト | 期待 | 確認 |
|---|---|---|---|
| 1 | `鹿児島県のIT系入札を5件検索して` | `search_bids` 実行・入札一覧・出典に「中小企業庁 官公需情報ポータルサイト」 | ☐ |
| 2 | `その中でうちに合う順にランク付けして` | `rank_bids` 実行・スコア付きリスト | ☐ |
| 3 | `一番スコアが高い案件の詳細を教えて` | `get_bid_detail` 実行・公式URLが resource_link で出る | ☐ |
| 4 | `search_bids_appで鹿児島県の役務入札を検索して` | **MCP App UI**（サイドパネルにワークスペース）が開く | ☐ |
| 5 | `この案件の要件を抽出して` | `extract_bid_requirements` 実行 | ☐ |
| 6 | `社内検討メモを作って` | `create_bid_review_packet` 実行・Markdownメモ | ☐ |
| 7 | `このツールの出典は？` | `attribution://kkj` を参照・KKJ出典明記 | ☐ |

---

## Step 4. MCP App UI 確認 / App UI check

`search_bids_app` 実行後にサイドパネルで:

- ☐ 左に案件カード（優先度バッジ「追う/要確認/見送り」・スコア・PDF・締切までの日数）
- ☐ カードをクリックすると右に詳細（提出期限・開札・スコア）
- ☐ アクションボタン（📄読む / ✓判定 / 📋まとめる / ❓聞く / 🔗公式）
  - ※ Claude.aiは現状アプリ起点の `ui/message` を受け付けないため、これらは「プロンプトをコピーしました。チャットに貼り付けて送信してください。」と表示される（**仕様どおり**。旧バージョンの「Host側で拒否されました」は解消済み）。
- ☐ 「公式公告ページ → 官公需ポータルで開く」リンク
- ☐ 「出典・安全性情報」を開くと出典・取得日時・安全性注意が出る
- ☐ ダークモードでも崩れない

> 期待される見た目は `docs/submissions/assets/` のスクショと同じ。

---

## トラブルシュート / Troubleshooting

| 症状 | 対処 |
|---|---|
| ツールが4つしか出ない | beta終了後のFree鍵挙動。Pro/審査アカウントかbeta内か確認。 |
| OAuthで失敗 | `https://mcp.bid-jp.com/.well-known/oauth-protected-resource/mcp` が200か確認。ブラウザのサードパーティCookieブロックを一時解除。 |
| App UIが出ずテキストだけ | クライアントがMCP Appsに対応しているか（Claude.ai webは対応）。`search_bids`ではなく`search_bids_app`を使う。 |
| 「接続できない」 | `npm run remote:health` で `readyz` OKか確認（サーバ稼働確認）。 |
| 出典が出ない | tool resultの`attribution`は常に返る。会話で「出典は？」と聞けば`attribution://kkj`が参照される。 |
| 「まとめるリクエストがHost側で拒否されました」 | 旧版の挙動。最新版（`gcloud run deploy jp-bids-mcp` 再デプロイ後）ではプロンプトのクリップボードコピーにフォールバックする。再接続して解消されるか確認。 |
| 公告日などが `2025-04-04T00:00:00+09:00` と生表示 | 旧版の挙動。最新版では `2025-04-04` 形式に整形される。 |

---

## 確認できたら / After verification

- 上のチェックが概ね通れば申請してOK。
- 結果を `docs/submissions/verification-log.md` の「Claude Custom Connector 検証」表に転記しておくと、申請ポータルの "Additional notes" に貼れる。
- 申請フォーム記入は `docs/submissions/claude-chrome-submission-instructions.md` を Claude for Chrome に渡す。
