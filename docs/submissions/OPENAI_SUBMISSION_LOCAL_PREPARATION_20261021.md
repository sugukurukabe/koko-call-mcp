# JP Bids — OpenAI / ChatGPT 申請準備・ローカル整理資料（2026-10-21 改定第2版）

**策定日**: 2026-10-21 JST  
**対象リポジトリ**: `jp-bids-mcp` (コミット: `be3a0b0c` / 実体ソース: `77ba3286`)  
**状態**: ローカル整理資料（申請パッケージ・提出用ZIP完成ではない）  
**方針**: 未確認事項の確定扱いを排除し、公式条件本文・インフラ実設定・管理画面チャレンジの確認を前提とした整理にとどめる。

---

## 1. 既存申請資料の全文照合

### 1.1 照合対象資料
1. `docs/submissions/chatgpt-app-submission.json`（初期ドラフトJSON）
2. `plugins/jp-bids-mcp/plugin.json`（公開リポジトリの Agent Plugin 定義）
3. 関連 Skill 定義:
   - `plugins/jp-bids-mcp/skills/search-bids/SKILL.md`（公開リポジトリ側）
   - `skills/searching-japanese-bids/SKILL.md`（開発用フルセット側）
4. 実装コード（`src/tools/*.ts`, `src/apps/*.ts`, `src/api/kkj-client.ts`, `src/domain/*.ts`）

### 1.2 照合結果分類一覧

