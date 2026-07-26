# Claude for Chrome — Anthropic Connectors Directory 申請記入指示

> このファイルを「Claude for Chrome（ブラウザ操作版Claude）」にそのまま渡す。
> Give this whole file to Claude for Chrome (the browser-operating Claude) as the task.
> あなた（人間）がログイン済みのブラウザで実行すること。最後の「送信(Submit)」は人間が確認してから押す。

---

## 0. あなた（Claude for Chrome）への指示 / Role

あなたは私の代理で、Anthropic の Connectors Directory に MCP コネクタ「**JP Bids**」を申請するフォームを記入します。

厳守ルール:
1. 下記の「フィールド値」を**一字一句そのまま**入力する。勝手に要約・翻訳・脚色しない。
2. **最後の Submit ボタンは押さない**。全フィールド入力＋スクショ添付が終わったら、入力内容のスクショを撮って私に確認を求めて停止する。
3. ログイン情報・パスワードの新規入力を求められたら、勝手に進めず私に聞く。
4. フォームの項目名が下記と少し違っても、**意味が一致する欄**にマッピングして入れる。判断に迷ったら私に聞く。
5. 各ステップ完了ごとに、何を入力したか1行で報告する。

---

## 1. フォームを開く / Open the form

1. `https://claude.ai` を開く（ログイン済み前提）。
2. Settings → Connectors（または admin settings）→ 「Submit a connector」/「Directory に申請」相当のリンクを開く。
   - 見つからない場合は `https://www.anthropic.com` のドキュメントから「Submit your MCP server / connector to the directory」フォームのリンクを探す。
   - それでも不明なら私に「申請フォームのURLを教えて」と聞いて停止する。

---

## 2. フィールド値 / Field values（そのまま入力）

### Connection
- **Server URL**: `https://mcp.bid-jp.com/mcp`
- **Transport**: `Streamable HTTP`
- **Users connect to**: Same URL（全ユーザー同一エンドポイント）
- **Protocol version**: `2025-11-25`

### Listing
- **Server name**: `JP Bids`
- **Tagline (≤55 chars)**: `Japan government procurement bid search & AI analysis`
- **Categories**: `Government & Public Sector`, `Data & Analytics`, `Productivity`
- **Documentation URL**: `https://github.com/sugukurukabe/koko-call-mcp`
- **Privacy Policy URL**: `https://mcp.bid-jp.com/privacy`
- **Support contact**: `mcp@bid-jp.com`（または GitHub Issues）
- **Icon URL**: `https://mcp.bid-jp.com/favicon.png`
- **URL slug**: `jp-bids`

> 注（命名について）: GitHubリポジトリ名は `koko-call-mcp` だが、製品名は **JP Bids MCP**、ドメインは `mcp.bid-jp.com`、npm/registry名は `jp-bids-mcp`。リポジトリREADME冒頭が `# JP Bids MCP` で製品・URL・npm名を明示しているため不一致は説明済み。フォームに「repo名と製品名が違う理由」を書く欄があれば次を入れる:
> `The product is "JP Bids MCP" (domain mcp.bid-jp.com, npm jp-bids-mcp). "koko-call-mcp" is only the GitHub repository slug; the repository README is titled "JP Bids MCP" and documents the same product.`

### Description（2000字以内・そのまま貼り付け）

```
JP Bids MCP は、中小企業庁 官公需情報ポータルサイト (KKJ) の公開入札情報を MCP で提供するサーバーです。KKJや外部業務システムへの書き込みは行いません。

主な機能 / Key features:
- 官公需入札検索 — キーワード・都道府県・業種・資格等級で絞り込み検索
- AI Bid Radar (rank_bids) — 自社条件でスコアリング・追跡優先度の自動判定
- PDF/HTML 要件抽出 — 添付仕様書を一時取得して参加条件・期限を構造化
- 資格適合確認 — 自社の地域・カテゴリ・資格と入札条件を照合
- CSV/ICS エクスポート — Google Sheets/Excel 用ショートリスト、Google Calendar/Outlook 用ICS
- 社内検討メモ・質問書ドラフト生成
- MCP Apps UI — Claude.ai のサイドパネルで入札一覧・詳細・アクションを操作
- 落札傾向分析・発注機関レーダー

データ: 中小企業庁 官公需情報ポータルサイト (https://www.kkj.go.jp/) の公開API。PDFは一時取得のみで保存しない。

対象ユーザー: 日本の中小企業・スタートアップ・行政書士・入札支援担当者。

認証: Remote endpoint は OAuth 2.0 または reviewer API key で接続します。Free ティアは4ツール、Pro/審査アカウントは全17ツール利用可。2026-10-01 までのbeta期間中は審査・初期ユーザー向けにPro表面を開放しています。

The server does not write to KKJ or external systems. It keeps only ephemeral session state for saved searches and may keep short-lived in-memory document cache for duplicate fetch prevention.
```

### Use cases（記入欄があれば）

```
1. 日本全国の官公需入札をキーワード・地域・業種で検索し、自社条件でAIスコアリングを実行する
2. 入札案件の仕様書PDFを一時取得して参加条件・期限・評価項目を抽出する
3. 選定した入札の社内検討メモ・カレンダー・質問書を自動生成する
4. 特定機関や業種の過去発注傾向・競合パターンを分析する
```

### Reads data / Writes data（記入欄があれば）

```
Reads public KKJ procurement data and does not write to KKJ or any external business system.
save_search / check_saved_search maintain ephemeral in-memory state within a single session.
PDF/HTML attachments are fetched only when requested, processed ephemerally, and may be held in a short-lived in-process cache (up to 5 minutes) to avoid duplicate upstream fetches.
```

