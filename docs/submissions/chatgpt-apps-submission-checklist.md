# OpenAI ChatGPT Apps Directory 申請チェックリスト
# OpenAI ChatGPT Apps Directory Submission Checklist
# Daftar Periksa Pengajuan OpenAI ChatGPT Apps Directory

> 申請ポータル: `platform.openai.com` → Dashboard → Apps  
> 対象タイプ: Universal MCP server（単一の公開エンドポイント）  
> 参照元: `https://developers.openai.com/apps-sdk/deploy/submission`、`https://developers.openai.com/apps-sdk/app-submission-guidelines`  
> 最新のローカル準備状況・残課題正本: [`OPENAI_SUBMISSION_LOCAL_PREPARATION_20261021.md`](./OPENAI_SUBMISSION_LOCAL_PREPARATION_20261021.md)  
> 申請日: 未提出 (`NOT_SUBMITTED`)  
> 対象公開バージョン: `0.10.2` (`JP_BIDS_PROFILE=public_mvp` / Cloudflare エッジ `mcp.bid-jp.com` + Cloud Run `jp-bids-mcp-00091-jiq` 稼働済み・npm `jp-bids-mcp@0.10.2`・MCP Registry `0.10.2` 公開済み)

> **ローカルパッケージ検査の状態に関する重要事項**:
> `node scripts/build-openai-package.mjs`（6ファイル構成ZIP・65項目のローカル構造/画像/ZIP検査）の判定ステータスは **`LOCAL_PARTIAL_VALIDATION_WITH_SCHEMA_WARNING_NOT_SUBMITTED`** であり、コアプラグインスキーマと OpenAI 拡張フィールドの差異に関するスキーマ警告 **`CORE_MCP_OPENAI_EXTENSION_MISMATCH`** を含みます。これはローカル構造検査の通過であり、OpenAI 申請ポータルでの互換性確認・提出完了・審査合格を意味しません。また、現行 `0.10.2` ビルドにおける実 ChatGPT クライアント上での描画・操作検証、KKJ二次利用条件根拠確認（`OAI-01/04`）、Organization/Business Verification、ドメインチャレンジ検証、提出 Case ID 取得は未完了の残課題です。

> **公式ドキュメントに載っていない実務上の要点**（コミュニティ報告に基づく）は「⚠️ 未文書化」と明記する。ダッシュボードのUIは変わりうるため、実際の画面表示を優先すること。

---

## 0. スコープの決定（現行 Public MVP 公開7ツール）

**今回のChatGPT App提出は `public_mvp` プロファイルの公開7ツール（完全無料・読み取り専用・公開面の課金導線ゼロ）を対象とする。**

理由: リポジトリ内にはローカル開発プロファイル（`JP_BIDS_PROFILE=full_local`）向けに `src/lib/billing.ts` および `package.json` の `stripe` 依存が残存しているが、公開エンドポイント `https://mcp.bid-jp.com/mcp` で稼働する `JP_BIDS_PROFILE=public_mvp` では課金ツール・Pro API キー判定・アップグレード誘導文言を一切登録せず実行時の Stripe 通信もゼロであり、**無料・読み取り専用の公開7ツールのみ** を公開する境界が分離されている。これにより OpenAI App Submission Guidelines の「サブスクリプション販売・フリーミアム誘導の禁止」に準拠しつつ、`AI Bid Workspace`（MCP Apps UI）と16列CSV/JSON出力まで審査対象に含められる。

| 区分 | ツール |
|---|---|
| **提出する（`public_mvp`, 公開7ツール・無料）** | `search_bids`, `list_recent_bids`, `get_bid_detail`, `search_bids_app`（UI: `ui://jp-bids/search-results.html`）, `rank_bids`, `extract_bid_requirements`, `export_bid_shortlist` |
| **公開エンドポイント非公開（ローカル `JP_BIDS_PROFILE=full_local` 専用 15ツール）** | `explain_bid_fit`, `assess_bid_qualification`, `create_bid_calendar`, `create_bid_review_packet`, `draft_bid_questions`, `analyze_past_awards`, `summarize_bids_by_org`, `save_search`, `check_saved_search`, `list_saved_searches`, および Investor Radar 5ツール |

---