| 分類 | 対象項目 | 既存資料の記載内容 | 実装コード・現行事実 | 評価・補正方針 |
|---|---|---|---|---|
| **旧情報** | ツール公開範囲 | 旧4ツールのみ定義 (`search_bids`, `rank_bids`, `list_recent_bids`, `get_bid_detail`) | 公開MVPは新3ツールを含む計7ツール (`extract_bid_requirements`, `export_bid_shortlist`, `search_bids_app`) | 7ツール構成に合わせた整理を行う。ただし提出用公式パッケージ化は検証完了まで保留 |
| **旧情報** | Annotations 定義 | 各ツールに `readOnlyHint`, `openWorldHint`, `destructiveHint` のみ記載 | 実装コードでは `idempotentHint` も全ツールで明示（`extract` と `export` は `false`、他は `true`） | 実装値に合わせて `idempotentHint` を記載。副作用の有無と結果変化を分けて整理 |
| **旧情報** | 案件識別キー | `get_bid_detail` は `bid_key` のみ受付と記述 | 署名トークン `bid_ref` が第一優先入力、`bid_key` は後方互換 | `bid_ref` (優先) / `bid_key` (後方互換) の受付仕様を反映 |
| **旧情報** | ランキング入力 | `rank_bids` は検索パラメータ経由のみと記述 | `bid_refs` (1〜50件) による「選択モード」が実装済み | 検索モードと選択モードの排他制御・50件制限を明記 |
| **旧情報** | 内部Skill仕様 | `skills/searching-japanese-bids/SKILL.md` に「17ツール」「2026年9月末まで無料ベータ」「Pro tier」の記述 | 公開MVPは7ツール構成、全機能が無償公開 | 審査資料・公開Skillから17ツール・有料化等の旧記述を排除 |
| **旧情報** | 新着一覧の説明 | `search-bids/SKILL.md` に「新着・締切間近」と記述 | `list_recent_bids` は過去1〜30日間の公告日 (`CFT_Issue_Date`) のみ絞り込み | 「締切間近」の記述を削除し「直近公告日の一覧」に是正 |
| **再利用可能** | アプリ基本情報 | `display_name: "JP Bids"`, `category: "BUSINESS"` | 現行ブランド・カテゴリーと一致 | 基本情報骨子として採用 |
| **再利用可能** | 安全性根拠 | 外部書込み・代理入札・応募を行わない宣言 | 実装上も検索・メモリ内処理のみで書込み不可 | `justifications` の安全ロジックのベースとして継承 |
| **再利用可能** | ガードレール | 1. 民間求人の除外<br>2. 代理応募の拒絶<br>3. キーなし詳細推測の拒絶 | 審査上重要なネガティブテスト | そのまま採用・維持 |
| **補正・確認要** | 認証仕様 | 「認証なし」と記述 | **本番リモートはHTTPS上のStreamable HTTP（StreamableHTTPServerTransport）、OAuth認可、scope `mcp:read`**、ローカルstdioは認証不要 | 本番リモートとローカル接続の認証を分離して是正 |
| **補正・確認要** | KKJ利用許諾 | `licenseUrl` や ADR-0006 の存在のみ記録 | 公式条件の本文・該当箇所・適用範囲は未取得 | **「根拠確認中」**とし、本文確認完了まで許諾取得済みと断定しない |
| **補正・確認要** | CSV出力規格・実フィールド | 過去に「RFC 4180準拠」「`csvContent`/`rowCount`」と記述 | 実装は `csv`、`rankedCount`、`columns` (16列) 等 | **「CSV/JSON生成。取得CSVは16列として解析し、選択案件との対応を確認」**に是正。実フィールド名に修正 |
| **補正・確認要** | ランキングフィールド | `tier` と記述 | 実装は `priority: "pursue" \| "review" \| "skip"` | 実装フィールド名 `priority` に修正 |
| **補正・確認要** | 流量制御 | サービス全体で「1リクエスト/秒」と記述 | `KkjClient` クラスのインスタンス単位の既定値 | Cloud Run全体の合計通信制限ではないことを明記 |
| **補正・確認要** | ログ保持方針 | 「ログ即時破棄」と断定 | アプリ層の設計方針とインフラログが未分離 | **「検索内容を記録しない設計」**と**「インフラログの保存・削除（実設定確認待ち）」**に分離 |
| **補正・確認要** | 要件抽出の精度 | 資格・期限・必要書類を常に抽出可能と記述 | 元公告テキスト・添付有無に依存 | **「構造化を試みる対象項目」と「実際に取得できる値（欠損・未記載あり）」**を分離 |
| **補正・確認要** | クライアント対応・検証証拠 | 「ChatGPT非対応」「Claudeでクリップボード動作確認」と記述 | モック実証実績あり、確認済みはUI初期表示とCSV取得のみ | **「MCP Apps非対応ホストではフォールバック。現行本番ChatGPTは未確認」「クリップボード確認済み表記削除」**へ修正 |
| **補正・確認要** | 規約URL | 企業サイトURLと混同 | サービス固有URLが存在 | `https://mcp.bid-jp.com/privacy` および `/terms` に整理 |
| **補正・確認要** | 本番URLと検証 | 未確定として記述 | 既知の `https://mcp.bid-jp.com/mcp` | **「本番設定」「ChatGPT接続検証」「申請画面設定確認」**の3項目に切り分け |
| **補正・確認要** | 申請パッケージ・スキーマ | 単独JSONを公式申請パッケージと呼称、非公式スキーマURL記載 | 公式パッケージ未完成、スキーマ実在未確認 | 公式スキーマURLを削除し、**「ローカル整理資料（ドラフト）」**と位置付け |

---

## 2. 公開7ツールの完全対応表

現行公開リポジトリ（コミット `be3a0b0c`）の実装と、申請説明・整理資料との対応関係を以下に整理します。

