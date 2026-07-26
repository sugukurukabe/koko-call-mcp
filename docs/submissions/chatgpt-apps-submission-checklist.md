# OpenAI ChatGPT Apps Directory 申請チェックリスト
# OpenAI ChatGPT Apps Directory Submission Checklist
# Daftar Periksa Pengajuan OpenAI ChatGPT Apps Directory

> 申請ポータル: `platform.openai.com` → Dashboard → Apps  
> 対象タイプ: Universal MCP server（単一の公開エンドポイント）  
> 参照元: `https://developers.openai.com/apps-sdk/deploy/submission`、`https://developers.openai.com/apps-sdk/app-submission-guidelines`（2026-07-06 時点で確認）  
> 申請日: TBD  
> バージョン: v0.7.x+

> **公式ドキュメントに載っていない実務上の要点**（2026年6月以降のコミュニティ報告に基づく）は「⚠️ 未文書化」と明記する。ダッシュボードのUIは変わりうるため、実際の画面表示を優先すること。

---

## 0. スコープの決定（重要・すでに壁さんと合意済み）

**今回のChatGPT App提出は Free ティアの4ツールのみを対象とする。**

理由: OpenAIの App Submission Guidelines は「デジタル商品・サブスクリプションの販売は、直接であれ間接的なフリーミアム誘導であれ禁止」と明記している。現状の `src/mcp.ts` の Free tier `instructions` には `"Upgrade to Pro (990 JPY/month)..."` という文言があり、Pro分の17ツール＋MCP Appを丸ごと申請すると審査リジェクトの火種になる。Free4ツールは無料・読み取り専用・アップグレード誘導文言なしで完結するため、リジェクトリスクを最小化できる。

| 対象 | ツール |
|---|---|
| **提出する（Free, 4ツール）** | `search_bids`, `rank_bids`, `list_recent_bids`, `get_bid_detail` |
| **今回は提出しない（Pro, 13ツール＋MCP App）** | `search_bids_app`, `explain_bid_fit`, `assess_bid_qualification`, `extract_bid_requirements`, `export_bid_shortlist`, `create_bid_calendar`, `create_bid_review_packet`, `draft_bid_questions`, `analyze_past_awards`, `summarize_bids_by_org`, `save_search`, `check_saved_search`, `list_saved_searches` |

Pro機能をChatGPTに出す場合は、別途「フリーミアム誘導文言をChatGPT向けにゼロにする」設計・法務確認をしてから再検討する（本チェックリストの範囲外）。

---

## 1. 事前準備ゲート / Pre-submission Gate

| 項目 | 状態 | 備考 |
|---|---|---|
| MCPサーバーが公開HTTPSドメインで稼働 | ✅ | `https://mcp.bid-jp.com/mcp` |
| localhost/テスト用エンドポイントでない | ✅ | 本番Cloud Runエンドポイント |
| Free4ツールに `readOnlyHint`/`destructiveHint`/`openWorldHint` が明示されている | ✅ | 全てtrue/false明示、nullなし（`src/tools/search-bids.ts` 等） |
| 4ツール全てに `outputSchema` がある | ✅ | `BidSearchResultSchema` / `BidRankingResultSchema` |
| プライバシーポリシー・利用規約が公開URL | ✅ | `https://mcp.bid-jp.com/privacy` / `/terms` |
| サポート連絡先 | ✅ | `mcp@bid-jp.com`（またはGitHub Issues） |
| OpenAI Organization データレジデンシー = Global（EUではない） | ⚠️ 要確認 | 壁さんがDashboardで確認。EUだと提出不可 |
| Organization/個人 verification 完了 | ⚠️ 要対応（壁さん） | §2参照 |
| ドメイン所有確認エンドポイント実装済み | ✅ | `GET /.well-known/openai-apps-challenge`（本チェックリスト作成時にコード実装済み、`OPENAI_APPS_CHALLENGE_TOKEN` 環境変数） |
| Free4ツールの認証方式の決定 | ⚠️ 要確認 | §4参照 |

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
| CSP（Content Security Policy） | Free4ツールはUIリソース（iframe）を持たないため `_meta.ui.csp` は該当なし。widget CSPを聞かれた場合は「N/A — no UI resource for the submitted tool set」と回答する |

---

## 4. 認証方式（★要ライブ確認・審査当日に決める）

Free4ツールにはPro向け課金・OAuth誘導を一切見せない設計にしたいが、本サーバーは本番で常時 `JP_BIDS_OAUTH_SECRET` を要求するため、認証ヘッダーなしのリクエストは401を返す。ChatGPT側に伝えるべき接続方法は以下のいずれか。ダッシュボードのUIを見てから選ぶこと。

