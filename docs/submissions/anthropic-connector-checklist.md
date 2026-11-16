# Anthropic Connectors Directory 申請・更新チェックリスト (v0.10.0)
# Anthropic Connectors Directory Submission Checklist (v0.10.0)
# Daftar Periksa Pengajuan Anthropic Connectors Directory (v0.10.0)

> 申請・管理ポータル: Claude.ai Admin / Settings → Connectors → Submit / Manage  
> 対象タイプ: Remote MCP server + MCP App (`AI Bid Workspace`)  
> 対象バージョン: **`v0.10.0`** (`JP_BIDS_PROFILE=public_mvp`・完全無料・公開7ツール)

---

## Pre-submission ゲートチェック / Pre-submission Gate (`v0.10.0`)

| 項目 | 状態 | 備考 |
|---|---|---|
| `npm run check`（lint + typecheck:all + build + test）全通過 | ✅ | `v0.10.0` 全スイート合格 |
| Gate 1 ローカル受入ランナー（35条件・外部通信0件） | ✅ | `node --import ./evidence/q02_batch2/net-guard.batch2.path-null-fix.mjs tests/acceptance/gate1-runner.mjs` |
| `npm run registry:validate` & `npm run release:parity` 通過 | ✅ | `package.json`, `server.json`, `server-card.json`, `.smithery/shttp/manifest.json` すべて `0.10.0` で一致 |
| 本番ヘルス・メタデータ（`/health`, `/readyz`, `/privacy`, `/terms`, `/.well-known/*`） | ✅ | `https://mcp.bid-jp.com` 全エンドポイント HTTP 200（`/mcp` GET は仕様通り 405） |
| Documentation URL (GitHub repo) 公開・1クリック導入案内完備 | ✅ | `https://github.com/sugukurukabe/koko-call-mcp` (`README.md`, `README.ja.md`, `docs/USER_GUIDE.ja.md`) |
| 本番 Claude カスタムコネクタ実機検証 | ✅ | 2026-10-21 JST: `https://mcp.bid-jp.com/mcp` でOAuth 1クリック認可・7ツール認識・`search_bids_app` 表示・`get_bid_detail` 復元・選択2件16列CSV出力を確認（`docs/VERIFICATION_STATUS.md`） |

---

## 1. Connection — サーバーURL・トランスポート

| フィールド | 値 |
|---|---|
| Server URL | `https://mcp.bid-jp.com/mcp` |
| Transport | Streamable HTTP |
| Users connect to | Same URL (Universal endpoint for all users) |
| Protocol versions supported | `2025-11-25` (primary) / `2026-07-28` (routing header & RFC 9207 `iss` compatible) |

---

## 2. Tools — 公開7ツール一覧と annotations 確認 (`public_mvp`)

全7ツールすべて完全無料・読み取り専用。`title`, `inputSchema`, `outputSchema`, および4種の `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) を明示定義済み（Stripe課金・有料Proティア・外部書き込みツールは一切含まれません）。

| # | ツール名 | readOnlyHint | destructiveHint | idempotentHint | openWorldHint | title | 料金区分 |
|---|---|---|---|---|---|---|---|
| 1 | `search_bids` | `true` | `false` | `true` | `true` | 官公需入札検索 | 無料 (Free) |
| 2 | `list_recent_bids` | `true` | `false` | `true` | `true` | 直近の官公需入札一覧 | 無料 (Free) |
| 3 | `get_bid_detail` | `true` | `false` | `true` | `true` | 官公需入札詳細 | 無料 (Free) |
| 4 | `rank_bids` | `true` | `false` | `true` | `true` | 追うべき入札ランキング | 無料 (Free) |
| 5 | `extract_bid_requirements` | `true` | `false` | `false` | `true` | 入札要件抽出MVP | 無料 (Free) |
| 6 | `export_bid_shortlist` | `true` | `false` | `false` | `true` | 入札検討shortlist CSV | 無料 (Free) |
| 7 | `search_bids_app` | `true` | `false` | `true` | `true` | AI Bid Workspace | 無料 (Free) |

---

## 2.5. Prompts / Resources / Tasks (`public_mvp`)

`public_mvp` プロファイルでは、公開7ツールのみを使用する3本のPromptと4つの固定Resource＋1つのResource Templateを公開します（停止機能への誘導はゼロ）：

| 種別 | 識別子 | 用途 |
|---|---|---|
| Prompt | `morning_bid_briefing` | 地域・カテゴリごとの朝会用入札ブリーフィング |
| Prompt | `bid_due_alert` | 提出期限が近い案件の確認・優先度整理 |
| Prompt | `bid_discovery_workspace` | `search_bids_app` を使った AI Bid Workspace 探索起動 |
| Resource | `attribution://kkj` | 中小企業庁 官公需情報ポータルサイト 出典情報 |
| Resource | `docs://api-reference` | パラメータ・スキーマリファレンス |
| Resource | `codes://prefectures` | 47都道府県コード（`lg_code`）一覧 |
| Resource | `ui://jp-bids/search-results.html` | AI Bid Workspace 単一ファイルHTMLバンドル (`text/html;profile=mcp-app`) |
| Template | `prefecture://{lg_code}` | 都道府県別メタデータテンプレート（`01`〜`47`） |