| # | ツール名 / 日本語タイトル | 入力制約 (主要パラメータ・バリデーション) | 出力形式 / 主要項目 (実装スキーマ) | 認証 / Scope | Annotations (実装値) | 確認済み範囲 (検証実績) | 申請説明上の注意点・制約事項 |
|---|---|---|---|---|---|---|---|
| 1 | `search_bids`<br>官公需入札検索 | ・`query`: 文字列 (任意、AND結合)<br>・`prefecture`: 都道府県名または配列<br>・`category`: 役務/物品/工事<br>・`organization_name`: 発注機関名<br>・`issued_after/before`: 公告日<br>・`due_after/before`: 提出期限<br>・`limit`: 1〜1000 (既定20) | `BidSearchResultSchema`<br>・要約テキスト<br>・`bids`: 各案件情報 (`bidRef`, `key`, `projectName`, `org`, `due`, リンク等)<br>・`attribution`: KKJ出典メタデータ | 本番リモート: **OAuth 2.0 (`mcp:read`)**<br>ローカル: 認証不要 | `readOnlyHint: true`<br>`destructiveHint: false`<br>`idempotentHint: true`<br>`openWorldHint: true` | 単体・結合テスト、本番Claude検索検証、鹿児島IT・農水省役務等 | `KkjClient` インスタンス単位で1 req/secのレートリミットを持つが、インフラ全体の合計通信制限ではない。副作用なし。 |
| 2 | `list_recent_bids`<br>直近の官公需入札一覧 | ・`prefecture`: 都道府県名 (任意)<br>・`category`: 役務/物品/工事 (任意)<br>・`days`: 1〜30日 (既定7)<br>・`limit`: 1〜1000 (既定50) | `BidSearchResultSchema`<br>（`search_bids` と同構造） | 本番リモート: **OAuth 2.0 (`mcp:read`)**<br>ローカル: 認証不要 | `readOnlyHint: true`<br>`destructiveHint: false`<br>`idempotentHint: true`<br>`openWorldHint: true` | 単体テスト、47都道府県一括検索テスト、7日間抽出 | 公告日（`CFT_Issue_Date`）による新着一覧であり、締切間近の抽出ではない。副作用なし。 |
| 3 | `get_bid_detail`<br>官公需入札詳細 | ・`bid_ref`: 署名トークン (最優先)<br>・`bid_key`: 案件Key (後方互換)<br>※いずれか1件必須 | `BidSearchResultSchema`<br>（該当案件1件の詳細、公式公告URL、添付資料リンク一覧） | 本番リモート: **OAuth 2.0 (`mcp:read`)**<br>ローカル: 認証不要 | `readOnlyHint: true`<br>`destructiveHint: false`<br>`idempotentHint: true`<br>`openWorldHint: true` | 本番Claudeによる即時復元テスト、キャッシュ/上流復元テスト | 添付原本ファイルはサーバーに保存せず、公式URLのリンクのみを返す。副作用なし。 |
| 4 | `rank_bids`<br>追うべき入札ランキング | ・検索モード: `search_bids` と同一検索引数<br>・選択モード: `bid_refs` (1〜50件、重複不可、検索引数と併用不可)<br>・`preferred_keywords`: 優先語句<br>・`avoid_keywords`: 除外語句<br>・`due_within_days`: 1〜180日 (既定30)<br>・`shortlist_limit`: 1〜50件 | `BidRankingResultSchema`<br>・`rankedBids`: `score` (0-100), `priority` (pursue/review/skip), `reasons`, `risks`, `nextActions` | 本番リモート: **OAuth 2.0 (`mcp:read`)**<br>ローカル: 認証不要 | `readOnlyHint: true`<br>`destructiveHint: false`<br>`idempotentHint: true`<br>`openWorldHint: true` | 単体テスト、キーワード重み付けテスト、選択モード50件制限テスト | 検索モードと選択モードは排他。フィールド名は `priority`。営業優先度の初期判断用。副作用なし。 |
| 5 | `extract_bid_requirements`<br>入札要件抽出MVP | ・`bid_ref` または `bid_key` (必須)<br>・`fetch_documents`: 真偽値 (既定false)<br>・`target_uris`: 最大3件のURL (任意) | `BidRequirementExtractionSchema`<br>・構造化試行項目: 資格等級・地域、提出期限、開札日、必要書類リスト、確認URL | 本番リモート: **OAuth 2.0 (`mcp:read`)**<br>ローカル: 認証不要 | `readOnlyHint: true`<br>`destructiveHint: false`<br>`idempotentHint: false`<br>`openWorldHint: true` | 単体テスト、メタデータ抽出テスト | **資格等級・期限・必要書類を常に抽出できるとは限らない**（元公告・添付に依存し欠損あり）。実装上の注記値 `idempotentHint: false`。原本ファイル非保存。 |
| 6 | `export_bid_shortlist`<br>入札検討shortlist CSV | ・検索モード または 選択モード (`bid_refs` 1〜50件)<br>・`format`: 'csv' (既定) / 'json'<br>・`preferred_keywords` / `avoid_keywords`<br>・`due_within_days`<br>・`shortlist_limit`: 1〜50件<br>・`fetch_documents`: (Public MVPでは無効) | `BidShortlistExportSchema`<br>・`csv`: CSV文字列<br>・`rankedCount`: 件数<br>・`columns`: 16列の列名配列<br>・`jsonContent`: オプション配列 | 本番リモート: **OAuth 2.0 (`mcp:read`)**<br>ローカル: 認証不要 | `readOnlyHint: true`<br>`destructiveHint: false`<br>`idempotentHint: false`<br>`openWorldHint: true` | 単体テスト、選択2件のCSV生成テスト、重複排除テスト | **RFC 4180準拠と断定しない**。「CSV/JSON生成。取得CSVは16列として解析し、選択案件との対応を確認」とする。実装上の注記値 `idempotentHint: false`。Public MVPでは一括資料抽出は無効。 |
| 7 | `search_bids_app`<br>AI Bid Workspace (MCP Apps) | ・`search_bids` と同一入力引数<br>・UIリソース: `ui://jp-bids/search-results.html`<br>・要求権限: `clipboardWrite` | `BidSearchResultSchema`<br>＋MCP Apps対応UI描画 | 本番リモート: **OAuth 2.0 (`mcp:read`)**<br>ローカル: 認証不要 | `readOnlyHint: true`<br>`destructiveHint: false`<br>`idempotentHint: true`<br>`openWorldHint: true` | 本番ClaudeでのUI初期表示、および選択2件のCSVファイル取得・案件対応を確認済み | **MCP Apps非対応のホストではテキスト等へフォールバック。現行本番ChatGPTは未確認**。クリップボード経路の動作は実機未確認。副作用なし。 |