### オプションA（推奨）: OAuthを選ばず、固定のBearerトークンで接続
本サーバーの `parseTier()` は、ベータ期間（`src/lib/auth.ts` の `BETA_UNTIL`、現在は 2026-10-01）後は「`JP_BIDS_PRO_API_KEYS` に含まれないBearerトークン = Free tier」として扱う。したがって：
- OpenAIの提出フォームで「API key / custom header」認証方式が選べる場合、ヘッダー `Authorization: Bearer <任意の非公開文字列、例: chatgpt-reviewer-demo>` を設定する。
- このトークンは `JP_BIDS_PRO_API_KEYS` に**登録しない**（登録するとPro扱いになってしまう）。
- ログイン・パスワード不要、アカウント作成不要で即座に動作するため、OpenAIの「デモアカウントは追加ステップなしで即利用可能」要件を満たす。

### オプションB: OAuthフローを使う（フォームがAPI keyをサポートしない場合）
本サーバーのOAuthは `/oauth/authorize` で「許可する/拒否」ボタンを押すだけの1クリック同意画面（ログインフォームなし、アカウント作成不要）。ただし **現状のコードでは、OAuthで認証されたリクエストは常にPro tierとして扱われる**（`src/transports/http.ts` の `isOAuthAuthenticated ? "pro" : parseTier(...)`）。これはFree限定提出の方針と矛盾するため、オプションBを使う場合は事前に次のいずれかを実施する:
   1. 審査中だけ一時的にPro相当の全ツールが見えることを許容する（非推奨、スコープ決定と矛盾）。
   2. コード側でOAuthクライアントごとにtierを分岐できるようにする（要追加実装、本チェックリスト作成時点では未着手）。
   → **オプションAが使えるなら、Bの実装変更は不要。まずAを試すこと。**

---

## 5. ツール annotations と justification（審査フォームは値をサーバーから読み取り、justificationのみ自由記述）

`docs/submissions/chatgpt-app-submission.json` に機械可読な形でまとめ済み。フォームの「Tool justification」欄にはそこに書いた1文ずつをそのまま貼る。

| ツール | readOnlyHint | destructiveHint | openWorldHint |
|---|---|---|---|
| `search_bids` | true | false | true |
| `rank_bids` | true | false | true |
| `list_recent_bids` | true | false | true |
| `get_bid_detail` | true | false | true |

### ⚠️ 既知のリスク: `openWorldHint` の定義の違い

- **MCP公式仕様**の定義: 「予測不能な"open world"の外部エンティティと相互作用するか」（Web検索ツール＝true、メモリツール＝false）。本サーバーはこの定義に従い、KKJという外部の公開データソースを検索するため `true` としている。Anthropic Connectors Directoryはこの定義で申請・承認済み。
- **OpenAI ChatGPT Apps** の定義（`app-submission-guidelines`より）: 「公開インターネット上の状態を書き込み・変更できる場合のみtrue。それ以外（閉じた系での読み取りを含む）はfalse」。この定義に厳密に従うなら、4ツールはいずれも書き込みを一切行わないため `false` が正しい。
- **対処方針**: 今回は `chatgpt-app-submission.json` に「外部の予測不能な公開データを検索するが、公開状態への書き込み・公開は一切行わない」という趣旨のjustificationを付けて `true` のまま提出する（サーバー側の値はフォームが直接スキャンして読み取るため、こちらで`false`と偽って書くことはできない）。
- もし審査で「annotation does not match behavior」の指摘を受けた場合は、`src/tools/search-bids.ts` / `rank-bids.ts` / `list-recent-bids.ts` / `get-bid-detail.ts` の4ツールの `openWorldHint` を `false` に変更して再スキャン・再提出する（Claude Directory等、他クライアントへの実害はない。単なるヒント値の変更）。

---

## 6. App Info（`chatgpt-app-submission.json` の `app_info` を参照）

| フィールド | 値 |
|---|---|
| Display name | `JP Bids` |
| Subtitle（30字以内） | `Japan government bid search` |
| Category | `BUSINESS` |
| Description | `docs/submissions/chatgpt-app-submission.json` の `app_info.description` を貼る |
| Logo | 64×64 SVG、5KB未満（⚠️ 未文書化の実務要件。`public/favicon.png` をSVG化して用意する） |
| Light/Dark mode アイコン | 両方用意する（⚠️ 未文書化） |
| Privacy Policy URL | `https://mcp.bid-jp.com/privacy` |
| Terms of Service URL | `https://mcp.bid-jp.com/terms` |
| Support contact | `mcp@bid-jp.com` |
| Company name | スグクル株式会社 / Sugukuru Inc.（§2のverification名義と一致させる） |