### Company
- **Company name**: `スグクル株式会社 / Sugukuru Inc.`
- **Company website**: `https://sugu-kuru.co.jp`
- **Primary contact**: `info@sugu-kuru.co.jp`

### Authentication
- **Auth type**: `OAuth 2.0 (Dynamic Client Registration, RFC 7591)`
- **OAuth redirect URI**: `https://claude.ai/api/mcp/auth_callback`
- **PKCE**: `S256 required`
- **Authorization endpoint**: `https://mcp.bid-jp.com/oauth/authorize`
- **Token endpoint**: `https://mcp.bid-jp.com/oauth/token`
- **Protected resource metadata**: `https://mcp.bid-jp.com/.well-known/oauth-protected-resource/mcp`

### Data Handling
- **API ownership**: `Third-party MCP server operated by Sugukuru Inc. that legitimately queries the official public KKJ API (中小企業庁 官公需情報ポータル). JP Bids MCP is not affiliated with the Small and Medium Enterprise Agency.`
- **Personal health data**: `None`
- **Sponsored content**: `None`

---

## 3. テスト認証情報 / Reviewer setup（「Test & Launch」欄）

そのまま貼り付け:

```
Option A — Free tier / beta note:
1. In Claude.ai Settings → Connectors, add custom connector: https://mcp.bid-jp.com/mcp
2. Complete OAuth, or use Authorization: Bearer free in MCP Inspector / remote checks.
3. During beta (until 2026-10-01), authenticated connections expose the full Pro tool surface for review. After beta, a non-Pro key exposes only search_bids, rank_bids, list_recent_bids, get_bid_detail.

Option B — Pro tier (full 17 tools + MCP App):
1. Visit https://mcp.bid-jp.com and create a review account.
2. Reviewer test account: mcp-review@bid-jp.com / Password: <人間が安全に入力>
3. Add the custom connector in Claude.ai with the generated OAuth token.
4. Try: "鹿児島県のIT入札を探して、うちに合う順にランク付けして" (exercises rank_bids)
5. Try: "search_bids_app" to open the MCP App workspace.

(Optional) Reviewer API key: Authorization: Bearer jp-bids-review-XXXX  → grants Pro tier for testing.
```

> ⚠️ パスワード/APIキーの実値はこのファイルに書かない。フォーム入力時に人間が貼る。Claudeはプレースホルダのまま残し、私に「ここに実値を入れて」と促す。

---

## 4. スクリーンショット添付 / Screenshots

以下5枚を順番にアップロードする。すべて `docs/submissions/assets/` にある（PNG, 幅≥1000px, アプリ応答のみ）。GitHub raw URL でも配信中で、フォームがURL入力型ならそちらを貼る。

| 順 | ローカルファイル / Local file | GitHub raw URL (HTTP/2 200 確認済) | キャプション |
|---|---|---|---|
| 1 | `docs/submissions/assets/screenshot-01-welcome.png` | `https://raw.githubusercontent.com/sugukurukabe/koko-call-mcp/main/docs/submissions/assets/screenshot-01-welcome.png` | Welcome workspace with example prompts |
| 2 | `docs/submissions/assets/screenshot-02-search-results.png` | `https://raw.githubusercontent.com/sugukurukabe/koko-call-mcp/main/docs/submissions/assets/screenshot-02-search-results.png` | Search results: bid cards with priority/score/deadline + detail workbench |
| 3 | `docs/submissions/assets/screenshot-03-evidence.png` | `https://raw.githubusercontent.com/sugukurukabe/koko-call-mcp/main/docs/submissions/assets/screenshot-03-evidence.png` | Source & safety panel citing 中小企業庁 官公需情報ポータルサイト |
| 4 | `docs/submissions/assets/screenshot-04-dark.png` | `https://raw.githubusercontent.com/sugukurukabe/koko-call-mcp/main/docs/submissions/assets/screenshot-04-dark.png` | Dark mode |
| 5 | `docs/submissions/assets/screenshot-05-mobile.png` | `https://raw.githubusercontent.com/sugukurukabe/koko-call-mcp/main/docs/submissions/assets/screenshot-05-mobile.png` | Responsive mobile layout |

---

## 5. Compliance チェックボックス / Acknowledgements

次の主旨のチェックボックスがあれば**すべてON**にする（内容が一致することを確認のうえ）:
- [ ] Complies with the Anthropic Software Directory Policy
- [ ] Operated by Sugukuru Inc.; legitimately queries the public KKJ API; not affiliated with the Small and Medium Enterprise Agency
- [ ] Does not facilitate financial transactions, cryptocurrency, or money transfers
- [ ] Does not generate images, video, or audio via AI models
- [ ] Does not inject prompts to manipulate Claude's behavior
- [ ] Does not collect conversation data beyond tool function; OAuth/billing IDs and short-lived caches are documented in the privacy policy
- [ ] Public documentation available at the GitHub repository by launch date

内容に合わないチェックボックスがあれば、ONにせず私に報告する。

---

## 6. 最終確認 / Final stop（重要）

1. 全フィールド入力・全スクショ添付・全チェックON が終わったら、**Submit は押さない**。
2. フォーム全体が見えるようにスクロールしながらスクショを2〜3枚撮る。
3. 「入力完了。値とスクショを確認してください。Submitして良いですか？」と私に聞いて**停止**する。
4. 私が「OK」と言ったら Submit を押し、完了画面（確認番号があれば控える）をスクショして報告する。

---

## 参考 / Single source of truth

全フィールドの正本は `docs/submissions/anthropic-connector-checklist.md`。
矛盾があればそちらを優先し、私に差分を報告すること。