---

## 3. KKJ利用条件と独自機能の整理

### 3.1 官公需情報ポータルサイト（KKJ）公式利用条件（根拠確認中）

1. **データソース情報**:
   - 提供元: 中小企業庁（経済産業省 外局）官公需情報ポータルサイト
   - APIエンドポイント: `http://www.kkj.go.jp/api/`
   - 参照URL: `https://www.kkj.go.jp/s/help/notes/`（ヘルプ・留意事項）
2. **利用許諾ステータス: 【根拠確認中】**:
   - `licenseUrl` や ADR-0006 の存在は利用許諾確認の証拠ではない。
   - 当該ページ本文・該当箇所の利用規約条項（二次利用、API利用、商用・非商用の区分、再配布許諾範囲）はローカルで未取得・未精査である。
   - したがって、公式条件の本文・該当箇所・適用範囲を記録するまで、利用許諾は**「根拠確認中」**として管理し、許諾取得済みとは断定しない。
3. **上流システムへの配慮（実装上の保護策）**:
   - **インスタンス流量制御**: `KkjClient` インスタンス単位でトークンバケットによる 1 req/sec 制御を既定値として設定（※Cloud Runインフラ全体の合計通信量制限ではない）。
   - **メモリ内キャッシュ**: 各インスタンス内で LRUキャッシュ（TTL 10分、最大500件）により同一条件の直近リクエストを保持。
   - **User-Agent設定**: クライアントヘッダーに `JP Bids MCP/{VERSION}` を明記。
   - **タイムアウト**: 15秒タイムアウト、最大2回のリトライ、指数バックオフ（500ms基準）。
   - **原本ファイル非保持**: 公告原本PDFや生XMLデータをサーバーへ永続保存・コミットせず、公式URLの案内にとどめる。
