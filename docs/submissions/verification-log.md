# 申請証跡 / Verification Log
# 申請証跡 / Submission Evidence Log
# Log Bukti Pengajuan

> この記録を申請ポータルの "Additional notes" または内部証跡として使用する  
> Use this log in the "Additional notes" field of the submission portal or as internal evidence  
> Gunakan log ini di kolom "Additional notes" pada portal pengajuan atau sebagai bukti internal

---

## 最新検証 / Latest Verification Run

**実施日 / Date**: 2026-06-28 01:12 JST  
**実施者 / Operator**: kabe  
**対象 URL / Endpoint**: https://mcp.bid-jp.com/mcp  
**MCP-Protocol-Version**: 2025-11-25  
**Tier**: Free key (beta Pro surface, 全17ツール)  
**使用ツール**: npm run remote:health + npm run remote:mcp

### remote:health check（実行済み / completed）

```
JP_BIDS_REMOTE_BASE_URL=https://mcp.bid-jp.com npm run remote:health
https://mcp.bid-jp.com/readyz OK
https://mcp.bid-jp.com/mcp GET correctly returns 405
```

### local unit/integration tests（実行済み / completed locally）

```
npm run build — TypeScript + Vite build OK
npm test — 121 tests passed
npm run lint — clean
```

### remote:mcp check (本番エンドポイント)

2026-06-28に `ssw-compass-prod-494613` project の Cloud Run service `jp-bids-mcp` へデプロイ済み。`mcp.bid-jp.com` の本番domainで全チェックPASS。

```
実行コマンド:
JP_BIDS_REMOTE_BASE_URL=https://mcp.bid-jp.com npm run remote:mcp

実行日時: 2026-06-28 01:12 JST
Cloud Run revision: jp-bids-mcp-00038-mjg

[1/6] tools/list + annotation parity
  ✅ all 17 tools present
  ✅ all tools have title
  ✅ all expected readOnlyHint values passed

[2/6] prompts/list
  ✅ morning_bid_briefing
  ✅ bid_discovery_workspace
  ✅ competitor_radar
  ✅ bid_review_packet_workflow
  ✅ qualification_and_question_draft
  ✅ bid_due_alert

[3/6] resources/list
  ✅ attribution://kkj
  ✅ docs://api-reference
  ✅ codes://prefectures
  ✅ ui://jp-bids/search-results.html

[4/6] representative tool calls
  ✅ search_bids call succeeds
  ✅ attribution is KKJ
  ✅ get_bid_detail call succeeds
  ✅ get_bid_detail returned 2 resource_link content blocks
  ✅ rank_bids call succeeds

Verification Summary:
  ✅ ALL CHECKS PASSED — ready for Anthropic submission on https://mcp.bid-jp.com/mcp
```

### Domain cutover note

`mcp.bid-jp.com` is mapped to the production Cloud Run service in `ssw-compass-prod-494613 / asia-northeast1`. The deployed revision `jp-bids-mcp-00038-mjg` passed `remote:health` and `remote:mcp`.

### Public metadata endpoints（実行済み / completed）

```
https://mcp.bid-jp.com/privacy                                            OK 200 text/html
https://mcp.bid-jp.com/favicon.png                                        OK 200 image/png
https://mcp.bid-jp.com/.well-known/mcp/server-card.json                   OK 200 application/json
https://mcp.bid-jp.com/.well-known/agents.json                            OK 200 application/json
https://mcp.bid-jp.com/.well-known/oauth-protected-resource/mcp           OK 200 application/json
https://mcp.bid-jp.com/.well-known/oauth-authorization-server             OK 200 application/json
```

---

## MCP Inspector 手動検証 / MCP Inspector Manual Verification

### 接続方法

```bash
npx @modelcontextprotocol/inspector@latest \
  --header "Authorization: Bearer <pro-key>" \
  http://localhost:8080/mcp     # ローカル
# または
npx @modelcontextprotocol/inspector@latest \
  --header "Authorization: Bearer <pro-key>" \
  https://mcp.bid-jp.com/mcp   # 本番
```

### 検証済み項目

