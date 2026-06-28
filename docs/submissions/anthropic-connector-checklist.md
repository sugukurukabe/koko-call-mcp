# Anthropic Connectors Directory 申請チェックリスト
# Anthropic Connectors Directory Submission Checklist
# Daftar Periksa Pengajuan Anthropic Connectors Directory

> 申請ポータル: Claude.ai admin settings → Connectors → Submit  
> 対象タイプ: Remote MCP server + MCP App  
> 申請日: TBD  
> バージョン: v0.7.x+

---

## Pre-submission ゲートチェック / Pre-submission Gate

| 項目 | 状態 | 備考 |
|---|---|---|
| `npm run build` が通る | ✅ | |
| `npm run test` が全通過 | ✅ | 121 tests |
| `npm run lint` が通る | ✅ | root `npm run lint` 通過 |
| `npm run remote:health` が通る | ✅ | 2026-06-28: `https://mcp.bid-jp.com/readyz` OK、`/mcp` GET 405 OK |
| `npm run remote:mcp` が通る | ✅ | 2026-06-28: `https://mcp.bid-jp.com/mcp` で全PASS（17 tools / 6 prompts / 4 resources / MCP App UI）|
| 公開メタデータ・privacy・OAuth well-known が200 | ✅ | 2026-06-28: server-card / agents / mcp-server / oauth-protected-resource / oauth-authorization-server / privacy / terms / favicon すべて200 |
| Documentation URL (GitHub repo) が公開 | ✅ | `https://github.com/sugukurukabe/koko-call-mcp` 200・READMEは "JP Bids MCP" 正本 |
| Registry メタデータ整合 (`npm run registry:validate`) | ✅ | passed。`package.json` mcpName ＝ `server.json` name ＝ `io.github.sugukurukabe/jp-bids` |
| Claude custom connector として接続確認した | ✅ | 2026-06-28: 個人Claude.aiアカウントでコネクタ追加・OAuth接続成功 |
| MCP App UI / 代表ツール手動確認 | ✅ | `remote:mcp` で代表ツール実行・全17 surfaced。手順は `personal-account-smoke.md` |

---

## 1. Connection — サーバーURL・トランスポート

| フィールド | 値 |
|---|---|
| Server URL | `https://mcp.bid-jp.com/mcp` |
| Transport | Streamable HTTP |
| Users connect to | Same URL (all users use the same endpoint) |
| Protocol version supported | `2025-11-25` |

---

## 2. Tools — ツール一覧と annotations 確認

全17ツール: `title` あり、`readOnlyHint` または `destructiveHint` あり、名前64文字以内。

| ツール名 | readOnlyHint | title | Tier |
|---|---|---|---|
| `search_bids` | `true` | 官公需入札検索 | Free |
| `rank_bids` | `true` | 追うべき入札ランキング | Free |
| `list_recent_bids` | `true` | 直近の官公需入札一覧 | Free |
| `get_bid_detail` | `true` | 官公需入札詳細 | Free |
| `search_bids_app` | `true` | 官公需入札検索テーブル | Pro |
| `explain_bid_fit` | `true` | 入札追跡判断の説明 | Pro |
| `assess_bid_qualification` | `true` | 入札資格適合MVP判定 | Pro |
| `extract_bid_requirements` | `true` | 入札要件抽出MVP | Pro |
| `export_bid_shortlist` | `true` | 入札検討shortlist CSV | Pro |
| `create_bid_calendar` | `true` | 入札締切カレンダーICS | Pro |
| `create_bid_review_packet` | `true` | 入札社内検討パック | Pro |
| `draft_bid_questions` | `true` | 入札質問書ドラフト | Pro |
| `analyze_past_awards` | `true` | 過去公告・競合レーダー | Pro |
| `summarize_bids_by_org` | `true` | 発注機関別の入札傾向分析 | Pro |
| `save_search` | `false` | 検索条件を保存 | Pro |
| `check_saved_search` | `false` | 保存検索の新着確認 | Pro |
| `list_saved_searches` | `true` | 保存検索の一覧 | Pro |