## 1. 事前準備ゲート / Pre-submission Gate

| 項目 | 状態 | 備考 |
|---|---|---|
| MCPサーバーが公開HTTPSドメインで稼働 | ✅ `0.10.2` 本番稼働済み | `https://mcp.bid-jp.com/mcp` は Cloudflare Workers エッジ (`Full (strict)`) + Cloud Run `jp-bids-mcp-00091-jiq` (`100%`) で稼働・検証済み |
| localhost/テスト用エンドポイントでない | ✅ | 申請対象URLは `https://mcp.bid-jp.com/mcp` |
| 公開7ツールに `readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint` が明示されている | ✅ | 全てtrue/false明示、nullなし（`src/tools/*.ts`） |
| 公開7ツール全てに `outputSchema` がある | ✅ | `BidSearchResultSchema` / `BidRankingResultSchema` / `BidShortlistExportSchema` 等 |
| プライバシーポリシー・利用規約が公開URL | ✅ | `https://mcp.bid-jp.com/privacy` / `/terms` |
| サポート連絡先 | ✅ | `mcp@bid-jp.com`（またはGitHub Issues） |
| KKJ 二次利用・第三者提供条件の事前確認（OAI-01/04） | ⚠️ 未完了（要確認: 壁さん） | `OPENAI_SUBMISSION_LOCAL_PREPARATION_20261021.md` §OAI-01 参照 |
| OpenAI Organization データレジデンシー = Global（EUではない） | ⚠️ 未確認（要確認: 壁さん） | 壁さんがDashboardで確認。EUだと提出不可 |
| Organization/個人 verification 完了 | ⚠️ 未完了（要対応: 壁さん） | §2参照 |
| ドメイン所有確認エンドポイント実装 & ポータルチャレンジ検証 | ⚠️ コード実装済み・ポータル検証未実施 | `GET /.well-known/openai-apps-challenge` 実装済み。申請時のトークン設定・Verify Domain 操作は未実施 |
| `0.10.2` バンドルでの実 ChatGPT 接続・UI・動画・スクリーンショット確認 | ⚠️ 未実施 | ローカル模擬ブラウザ（13項目）およびエッジ経由 OAuth/MCP E2E のみ完了。過去版（2026-10-24 `9afe0c6`）の実機記録で代用せず、現行 `0.10.2` 本番で実 ChatGPT 再確認・撮影を行う |

---

## 2. Developer/Organization Verification（壁さんが手動で実施）

OpenAIはAPIやブラウザ自動操作からの本人確認を許可していない（Persona等のID確認を含むため）。以下は壁さんが自分でダッシュボードにログインして行う。

1. `platform.openai.com` にログイン。
2. Settings → Organization → General を開く。
3. **公開する名義を決める**:
   - 個人名義で公開する場合 → Individual verification（身分証アップロード）。
   - 法人名義（スグクル株式会社 / Sugukuru Inc.）で公開する場合 → Business verification（法人確認、数日かかる場合あり）。
   - → 法人名義を推奨（Claude Directory申請でも `Sugukuru Inc.` を使用しているため一貫性が保てる）。
4. **重要**: 提出フォームの「Developer name」は、ここで確認された名義と**完全一致**させる必要がある。不一致はリジェクト理由になる（コミュニティ報告あり）。
5. Global data residency のプロジェクトであることを確認する（EU data residency のプロジェクトは提出不可）。EUプロジェクトしかない場合は新規プロジェクトを作成する。
6. 自分の役割（Owner または `api.apps.write` 権限）でApp Draftを作成できることを確認する。

---

## 3. MCP Server 情報

| フィールド | 値 |
|---|---|
| MCP Server URL（審査用の実エンドポイント） | `https://mcp.bid-jp.com/mcp` |
| Template MCP Server URL | 不要（全ユーザー同一エンドポイントのUniversal URL） |
| Transport | Streamable HTTP |
| UI Resource (`search_bids_app`) | `ui://jp-bids/search-results.html` |
| CSP（Content Security Policy） | `_meta.ui.csp` = `{ connectDomains: [], resourceDomains: [], frameDomains: [] }`（単一HTML自己完結バンドル、外部通信・外部アセット読み込みゼロ） |

---

## 4. 認証方式（OAuth 2.0 1クリック同意）