4. **出典メタデータの返却（ADR-0006）**:
   - 各ツール出力に出典情報（データソース名、APIエンドポイント、留意事項URL、免責文言）を付与。

### 3.2 ログ保持に関する整理
- **検索内容（クエリ・入力条件）**: アプリケーション層のデータベース等に永続化しない設計方針をとっている。
- **インフラログ（アクセスログ・エラーログ）**: Cloud Run等のインフラ基盤ログの保存期間・ローテーション・削除設定については、実設定の確認が完了するまで「即時破棄」と断定せず、**「インフラログ実設定確認待ち」**とする。

### 3.3 JP Bids 独自機能と中継機能の分離

| 領域 | 機能名 | 具体的な処理内容・独自性 |
|---|---|---|
| **上流中継・正規化** | `search_bids`<br>`list_recent_bids` | ・47都道府県コード（LG_Code）の解決、XMLからJSONへの正規化、日付範囲の整形、インスタンス単位の流量制御 |
| **独自付加価値 (1)** | **AI Bid Radar** (`rank_bids`) | ・ユーザー指定の優先/除外キーワードおよび残日数に基づき、**0〜100点の適合度スコア**、**3段階判定 (pursue/review/skip)**、理由・リスク・次アクションを独自算出（出力フィールド: `priority`） |
| **独自付加価値 (2)** | **改ざん防止トークン** (`bid_ref`) | ・HMAC署名付きトークンにより、LLMの長文コンテキスト再読込なしに案件スナップショットの即時復元と検証を実現 |
| **独自付加価値 (3)** | **要件構造化試行** (`extract_bid_requirements`) | ・公告テキスト等から資格等級、地域、期限、必要書類等の構造化を試みる（※元公告の記載状況に依存し欠損あり） |
| **独自付加価値 (4)** | **検討リスト出力** (`export_bid_shortlist`) | ・CSV/JSON生成。取得CSVは16列（`columns`）として解析し、選択案件（Key・件名・機関・期限・スコア等）との対応を確認 |
| **独自付加価値 (5)** | **対話型UI** (`search_bids_app`) | ・MCP Apps規格に準拠し、チャットキャンバス内に対話型テーブル（AI Bid Workspace）を描画（※非対応ホストではテキスト等へフォールバック） |

---

## 4. 申請パッケージのローカル整理資料構成

本構成案（および `chatgpt-app-submission-draft-20261021.json`）は、申請に必要な情報をまとめた**ローカル整理資料**です。公式形式のパッケージ、MCP設定、必要資材、実機検証結果がそろうまでは「提出用パッケージ完成」とはしません。

### 4.1 本番接続URLの3層整理
1. **本番設定（既知）**:
   - エンドポイントURL: `https://mcp.bid-jp.com/mcp`（Cloud Run等での公開稼働設定）
   - 接続方式: **HTTPS上のStreamable HTTP（実装: `StreamableHTTPServerTransport`）**、OAuth 2.0認可、Scope: `mcp:read`
2. **ChatGPTでの接続検証（未実施）**:
   - ChatGPT / OpenAI Apps SDK 環境から実際に当該エンドポイントへ接続し、ツール呼び出し・レスポンス疎通ができるかの実機検証は未実施。
3. **申請画面での設定確認（未確認）**:
   - OpenAI管理画面（プラグイン/Apps登録フォーム）上で指定される接続トランスポート、認証設定、ヘッダー仕様の確認は未実施。