**Reviewer注**: `save_search` / `check_saved_search` は `readOnlyHint: false` — セッション内の in-memory state を更新するため。外部システムへの書き込みは一切なし。

---

## 2.5. Prompts / Resources / Tasks

Promptsは審査・実利用でよく使うワークフローに合わせて6本用意しています。

| Prompt | 用途 |
|---|---|
| `morning_bid_briefing` | 地域・カテゴリごとの朝会用ブリーフィング |
| `bid_discovery_workspace` | `search_bids_app` を使ったMCP Apps探索ワークスペース起動 |
| `competitor_radar` | 発注機関別の過去傾向分析 |
| `bid_review_packet_workflow` | `bid_key` から詳細確認・要件抽出・社内検討パック作成まで |
| `qualification_and_question_draft` | 資格適合の仮判定と質問書ドラフト |
| `bid_due_alert` | 提出期限が近い案件の確認 |

Resourcesは `attribution://kkj`、`docs://api-reference`、`codes://prefectures`、`ui://jp-bids/search-results.html`、`bid://{bid_key}`、`org://{organization_name}` などを提供します。

Tasks capabilityは現時点では広告しません。現在の検索・分析・レビュー生成は短時間同期処理で完了し、MCP SDK側にも標準Task登録APIを使っていないためです。長時間ジョブが必要になった場合のみ、別途Cloud Run Jobsなどと組み合わせて公式仕様に沿って追加します。

---

## 3. Listing — ディレクトリ表示情報

| フィールド | 値 |
|---|---|
| Server name (100 chars max) | `JP Bids MCP` |
| Tagline (55 chars max) | `Japan government procurement bid search & AI analysis` |
| Description (2000 chars max) | 下記参照 |
| Categories (1–5) | `Government & Public Sector`, `Data & Analytics`, `Productivity` |
| Documentation URL | `https://github.com/sugukurukabe/koko-call-mcp` |
| Privacy Policy URL | `https://mcp.bid-jp.com/privacy` |
| Support contact | mcp@bid-jp.com (or GitHub Issues) |
| Icon | `https://mcp.bid-jp.com/favicon.png` |
| URL slug | `jp-bids-mcp` |

### Description (2000文字以内)

```
JP Bids MCP は、中小企業庁 官公需情報ポータルサイト (KKJ) の公開入札情報を MCP で提供するサーバーです。KKJや外部業務システムへの書き込みは行いません。

**主な機能 / Key features:**
- 官公需入札検索 — キーワード・都道府県・業種・資格等級で絞り込み検索
- AI Bid Radar (rank_bids) — 自社条件でスコアリング・追跡優先度の自動判定
- PDF/HTML 要件抽出 — 添付仕様書を一時取得して参加条件・期限を構造化
- 資格適合確認 — 自社の地域・カテゴリ・資格と入札条件を照合
- CSV/ICS エクスポート — Google Sheets/Excel 用ショートリスト、Google Calendar/Outlook 用ICS
- 社内検討メモ・質問書ドラフト生成
- MCP Apps UI — Claude.ai のサイドパネルで入札一覧・詳細・アクションを操作
- 落札傾向分析・発注機関レーダー

**データ**: 中小企業庁 官公需情報ポータルサイト (https://www.kkj.go.jp/) の公開API。PDFは一時取得のみで保存しない。

**対象ユーザー**: 日本の中小企業・スタートアップ・行政書士・入札支援担当者。

**認証**: Remote endpoint は OAuth 2.0 または reviewer API key で接続します。Free ティアは4ツール、Pro/審査アカウントは全17ツール利用可。2026-07-01 までのbeta期間中は審査・初期ユーザー向けにPro表面を開放しています。

The server does not write to KKJ or external systems. It keeps only ephemeral session state for saved searches and may keep short-lived in-memory document cache for duplicate fetch prevention.
```

---

## 4. Use Cases — ユースケース

### Primary use cases (記述例)