本番サーバー（`JP_BIDS_PROFILE=public_mvp`）は OAuth 2.0（Authorization Code + PKCE + Dynamic Client Registration）を提供する。

- `/oauth/authorize` はアカウント作成・パスワード入力・課金登録を一切求めない **1クリック同意画面**（「許可する / 拒否」のみ）であり、OpenAI審査員も追加の資格情報なしで即座に検証可能。
- OAuth 認証後もサーバープロファイルは `public_mvp` 固定のため、公開7ツールのみが表示され、非公開15ツールや有料プラン案内が露出することはない。
- 審査フォームで「Authentication」を選択する際は **OAuth 2.0（Dynamic Client Registration 対応）** を指定する（ChatGPT Developer Mode での接続手順と同様）。万一フォームが静的クライアントID入力を必須とする場合は `/oauth/register` で事前発行した `client_id` を使用する。

---

## 5. ツール annotations と justification（審査フォームは値をサーバーから読み取り、justificationのみ自由記述）

`docs/submissions/chatgpt-app-submission.json` に機械可読な形でまとめ済み。フォームの「Tool justification」欄にはそこに書いた1文ずつをそのまま貼る。

| ツール | readOnlyHint | destructiveHint | idempotentHint | openWorldHint |
|---|---|---|---|---|
| `search_bids` | true | false | true | true |
| `list_recent_bids` | true | false | true | true |
| `get_bid_detail` | true | false | true | true |
| `rank_bids` | true | false | true | true |
| `extract_bid_requirements` | true | false | false | true |
| `export_bid_shortlist` | true | false | false | true |
| `search_bids_app` | true | false | true | true |

### ⚠️ 既知のリスク: `openWorldHint` の定義の違い

- **MCP公式仕様**の定義: 「予測不能な"open world"の外部エンティティと相互作用するか」（Web検索ツール＝true、メモリツール＝false）。本サーバーはこの定義に従い、KKJという外部の公開データソースを検索するため `true` としている。Anthropic Connectors Directoryはこの定義で申請・承認済み。
- **OpenAI ChatGPT Apps** の定義（`app-submission-guidelines`より）: 「公開インターネット上の状態を書き込み・変更できる場合のみtrue。それ以外（閉じた系での読み取りを含む）はfalse」。この定義に厳密に従うなら、公開7ツールはいずれも書き込みを一切行わないため `false` が正しい。
- **対処方針**: 今回は `chatgpt-app-submission.json` に「外部の予測不能な公開データを検索するが、公開状態への書き込み・公開は一切行わない」という趣旨のjustificationを付けて `true` のまま提出する（サーバー側の値はフォームが直接スキャンして読み取るため、こちらで`false`と偽って書くことはできない）。
- もし審査で「annotation does not match behavior」の指摘を受けた場合は、公開7ツールの `openWorldHint` を `false` に変更して再デプロイ・再スキャンする。

---

## 6. App Info（`chatgpt-app-submission.json` の `app_info` および `plugins/jp-bids-mcp/` を参照）

| フィールド | 値 |
|---|---|
| Display name | `JP Bids` |
| Subtitle | `Japan government procurement & bid intelligence`（※30字制限がある場合は `Japan government bid search`） |
| Category | `BUSINESS` |
| Description | `docs/submissions/chatgpt-app-submission.json` の `app_info.description` を貼る |
| Logo / Icons | `plugins/jp-bids-mcp/assets/` 内の検証済みPNG（および必要に応じ64×64 SVG）を使用（`node scripts/build-openai-package.mjs` で検証済み） |
| Privacy Policy URL | `https://mcp.bid-jp.com/privacy` |
| Terms of Service URL | `https://mcp.bid-jp.com/terms` |
| Support contact | `mcp@bid-jp.com` |
| Company name | スグクル株式会社 / Sugukuru Inc.（§2のverification名義と一致させる） |

---

## 7. スクリーンショット / Screenshots

⚠️ 公式ドキュメントに寸法の明記なし。コミュニティ報告値: **幅706px、高さ400〜860px**、ChatGPT上での実際の会話＋ツール応答（UIワークスペース含む）をキャプチャする。