| 項目 | 状態 | 備考 |
|---|---|---|
| tools/list — 17ツール一覧 | 未実施 | 本番URL + Pro reviewer keyで実施 |
| 各ツールの title 確認 | 未実施 | |
| 各ツールの annotations (readOnlyHint/destructiveHint) 確認 | 未実施 | |
| outputSchema 一致確認 | 未実施 | |
| search_bids 実行 | 未実施 | |
| get_bid_detail 実行 (resource_link確認) | 未実施 | |
| rank_bids 実行 | 未実施 | |
| explain_bid_fit 実行 | 未実施 | |
| search_bids_app 実行 (MCP Apps UI確認) | 未実施 | |
| analyze_past_awards 実行 | 未実施 | |
| resources/list 確認 | 未実施 | |
| prompts/list 確認 | 未実施 | |
| completion (prefecture) 確認 | 未実施 | |
| Free tier ツール一覧 (4ツールのみ) | 未実施 | beta期間中はPro表面が開放されるため、実施条件を記録 |

---

## Claude Custom Connector 検証 / Claude Custom Connector Verification

### 接続結果 / Connection result

- **2026-06-28**: 個人Claude.aiアカウントで custom connector `https://mcp.bid-jp.com/mcp` を**追加・OAuth接続成功**。コネクタが「Connected」状態になることを確認。
- ライブ動作確認の詳細手順・チェックリストは `docs/submissions/personal-account-smoke.md` を参照。

### 接続手順

1. Claude.ai → Settings → Connectors → Add custom connector
2. URL: `https://mcp.bid-jp.com/mcp`
3. OAuth フローを完了させてPro tierを取得
4. チャットで以下のプロンプトを順番に実行

### 検証プロンプトと期待結果

| # | プロンプト | 期待する動作 | 状態 |
|---|---|---|---|
| 1 | `鹿児島県のIT系入札を5件検索して` | search_bids が実行され、入札リストが返る | 未実施 |
| 2 | `その中でうちに合うものをランク付けして` | rank_bids が実行され、スコア付きリストが返る | 未実施 |
| 3 | `一番スコアが高い案件の詳細を教えて` | get_bid_detail が実行され、resource_link付きで公式URLが表示される | 未実施 |
| 4 | `search_bids_appで農林水産省の役務入札を検索して` | search_bids_app が実行され、MCP Apps UIが表示される | 未実施 |
| 5 | `その案件の要件を抽出して` | extract_bid_requirements が実行される | 未実施 |
| 6 | `社内検討メモを作って` | create_bid_review_packet が実行され、Markdownメモが返る | 未実施 |
| 7 | `このツールの出典は？` | attribution://kkj リソースが参照される | 未実施 |
| 8 | `農林水産省の過去1年の発注傾向を分析して` | analyze_past_awards が実行される | 未実施 |

### MCP Apps UI 確認項目

| 項目 | 状態 |
|---|---|
| Welcome screen が表示される | 未実施 |
| 検索後、左パネルに入札カードが表示される | 未実施 |
| カードのクリックで右パネルに詳細が表示される | 未実施 |
| 公式公告ページへのリンクが表示される | 未実施 |
| アクションボタン（読む/判定/まとめる/聞く）が機能する | 未実施 |
| エラー状態でエラーメッセージが表示される | 未実施 |
| ダークモードで正しく表示される | 未実施 |
| モバイル幅（375px）でレイアウトが崩れない | 未実施 |

---

## 既知の制約 / Known Constraints

1. **save_search / check_saved_search**: セッション内のin-memory stateのみ保持。Cloud RunのHTTPステートレスモードでは複数リクエスト間の持続性なし。
2. **PDF抽出**: fetch_documents=false がデフォルト。trueにすると外部URLにアクセスするが添付PDFは保存しない。
3. **KKJ APIレート制限**: デフォルト1req/sec。analyze_past_awardsでlimit=1000を指定すると時間がかかる場合がある。
4. **MCP Apps UI**: search_bids_app のみMCP Apps対応。他のツールはテキストフォールバックを返す。

---

## 申請メモ / Submission Notes

- バージョン: v0.7.x+
- 申請種別: Remote MCP App
- プロトコル: Streamable HTTP + OAuth 2.0 (RFC 7591 Dynamic Client Registration)
- サポート連絡先: GitHub Issues / mcp@bid-jp.com
- 審査期間中: mcp-review@bid-jp.com アカウントでPro tierのテスト可能