```
1. 日本全国の官公需入札をキーワード・地域・業種で検索し、自社条件でAIスコアリングを実行する
2. 入札案件の仕様書PDFを一時取得して参加条件・期限・評価項目を抽出する
3. 選定した入札の社内検討メモ・カレンダー・質問書を自動生成する
4. 特定機関や業種の過去発注傾向・競合パターンを分析する
```

### What users need before connecting

```
Free ティア: Remote connector uses OAuth/API-key authentication. A non-Pro key exposes the 4 Free tools after beta; during beta reviewers will see the Pro tool surface.

Pro ティア: https://mcp.bid-jp.com でOAuthログイン後、月額¥990のサブスクリプション。無料トライアルあり。
```

### Reads data / Writes data

```
Reads public KKJ procurement data and does not write to KKJ or any external business system.
save_search / check_saved_search maintain ephemeral in-memory state within a single session.
PDF/HTML attachments are fetched only when requested, processed ephemerally, and may be held in a short-lived in-process cache (up to 5 minutes) to avoid duplicate upstream fetches.
```

---

## 5. Company

| フィールド | 値 |
|---|---|
| Company name | スグクル株式会社 / Sugukuru Inc. |
| Company website | https://sugukuru.com |
| Primary contact | kabe@sugukuru.com |

---

## 6. Authentication

| フィールド | 値 |
|---|---|
| Auth type | OAuth 2.0 (Dynamic Client Registration, RFC 7591) |
| OAuth redirect URI | `https://claude.ai/api/mcp/auth_callback` (already registered) |
| PKCE | S256 required |
| Authorization endpoint | `https://mcp.bid-jp.com/oauth/authorize` |
| Token endpoint | `https://mcp.bid-jp.com/oauth/token` |
| Protected resource metadata | `https://mcp.bid-jp.com/.well-known/oauth-protected-resource/mcp` |
| Free tools | search_bids, rank_bids, list_recent_bids, get_bid_detail. Remote production still expects OAuth/API-key authentication; non-Pro keys map to Free after beta. |
| Note | During review, use the test account or reviewer API key below which grants Pro access. During beta, OAuth/API-key connections expose all 17 tools for review. |

---

## 7. Data Handling

| フィールド | 値 |
|---|---|
| API ownership | Third-party MCP server operated by Sugukuru Inc. that legitimately queries the official public KKJ API (中小企業庁 官公需情報ポータル). JP Bids MCP is not affiliated with the Small and Medium Enterprise Agency. |
| Personal health data | None |
| Sponsored content | None |

---

## 8. Test & Launch — テスト認証情報

### Reviewer setup instructions

```
Option A — Free tier / beta note:
1. In Claude.ai Settings → Connectors, add custom connector: https://mcp.bid-jp.com/mcp
2. Complete OAuth or use Authorization: Bearer free in MCP Inspector/remote checks.
3. During beta (until 2026-07-01), authenticated connections may expose the full Pro tool surface. After beta, a non-Pro key exposes only search_bids, rank_bids, list_recent_bids, get_bid_detail.

Option B — Pro tier (full 17 tools + MCP App):
1. Visit https://mcp.bid-jp.com and click "Pro トライアル" to create a review account
2. Use email: mcp-review@bid-jp.com / Password: [see private notes]
3. Add custom connector in Claude.ai with the generated OAuth token
4. Run: "鹿児島県のIT入札を探して、うちに合う順にランク付けして" to exercise rank_bids
5. Run: "search_bids_app" to open the MCP App workspace

OR use the test API key:
  Authorization: Bearer jp-bids-review-XXXX (see private notes)
  This grants Pro tier access for review testing.
```

### Tools to verify (representative set)

