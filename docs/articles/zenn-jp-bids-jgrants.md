---
title: "JP Bids MCP × Jグランツ MCP × freee MCP — 入札・補助金・会計をひとつの会話で"
emoji: "🏛️"
type: "tech"
topics: ["mcp", "claude", "govtech", "公共調達", "freee"]
published: true
---


# JP Bids MCP × Jグランツ MCP × freee MCP — 入札・補助金・会計をひとつの会話で

## はじめに

日本の公的資金には2つの流れがあります。

1. **官公需入札**：国や自治体が民間企業に仕事を発注します。中小企業庁の[官公需情報ポータルサイト（KKJ）](https://kkj.go.jp)に年間180万件超の公示が掲載されています。
2. **補助金・助成金**：国や自治体が民間の取り組みを支援します。デジタル庁が運営する[Jグランツ](https://www.jgrants-portal.go.jp)に年間約1,000種類の補助金が掲載されています。

この2つは従来、まったく別のシステムで管理されてきました。入札担当者は入札情報サービスを使い、補助金担当者は補助金ポータルを使います。情報が分断されているため、「補助金を原資に入札へ参加する」「落札案件と使える補助金を組み合わせる」といった複合的な意思決定は、人間が手動で行うしかありませんでした。

それをMCPで解消しようというのが、この記事のテーマです。

## 2つのMCPサーバー

### JP Bids MCP（入札）

[JP Bids MCP](https://github.com/sugukurukabe/koko-call-mcp)は、KKJ公開APIをModel Context Protocol（MCP）化したサーバーです。スグクル株式会社が開発・運営しています。

主な機能：

- `search_bids`：キーワード・地域・業種で入札案件を検索
- `rank_bids`：自社プロファイルに基づくAIスコアリング
- `extract_bid_requirements`：PDF仕様書から要件を構造化抽出
- `create_bid_review_packet`：社内検討メモの自動生成

MCP仕様 [2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) に準拠し、OAuth 2.0認証、Streamable HTTP、Resources、Resource Templates、Promptsを実装しています。

### Jグランツ MCP（補助金）

[Jグランツ MCP](https://github.com/digital-go-jp/jgrants-mcp-server)は、デジタル庁が2025年10月に公開した公式リファレンス実装です。JグランツAPIをFastMCP（Python）でラップし、MCP経由で補助金を自然言語検索できます。

主な機能：

- `search_subsidies`：キーワード・業種・地域・受付状態で補助金を検索
- `get_subsidy_detail`：添付ファイルを含む詳細取得
- `get_subsidy_overview`：締切・金額別の統計概要

[Jグランツ Open API 利用規約](https://www.jgrants-portal.go.jp/open-api)に準拠したMIT OSSであり、同サーバーを使った商用連携サービスもすでに登場しています。

## なぜ「組み合わせ」が価値を生むか

MCPの設計思想は「サーバーを組み合わせてコンテキストを広げる」ことにあります。JP Bids MCPとJグランツ MCPは**補完関係**にあります：

| 観点 | JP Bids MCP（KKJ） | Jグランツ MCP |
|---|---|---|
| 主体 | 企業が政府の仕事を取りに行く | 企業が政府から支援を受ける |
| 性質 | 競争（他社が相手） | 審査（基準を満たすか） |
| 締切の性質 | 入札締切（絶対厳守） | 申請期間（受付期間あり） |
| 情報の粒度 | 案件単位（仕様書・落札者） | 補助金単位（上限額・対象者） |

この2軸をAIが同時に扱えるようになることで、「補助金の申請期限と入札の提出期限が重ならない組み合わせを探す」「補助金で原資を確保してから入札に挑む」という判断を、会話ひとつで完結できるようになります。

## デモ

### 設定

```bash
# 1. Jグランツ MCP をローカルで起動
git clone https://github.com/digital-go-jp/jgrants-mcp-server.git
cd jgrants-mcp-server && pip install -e .
python -m jgrants_mcp_server.core
# → http://127.0.0.1:8000/mcp

# 2. Cursor の設定ファイル（cursor.mcp.json）
```

```json
{
  "mcpServers": {
    "jp-bids": {
      "url": "https://mcp.bid-jp.com/mcp",
      "type": "streamable-http"
    },
    "jgrants": {
      "url": "http://127.0.0.1:8000/mcp",
      "type": "streamable-http"
    }
  }
}
```

### ワークフロー例 1：同時探索

プロンプト：

```
鹿児島県のITシステム調達案件を探して、同時に中小企業向けのDX補助金も調べてください。
スコアが高い入札案件と、現在申請受付中の補助金の一覧を合わせて教えてください。
```

LLMが実行する呼び出し：

1. `search_bids(query="システム", prefecture="鹿児島県", category="役務", limit=10)`
2. `rank_bids(query="システム", prefecture="鹿児島県", preferred_keywords=["DX","クラウド"], shortlist_limit=5)`
3. `search_subsidies(keyword="DX", target_number_of_employees="50名以下", acceptance=1)`

結果として得られるもの：
- スコア順の入札案件リスト（締切・金額・推奨理由付き）
- 申請受付中の補助金リスト（上限金額・対象者・締切付き）

### ワークフロー例 2：補助金で原資 → 入札

プロンプト：

```
IT補助金で原資を確保した上で、AIシステム開発の入札案件を絞り込んでください。
補助金の締切と入札の締切が重ならない組み合わせを提案してください。
```

LLMが実行する呼び出し：

1. `search_subsidies(keyword="AI システム", acceptance=1)`
2. `search_bids(query="AI システム開発")`
3. `rank_bids(query="AI システム開発", preferred_keywords=["機械学習"], shortlist_limit=3)`
4. `create_bid_review_packet(bid_key="...")`

## freee MCP との連携 — 入札から会計まで

MCPの「サーバーを組み合わせる」思想をさらに押し進めると、入札の**前後**をカバーできます。[freee MCP](https://www.npmjs.com/package/freee-mcp)（freee株式会社）と組み合わせると：

1. **入札前**: freeeから預金残高・売掛金を取得し、入札の資金余力を自動判定
2. **落札後**: 案件メタデータ（発注機関名・落札額）からfreeeに売上取引を自動登録
3. **請求**: 案件タイトル・金額・納品日から請求書を自動生成
4. **分析**: 入札準備経費（旅費・印刷・外注）と落札実績を突合し、費用対効果をレポート

設定ファイルと4つのワークフロー例は[examples/freee-integration/](https://github.com/sugukurukabe/koko-call-mcp/tree/main/examples/freee-integration)に公開しています。

## 今後の展望

入札（KKJ）・補助金（Jグランツ）・会計（freee）の3軸で、公的資金の取得から経理処理までをひとつの会話でカバーする基盤が整いました。次のような拡張が考えられます：

- **調達実績 × 補助金交付実績**のクロス分析
- **入札資格管理**MCPとの連携（全省庁統一資格の更新管理）
- **電子帳簿保存法対応**: freee + 入札書類のタイムスタンプ管理

これは一社が作り切るものではありません。JP Bids MCPはそのコンポーネントの一つとして、互換性を最優先にMCP仕様書に忠実な実装を続けます。

---

## MCP App の画面 — 会話の中に置かれる業務画面

ここまでの議論を、実際の Claude Desktop 上のスクリーンショットで補足します。`search_bids_app` は MCP Apps（[MCP-UI](https://github.com/modelcontextprotocol/typescript-sdk)）に対応した tool で、tool 実行結果が **JSON ではなく、会話の続きに描画される業務画面** として返されます。

### プロンプト1: `Search for IT system bids in Tokyo published this week`

会話の中に「JP Bids `search_bids_app`」というウィジェットが描画され、検索キーワードを変えながら何度でも再検索できる状態になります。

![検索ウィジェットが会話に描画される様子](/images/zenn-jp-bids-jgrants/01-search-app-loading.png)
*検索の過程。ウィジェット自体が会話の中に置かれ、再検索ボタンを内蔵しています*

検索が完了すると、113件のうち先頭20件が表に表示され、横にAIによる解説が並びます。「AI Bid Workspace」は CSV 出力ボタンと同期ボタンを内蔵しており、結果に対する次の操作がそのまま行えます。

![検索結果と解説が並ぶ様子](/images/zenn-jp-bids-jgrants/02-search-app-results.png)
*ヒット件数・案件一覧・AIによる注目案件のピックアップが、ひとつの会話の中にまとまっています*

### プロンプト2: `Rank these bids for a 50-person IT consulting firm`

ランキングを実行する前に、エージェントは MCP の Elicitation 機能で、判定に必要な追加情報をユーザーへ確認します。

![Elicitationで判定条件を確認する様子](/images/zenn-jp-bids-jgrants/03-rank-elicitation.png)
*専門領域・地域希望・全省庁統一資格の有無を、ランキング前に対話で確定します*

回答を得ると `rank_bids` が実行され、スコア順の表が会話に描画されます。各案件には Pursue / Review のタグと、件数の少なさ・期限不明などの注意点が添えられます。

![ランキング表](/images/zenn-jp-bids-jgrants/04-rank-table.png)
*スコア・案件名・発注機関・都道府県・公告リンクが並ぶランキング表*

最後にエージェントが、Pursue トップ3 と Review 案件の扱い方を、会話形式で要約します。

![ランキング結果の要約](/images/zenn-jp-bids-jgrants/05-rank-summary.png)
*Pursue 上位案件の理由付け、共通リスク、Review 案件をスキップする判断が、ひとつの返答にまとまっています*

これらはすべて、tool 一回の実行結果として、会話の続きに置かれているものです。**JSON でも、外部リンクでもなく、会話の中に小さな業務画面が現れる** という体験は、MCP Apps と複数MCPの掛け合わせがあって初めて成立します。

---

## まとめ

- JP Bids MCP（入札）× Jグランツ MCP（補助金）× freee MCP（会計）は、補完的なMCPサーバーとして機能します
- Jグランツ連携3ワークフロー + freee連携4ワークフローと設定ファイルを公開しました
- 入札→補助金→会計の3軸で、公的資金の取得から経理処理までをひとつの会話でカバーする基盤が整いました
- MCP Apps（`search_bids_app`）により、検索結果テーブル・再検索UI・CSV出力ボタンが、会話の中に直接描画されます

---

*JP Bids MCP は[スグクル株式会社](https://sugukuru.co.jp)が開発しています。Jグランツ MCPはデジタル庁の公式OSSです。freee MCPはfreee株式会社が提供しています。それぞれ独立した運営であり、結果は参考情報です。*