Tasks capabilityは広告しません（すべての検索・比較・CSV出力が短時間の同期 `tools/call` で完結するため）。

---

## 3. Listing — ディレクトリ表示情報

| フィールド | 値 |
|---|---|
| Server name (100 chars max) | `JP Bids` |
| Tagline (55 chars max) | `Japan government procurement bid search & CSV workspace` |
| Description (2000 chars max) | 下記参照 |
| Categories (1–5) | `Government & Public Sector`, `Data & Analytics`, `Productivity` |
| Documentation URL | `https://github.com/sugukurukabe/koko-call-mcp` |
| Privacy Policy URL | `https://mcp.bid-jp.com/privacy` |
| Terms of Service URL | `https://mcp.bid-jp.com/terms` |
| Support contact | `mcp@bid-jp.com` (または GitHub Issues) |
| Icon | `https://mcp.bid-jp.com/favicon.png` |
| URL slug | `jp-bids` |

### Description (2000文字以内)

```text
JP Bids MCP (v0.10.0) は、中小企業庁 官公需情報ポータルサイト (KKJ) の公開入札公告を Claude との会話で検索・比較・確認・CSV出力できる読み取り専用MCPサーバーです。完全無料で提供され、KKJや外部システムへの書き込み・代理入札・課金処理は一切行いません。

主な機能 / Key features (全7ツール・無料):
- 官公需入札検索 (`search_bids` / `list_recent_bids`) — 47都道府県・調達区分（物品/工事/役務）・キーワード・公告日/締切日で検索
- AI Bid Workspace (`search_bids_app`) — Claudeのサイドパネルに単一HTMLバンドルの対話型テーブルを表示し、案件選択やCSV出力を実行
- 同一候補の比較・優先度評価 (`rank_bids`) — 署名付き参照 (`bid_ref`) により選択した候補を入れ替えずに0〜100点で比較
- 詳細・公式資料URL・要件整理 (`get_bid_detail` / `extract_bid_requirements`) — 発注機関の公式公告URLや確認すべき要件項目を整理（公開版では外部PDF本文取得は既定OFF）
- 16列CSV / JSON出力 (`export_bid_shortlist`) — 選択順序を保ったまま社内検討・Excel用の16列CSVまたはJSONを生成（保存・クリップボード・手動取得欄の3段階フォールバック対応）

データ出典: 中小企業庁 官公需情報ポータルサイト (https://www.kkj.go.jp/s/help/notes/)。スグクル株式会社が運営する民間サービスであり、政府機関の公式製品ではありません。入札判断前に必ず発注機関の公式原本をご確認ください。

認証: リモートエンドポイント (https://mcp.bid-jp.com/mcp) は OAuth 2.0 (Dynamic Client Registration + PKCE S256) に対応しており、会員登録・パスワード不要の1クリック同意画面で即座に接続できます。
```

---

## 4. Use Cases — ユースケース

### Primary use cases

```text
1. 日本全国47都道府県の官公需入札公告をキーワード・地域・調達区分で検索し、AI Bid Workspace画面で一覧確認する
2. 選択した複数の候補案件を署名付き参照（bid_ref）で引き継ぎ、自社キーワードと期限余裕で優先度比較する
3. 注目案件の公式公告URL・添付仕様書リンクと、確認すべき参加資格・提出期限のチェックリストを整理する
4. 選択した案件の順序を保持したまま、社内共有・稟議用の16列CSVまたはJSONとして出力する
```

### What users need before connecting

```text
事前登録・アカウント作成・APIキー・有料契約は一切不要です。
Claudeの「設定 → コネクタ」から https://mcp.bid-jp.com/mcp を追加し、OAuth同意画面で「許可する / Allow」を1クリックするだけで全7ツールを無料で利用できます。
```

### Reads data / Writes data

```text
Reads public Japanese government procurement notice metadata from the official KKJ Search API.
Does NOT write to KKJ or any external system, does NOT submit bids, and does NOT store attachment PDFs.
Maintains only short-lived in-memory search cache (TTL 10 minutes) and OAuth authorization/token state (`mcp:read`).
```

---

## 5. Company

| フィールド | 値 |
|---|---|
| Company name | スグクル株式会社 / Sugukuru Inc. |
| Company website | `https://sugu-kuru.co.jp` |
| Service page | `https://sugu-kuru.co.jp/services/jp-bids-mcp` |
| Primary contact | `info@sugu-kuru.co.jp` / `mcp@bid-jp.com` |

---

## 6. Authentication