| ツール | テスト入力 |
|---|---|
| `search_bids` | `{"query": "システム", "prefecture": "鹿児島県", "category": "役務", "limit": 3}` |
| `rank_bids` | `{"query": "IT保守", "prefecture": "鹿児島県", "preferred_keywords": ["クラウド", "保守"], "shortlist_limit": 5}` |
| `list_recent_bids` | `{"prefecture": "東京都", "category": "役務", "days": 7}` |
| `get_bid_detail` | `{"bid_key": "<key from search_bids result>"}` |
| `explain_bid_fit` | `{"bid_key": "<key>", "preferred_keywords": ["システム"]}` |
| `extract_bid_requirements` | `{"bid_key": "<key>", "fetch_documents": false}` |
| `analyze_past_awards` | `{"organization_name": "農林水産省", "window_days": 365}` |
| `search_bids_app` | `{"query": "システム", "prefecture": "鹿児島県"}` (MCP Apps UI) |

---

## 9. Compliance Acknowledgements

- [ ] This connector complies with the Anthropic Software Directory Policy
- [ ] The connector is operated by Sugukuru Inc. and legitimately queries the public KKJ API; it is not affiliated with the Small and Medium Enterprise Agency
- [ ] The connector does not facilitate financial transactions, cryptocurrency, or money transfers
- [ ] The connector does not generate images, video, or audio via AI models
- [ ] The connector does not inject prompts to manipulate Claude's behavior
- [ ] The connector does not collect conversation data beyond what is needed for tool function; OAuth/billing identifiers and short-lived caches are documented in the privacy policy
- [ ] Public documentation will be available at the GitHub repository by launch date

---

## 10. MCP App — スクリーンショット仕様 / Screenshots

Screenshots must be PNG, ≥1000px wide, cropped to the app response only (no chat prompt visible).

**準備済み / Prepared**: `docs/submissions/assets/` に5枚を生成済み。実UI(`ui://jp-bids/search-results.html`)を実データで描画してキャプチャしたもの。再生成手順は `docs/submissions/screenshot-howto.md` を参照。

| # | File | 解像度 | Shows |
|---|---|---|---|
| 1 | `screenshot-01-welcome.png` | 2560×1720 | AI Bid Workspace の初期Welcome画面（入力例プロンプト一覧） |
| 2 | `screenshot-02-search-results.png` | 2560×1720 | 左に案件カード（優先度バッジ「追う」/スコア/PDF/締切までの日数）、右に選択案件の詳細・アクションドック・公式公告リンク |
| 3 | `screenshot-03-evidence.png` | 2560×1720 | 「出典・安全性情報」展開。安全性注意・Key・出典(中小企業庁 官公需情報ポータルサイト)・取得日時を表示 |
| 4 | `screenshot-04-dark.png` | 2560×1720 | ダークモード。色付き優先度バッジ・締切バッジが正しく反転 |
| 5 | `screenshot-05-mobile.png` | 1242×2460 | モバイル幅（414px相当）での1カラムレスポンシブ表示 |

いずれも実際の `search_bids_app` 相当の構造化結果（鹿児島県・役務・23件中5件）でレンダリングしている。チャットのプロンプト部分は含めず、アプリ応答のみをトリミング済み。

> 補足: より「Claude.ai上の実物」を重視する場合は、Claude custom connector接続後に Section 8 のプロンプトを実行し、アプリパネルのみをトリミングして上記ファイルを差し替えてよい。

---

## 11. Allowed Link URIs

```
https://www.kkj.go.jp
https://mcp.bid-jp.com
```

These are the only origins the MCP App opens without extra confirmation via `ui/open-link`.  
Attachment PDFs and other government domains are returned as `resource_link` blocks from KKJ metadata and should prompt or be handled by the host according to client policy.

---

## Final Submission Steps / 最終申請手順

1. `npm run build`、`npm test`、`npx biome check src/ scripts/ tests/ docs/submissions/ public/.well-known/mcp/server-card.json` が通ることを確認
2. `npm run remote:mcp` で本番エンドポイントの全ツール実行を確認
3. Claude.ai custom connector として全17ツール・Apps UI・Prompts・Resources を手動検証
4. スクリーンショット5枚を `docs/submissions/assets/` に保存
5. Claude.ai admin settings → Submit で申請ポータルを開く
6. 上記フィールドを入力し、スクリーンショットをアップロード
7. `docs/submissions/mcp-directories.md` の Anthropic セクションに申請日と status を記録