### 4.2 規約URLの整理
- プライバシーポリシー: `https://mcp.bid-jp.com/privacy`
- 利用規約: `https://mcp.bid-jp.com/terms`
※サービス固有URLとして設定。企業サイト（`sugu-kuru.co.jp`）の全社規約ではなくサービス規約を適用。

### 4.3 テストケース構成（全7ツール網羅・ポジティブ9件・ネガティブ3件）
- **TC-01 (`search_bids`)**: 鹿児島県IT関連入札の検索（0件マッチも正常結果）
- **TC-02 (`search_bids`)**: 農林水産省役務入札の絞り込み
- **TC-03 (`list_recent_bids`)**: 東京都の直近7日間の公告日一覧
- **TC-04 (`get_bid_detail`)**: 指定Keyまたは署名付きbid_refによる詳細・公式リンク復元
- **TC-05 (`rank_bids`)**: キーワード・残日数による優先度スコアリング（`priority`, 期限未取得時は `deadlineStatus: 'unknown'`）
- **TC-06 (`extract_bid_requirements`)**: 指定案件の要件構造化試行
  - 前提条件: 事前検索で返された有効な `bid_ref` を使用（対象案件が得られなければ**未実施**と記録）
  - パラメータ: `fetch_documents: false` を明示し、添付本文解析の試験と分離
  - 期待結果: 実装は `z.string().optional()`（`null` 不可）。取得できない項目は省略され、不足情報は `missingRequirements` 等で確認できる。資格・期限・必要書類を推測で補完しない
- **TC-07 (`export_bid_shortlist`)**: 選択2案件のCSVエクスポート（16列対応確認）
- **TC-08 (`search_bids_app`)**: ChatGPT向け対話型UI表示試験（上限3件）
  - 合格条件: **ChatGPT向け試験ではUI表示（`ui://jp-bids/search-results.html`）を必須**とする。テキストだけ返った場合はUI試験不合格と判定。検索上限は3件とし、0件でもUIの空状態が表示されることを確認
- **TC-08b (`search_bids_app`)**: 非対応ホスト向けフォールバック試験（別ケースに分離）
  - 合格条件: MCP Apps非対応ホストにおいて、テキスト要約および `structuredContent` に正常フォールバックすることを確認
- **NC-01**: 民間求人検索要求の拒絶
- **NC-02**: 代理入札・応募要求の拒絶
- **NC-03**: キー・参照なしでの詳細推測要求の拒絶

---

## 5. 残る確認事項（管理画面確認待ちおよび運用・検証待ち）

| # | 確認項目 | 現在の状況 | 必要なアクション / 方針 |
|---|---|---|---|
| 1 | **KKJ利用条件本文の精査** | 根拠確認中 | `https://www.kkj.go.jp/s/help/notes/` 本文を取得し、二次利用・API利用の該当条項・適用範囲を精査・記録する |
| 2 | **ChatGPTでの本番接続検証** | 未実施 | 本番エンドポイント `https://mcp.bid-jp.com/mcp` に対し、ChatGPT環境からツール呼出・疎通の実機検証を行う |
| 3 | **申請画面での設定確認** | 管理画面待ち | OpenAI管理画面で要求される接続トランスポート形式、ヘッダー仕様、認証形式を確認する |
| 4 | **ドメイン確認チャレンジ** | 管理画面待ち | 申請画面が提示するチャレンジ方式（DNS TXT等に決め打ちせず指示に従う）を確認して実施 |
| 5 | **法人確認 (Publisher Identity)** | 管理画面待ち | 申請画面で提示される認証要件（D-U-N-S番号等を事前必須扱いせず指示に従う）を確認して対応 |
| 6 | **インフラログ保存・削除設定** | 実設定確認待ち | Cloud Run等のインフラ側ログ保存期間・削除ポリシーの実設定を確認する |
| 7 | **OpenAI 既存申請履歴** | 管理画面待ち | 過去の申請レコード・ドラフトの有無を管理画面上で確認する |