準備するスクリーンショット（4〜5枚を推奨）:
1. `search_bids_app` 実行結果（ChatGPT上の `AI Bid Workspace` カード一覧・詳細表示）
2. `search_bids` / `get_bid_detail` 実行結果（都道府県・キーワード検索と公式リンク付き詳細）
3. `rank_bids` 実行結果（スコアリング・優先度付き一覧）
4. `extract_bid_requirements` / `export_bid_shortlist` 実行結果（要件整理と16列CSV/手動取得欄）
5. （任意）モバイルアプリでの表示

→ ChatGPT Developer Mode で `https://mcp.bid-jp.com/mcp` を接続し、実際に上記プロンプトを実行してスクリーンショットを撮る。

---

## 8. 動画ウォークスルー / Video Walkthrough

⚠️ 公式ドキュメントに明記なし。コミュニティ報告: YouTube/Google Drive等の公開URLで、ChatGPT web版とモバイル版の両方での実際の利用シーンを録画する必要がある。

**準備するスクリプト（1〜2分想定）**:
1. ChatGPTでJP Bids Appを開く（Developer Mode接続・OAuth 1クリック同意）
2. 「東京都のIT関連入札をUIワークスペースで最大3件表示して」→ `search_bids_app` が呼ばれ `AI Bid Workspace` が表示される
3. ワークスペース上で案件を選択し「選択CSV」を実行（またはチャットで `rank_bids` → `get_bid_detail` を実行）
4. モバイルアプリでも同じ検索・詳細確認を実行する
5. YouTube（限定公開）またはGoogle Driveにアップロードし、共有リンクをフォームに貼る

---

## 9. Test cases（フォームの Testing セクション）

`docs/submissions/chatgpt-app-submission.json`（および `docs/submissions/chatgpt-app-submission-draft-20261021.json`）の公開7ツール対応テストケース（positive 5件 `TC-01`〜`TC-05`・negative 3件 `NC-01`〜`NC-03`）を参照する。実行して実際の出力を確認してから提出すること。最新の未解決確認項目は `docs/submissions/OPENAI_SUBMISSION_LOCAL_PREPARATION_20261021.md` を優先すること。

---

## 10. Compliance チェックボックス（想定される確認事項）

- [ ] App Submission Guidelines を遵守している
- [ ] 商用取引（決済・サブスクリプション販売）を行わない — **公開7ツール（Public MVP）は完全無料で課金機能なし**
- [ ] 成人向け・賭博・規制物品等の禁止カテゴリに該当しない
- [ ] 広告を表示しない・広告目的のアプリではない
- [ ] 第三者APIの利用条件を確認・遵守している（出典: 中小企業庁 官公需情報ポータルサイト `https://www.kkj.go.jp/s/help/notes/` ※二次利用条件の公式根拠確認は `OPENAI_SUBMISSION_LOCAL_PREPARATION_20261021.md` を参照し、未確認の規約名を断定しない）
- [ ] 個人情報・機密情報（PHI/PCI/政府ID/認証情報）を要求・収集しない
- [ ] モデルの選択を誘導する記述（"prefer this app"等）がツール名・descriptionに含まれない

---

## 11. 最終提出手順 / Final Submission Steps

1. `npm run build && npm test && npm run lint` および `node scripts/build-openai-package.mjs` が通ることを確認
2. 本番エンドポイントの公開7ツール（`search_bids` / `list_recent_bids` / `get_bid_detail` / `rank_bids` / `extract_bid_requirements` / `export_bid_shortlist` / `search_bids_app`）を過剰アクセスにならない最小回数で確認
3. §2 の Organization Verification を完了させる（壁さん）
4. §4 で認証方式を決定し、実際にダッシュボードから接続テストする
5. ダッシュボードで「Add MCP server」→ Scan Tools を実行し、公開7ツールの `readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint` が期待通り読み取られるか確認
6. §5 のjustificationを貼る。`openWorldHint: true` に対する指摘が来た場合は §5 の対処方針に従う
7. §6〜9 のApp Info・スクリーンショット・動画・テストケースを入力
8. 全チェックボックスを確認しSubmit for review
9. 確認メールのCase IDを `docs/submissions/mcp-directories.md` に記録
10. 審査中はサーバーのライブ挙動（ツール名・スキーマ・OAuth構成）を変えない