| フィールド | 値 |
|---|---|
| Auth type | OAuth 2.0 (Dynamic Client Registration RFC 7591 + PKCE S256) |
| OAuth redirect URI | `https://claude.ai/api/mcp/auth_callback` (DCR対応) |
| PKCE | `S256` required |
| Scope | `mcp:read` |
| Authorization endpoint | `https://mcp.bid-jp.com/oauth/authorize` (1-click Allow/Deny consent, no password/signup) |
| Token endpoint | `https://mcp.bid-jp.com/oauth/token` (`Cache-Control: no-store`) |
| Protected resource metadata | `https://mcp.bid-jp.com/.well-known/oauth-protected-resource/mcp` |
| Reviewer credentials | **不要（No test password or API key needed）** — 審査員も一般ユーザーと同じ1クリックOAuth同意のみで全7ツール・AI Bid Workspaceを利用可能 |

---

## 7. Data Handling

| フィールド | 値 |
|---|---|
| API ownership | Third-party MCP server operated by Sugukuru Inc. querying the official public KKJ API (`中小企業庁 官公需情報ポータルサイト`). Not affiliated with the Small and Medium Enterprise Agency. |
| Personal health / financial data | None |
| Billing / Commerce | None (100% free Public MVP; zero Stripe or subscription calls) |
| Sponsored content | None |

---

## 8. Test & Launch — 審査員向け検証手順（アカウント不要）

```text
1. In Claude.ai Settings → Connectors, add custom connector: https://mcp.bid-jp.com/mcp
2. Click "Allow / 許可する" on the 1-click OAuth consent screen (no login, email, or API key required).
3. Verify that exactly 7 tools are surfaced: search_bids, list_recent_bids, get_bid_detail, rank_bids, extract_bid_requirements, export_bid_shortlist, search_bids_app.
4. Run: "東京都・役務で、件名に「システム」を含む入札公告を最大3件検索して、AI Bid Workspaceを表示してください" to verify search_bids_app UI rendering.
5. Select 2 notices in the workspace and click "選択CSV" (or ask in chat to rank and export the selected notices using their bid_ref) to verify 16-column CSV export.
```

### Representative Tool Inputs

| ツール | テスト入力例 |
|---|---|
| `search_bids` | `{"query": "システム", "prefecture": "鹿児島県", "category": "役務", "limit": 3}` |
| `list_recent_bids` | `{"prefecture": "東京都", "category": "役務", "days": 7, "limit": 3}` |
| `get_bid_detail` | `{"bid_ref": "<bidRef from search_bids result>"}` |
| `rank_bids` | `{"bid_refs": ["<bidRef1>", "<bidRef2>"], "preferred_keywords": ["クラウド", "保守"]}` |
| `extract_bid_requirements` | `{"bid_ref": "<bidRef>", "fetch_documents": false}` |
| `export_bid_shortlist` | `{"bid_refs": ["<bidRef1>", "<bidRef2>"], "format": "csv"}` |
| `search_bids_app` | `{"query": "システム", "prefecture": "東京都", "category": "役務", "limit": 3}` |

---

## 9. Compliance Acknowledgements

- [x] This connector complies with the Anthropic Software Directory Policy
- [x] Operated by Sugukuru Inc. and queries the public KKJ API; clearly discloses non-affiliation with government agencies
- [x] Does not facilitate financial transactions, subscriptions, cryptocurrency, or money transfers
- [x] Does not generate images, video, or audio via AI models
- [x] Wraps untrusted notice metadata safely and never injects prompts to manipulate Claude's behavior
- [x] Documented privacy policy (`https://mcp.bid-jp.com/privacy`) and terms (`https://mcp.bid-jp.com/terms`) are live

---

## 10. MCP App — スクリーンショット・CSP仕様

- **CSP**: `_meta.ui.csp = { connectDomains: [], resourceDomains: [] }`（単一HTMLインラインバンドル・外部CDN通信ゼロ）
- **準備済みスクリーンショット**: `docs/submissions/assets/` に5枚配置済み（Welcome画面、検索結果＆優先度バッジ、出典・安全性情報、ダークモード、モバイル幅レスポンシブ表示）。さらに `npm run apps:capture` で最新の9画面決定論キャプチャも生成可能。

---

## 11. Allowed Link URIs

```text
https://www.kkj.go.jp
https://mcp.bid-jp.com
```

---

## Final Submission / Update Steps

1. `docs/GO_LIVE_TODAY_RUNBOOK.md` の手順で Cloud Run 本番を `v0.10.0` に更新し、`npm run remote:health` を確認する。
2. Claude.ai カスタムコネクタで公開7ツールと `AI Bid Workspace` の動作を確認する。
3. Claude Admin / Directory ポータルで上記 `v0.10.0`（無料7ツール・1クリックOAuth）の記載内容とスクリーンショットを提出・更新する。
4. 提出日・ステータスを `docs/submissions/mcp-directories.md` に記録する。
