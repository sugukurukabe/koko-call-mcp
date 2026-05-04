# 公共データMCPエコシステム共同推進のご提案

> 機密資料 / 送信前に壁が最終確認  
> 送付先: デジタル庁 オープンデータ・API推進担当  
> 連絡経路: digital.go.jp の問い合わせフォーム / GitHubのJグランツIssue / Xで@digital_go_jp にDM

---

## 提案の背景

デジタル庁様が公開されている Jグランツ MCP サーバー（jgrants-mcp-server）との連携実証を行い、入札情報（中小企業庁 KKJ）と補助金情報（Jグランツ API）をひとつのAI会話でカバーするワークフローデモをGitHubに公開いたしました。

あわせて、jgrants-mcp-serverに対して以下4件のPull Requestを送信済みです。

| PR | 内容 | リンク |
|----|------|--------|
| #2 | `get_subsidy_overview` の accepting カウント常時0バグの修正 | [PR #2](https://github.com/digital-go-jp/jgrants-mcp-server/pull/2) |
| #3 | Cloud Run / サーバーレス環境対応（`stateless_http=True`） | [PR #3](https://github.com/digital-go-jp/jgrants-mcp-server/pull/3) |
| #4 | 公式 Dockerfile 追加（マルチステージビルド） | [PR #4](https://github.com/digital-go-jp/jgrants-mcp-server/pull/4) |
| #5 | pytest ユニットテスト14件追加 | [PR #5](https://github.com/digital-go-jp/jgrants-mcp-server/pull/5) |

---

## 提案内容

以下3点でのご協力・連携をご検討いただけますでしょうか。

### 1. PRのレビュー・マージ

上記4件のPRはいずれも小規模かつ実用的な改善です。特にバグ修正（PR #2）と Cloud Run 対応（PR #3）は既存ユーザーに直接メリットがあります。

### 2. JP Bids × Jグランツ連携デモの公式紹介

入札と補助金のワンストップAI体験として、デジタル庁のブログ・GitHubのREADME等でご紹介いただけると、双方のMCPサーバーの認知向上につながります。

連携デモURL:  
https://github.com/sugukurukabe/koko-call-mcp/tree/main/docs/examples/jgrants-integration

### 3. 公共データMCPエコシステムの拡張

KKJ（官公需）・Jグランツ（補助金）に続く、次の公共データMCPサーバーの共同検討（e-Bizや法人番号APIなど）。MCPの標準化と日本の公共データ活用促進に貢献したいと考えています。

---

## 提案者

スグクル株式会社  
代表取締役 壁（かべ）  
https://sugukuru.co.jp  
JP Bids MCP: https://mcp.bid-jp.com  
GitHub: https://github.com/sugukurukabe/koko-call-mcp