---

## 7. スクリーンショット / Screenshots

⚠️ 公式ドキュメントに寸法の明記なし。コミュニティ報告値: **幅706px、高さ400〜860px**、ChatGPT上での実際の会話＋ツール応答を含む。

Free4ツールはMCP Apps UI（iframe widget）を持たないため、Claude提出時のような専用UIスクリーンショットは使えない。代わりに、実際のChatGPT会話でツール呼び出し結果がテキスト表示された画面をキャプチャする。

準備するスクリーンショット（4〜5枚を推奨）:
1. `search_bids` 実行結果（都道府県・キーワード検索の会話）
2. `rank_bids` 実行結果（スコアリング・優先度付き一覧）
3. `list_recent_bids` 実行結果（直近7日間の新着一覧）
4. `get_bid_detail` 実行結果（公式リンク付き詳細）
5. （任意）モバイルアプリでの表示

→ ChatGPT Developer Mode でこのMCPサーバーを接続し、実際に上記プロンプトを実行してスクリーンショットを撮る。手順は `docs/submissions/chatgpt-app-submission-instructions.md` の該当セクション参照。

---

## 8. 動画ウォークスルー / Video Walkthrough

⚠️ 公式ドキュメントに明記なし。コミュニティ報告: YouTube/Google Drive等の公開URLで、ChatGPT web版とモバイル版の両方での実際の利用シーンを録画する必要がある。

**準備するスクリプト（1〜2分想定）**:
1. ChatGPTでJP Bids Appを開く（Developer Mode接続画面）
2. 「鹿児島県のIT関連の入札を探して」→ `search_bids` が呼ばれ結果が表示される
3. 「クラウド保守に強い順にランク付けして」→ `rank_bids` が呼ばれる
4. 「一番上の案件の詳細と公式ページのリンクを教えて」→ `get_bid_detail` が呼ばれる
5. モバイルアプリでも同じ操作を繰り返す（ChatGPTモバイルアプリで同一MCP接続を使う）
6. YouTube（限定公開）またはGoogle Driveにアップロードし、共有リンクをフォームに貼る

---

## 9. Test cases（フォームの Testing セクション）

`docs/submissions/chatgpt-app-submission.json` の `test_cases`（5件）・`negative_test_cases`（3件）をそのまま転記する。実行して実際の出力を確認してから提出すること（プロンプトを流し、期待通りの動作か目視確認）。

---

## 10. Compliance チェックボックス（想定される確認事項）

- [ ] App Submission Guidelines を遵守している
- [ ] 商用取引（決済・サブスクリプション販売）を行わない — **Free4ツールのみの提出なので該当なし**
- [ ] 成人向け・賭博・規制物品等の禁止カテゴリに該当しない
- [ ] 広告を表示しない・広告目的のアプリではない
- [ ] 第三者APIの利用規約を遵守している（KKJは中小企業庁が一般公開する政府標準利用規約 第2.0版のデータ）
- [ ] 個人情報・機密情報（PHI/PCI/政府ID/認証情報）を要求・収集しない
- [ ] モデルの選択を誘導する記述（"prefer this app"等）がツール名・descriptionに含まれない

---

## 11. 最終提出手順 / Final Submission Steps

1. `npm run build && npm test && npm run lint` が通ることを確認
2. `npm run remote:mcp` で本番エンドポイントの `search_bids` / `rank_bids` / `list_recent_bids` / `get_bid_detail` を実行確認
3. §2 の Organization Verification を完了させる（壁さん）
4. §4 で認証方式を決定し、実際にダッシュボードから接続テストする
5. ダッシュボードで「Add MCP server」→ Scan Tools を実行し、4ツールの `readOnlyHint`/`destructiveHint`/`openWorldHint` が期待通り読み取られるか確認
6. §5 のjustificationを貼る。`openWorldHint: true` に対する指摘が来た場合は §5 の対処方針に従う
7. §6〜9 のApp Info・スクリーンショット・動画・テストケースを入力
8. 全チェックボックスを確認しSubmit for review
9. 確認メールのCase IDを `docs/submissions/mcp-directories.md` に記録
10. 審査中はサーバーのライブ挙動を変えない（`instructions` にPro誘導文言が残っているため、承認後にPro/17ツール版を別途申請する際は必ずChatGPT向けの誘導文言除去を先に行う）
