---
title: "JP Bids MCP × Jグランツ MCP × freee MCP — 入札・補助金・会計をひとつの会話で"
emoji: "🏛️"
type: "tech"
topics: ["mcp", "claude", "govtech", "公共調達", "freee"]
published: true
---


# JP Bids MCP × Jグランツ MCP × freee MCP — 入札・補助金・会計をひとつの会話で

## はじめに — 公的資金の二つの流れと、それをつなぐサーバーの話

日本の公的資金には、二つの大きな流れがあります。一つは「官公需入札（Japanese government procurement）」で、国や自治体が民間企業に仕事を発注する仕組みです。もう一つは「補助金・助成金（Subsidies / Grants）」で、国や自治体が民間の取り組みを後押しする仕組みです。

| 流れ | 公式ポータル | 件数 | 出典 |
|---|---|---|---|
| **官公需入札** | [中小企業庁 官公需情報ポータルサイト（KKJ）](https://kkj.go.jp) | 年間 180 万件超 | 中小企業庁 KKJ 統計情報, 2024 年度 |
| **補助金・助成金** | [デジタル庁 Jグランツ](https://www.jgrants-portal.go.jp) | 年間約 1,000 種類 | デジタル庁 Jグランツ 公式サイト, 2025 年 |

この二つは従来、まったく別のシステムで管理されてきました。入札担当者は入札情報サービスを使い、補助金担当者は補助金ポータルを使います。情報が分断されているため、「補助金を原資に入札へ参加する」「落札案件と使える補助金を組み合わせる」といった複合的な意思決定は、人間が手動で行うしかありませんでした。

これを Model Context Protocol（MCP）で解消しようというのが、本記事のテーマです。

## 2つのMCPサーバー — 入札と補助金、それぞれの公開実装

JP Bids MCP（入札）と Jグランツ MCP（補助金）は、同じ MCP 2025-11-25 仕様に従いながら、それぞれ独立に開発されている読み取り専用サーバーです。両者を同じ AI 会話に追加することで、入札と補助金が一つの文脈で扱えるようになります。

### JP Bids MCP（入札 / Japan procurement bids）

JP Bids MCP は、KKJ 公開 API を Model Context Protocol（MCP）化した読み取り専用サーバーです。[GitHub: sugukurukabe/koko-call-mcp](https://github.com/sugukurukabe/koko-call-mcp) で公開されており、スグクル株式会社が開発・運営しています。

主な機能：

- `search_bids`：キーワード・地域・業種で入札案件を検索
- `rank_bids`：自社プロファイルに基づくAIスコアリング
- `extract_bid_requirements`：PDF仕様書から要件を構造化抽出
- `create_bid_review_packet`：社内検討メモの自動生成

MCP仕様 [2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) に準拠し、OAuth 2.0認証、Streamable HTTP、Resources、Resource Templates、Promptsを実装しています。

### Jグランツ MCP（補助金 / Japan subsidies）

Jグランツ MCP は、デジタル庁が 2025 年 10 月に公開した補助金 API の公式 MCP リファレンス実装です。[GitHub: digital-go-jp/jgrants-mcp-server](https://github.com/digital-go-jp/jgrants-mcp-server) で公開されており、Jグランツ API を FastMCP（Python）でラップし、MCP 経由で補助金を自然言語検索できます。

主な機能：

- `search_subsidies`：キーワード・業種・地域・受付状態で補助金を検索
- `get_subsidy_detail`：添付ファイルを含む詳細取得
- `get_subsidy_overview`：締切・金額別の統計概要

[Jグランツ Open API 利用規約](https://www.jgrants-portal.go.jp/open-api)に準拠したMIT OSSであり、同サーバーを使った商用連携サービスもすでに登場しています。

## なぜ組み合わせが価値を生むか — 入札と補助金の補完関係

JP Bids MCP（入札）と Jグランツ MCP（補助金）は、同じ「公的資金」というドメインの中で、互いに違う角度を担当する補完的な関係にあります。MCP の設計思想は「複数のサーバーを組み合わせて、AI のコンテキストを広げる」ことにあり、この二つはその思想に最も素直に乗る組み合わせの一つです。

| 観点 | JP Bids MCP（KKJ） | Jグランツ MCP |
|---|---|---|
| 主体 | 企業が政府の仕事を取りに行く | 企業が政府から支援を受ける |
| 性質 | 競争（他社が相手） | 審査（基準を満たすか） |
| 締切の性質 | 入札締切（絶対厳守） | 申請期間（受付期間あり） |
| 情報の粒度 | 案件単位（仕様書・落札者） | 補助金単位（上限額・対象者） |

この2軸をAIが同時に扱えるようになることで、「補助金の申請期限と入札の提出期限が重ならない組み合わせを探す」「補助金で原資を確保してから入札に挑む」という判断を、会話ひとつで完結できるようになります。

## デモ — Cursor から二つのサーバーを同時に呼ぶ

ここからは、Cursor に JP Bids MCP と Jグランツ MCP の二つを追加して、入札と補助金を同じ会話の中で扱う具体例を示します。

### 設定（Cursor / Claude Desktop 共通）

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

## freee MCP との連携 — 入札の前後を会計でつなぐ

freee MCP は、freee 株式会社が提供する freee API を、MCP 経由で扱うためのサーバーです（[npm: freee-mcp](https://www.npmjs.com/package/freee-mcp)）。これを JP Bids MCP の前後に置くと、入札の準備（資金余力の確認）と落札後の処理（売上登録・請求書発行）まで、一つの会話で完結できます。

1. **入札前**: freeeから預金残高・売掛金を取得し、入札の資金余力を自動判定
2. **落札後**: 案件メタデータ（発注機関名・落札額）からfreeeに売上取引を自動登録
3. **請求**: 案件タイトル・金額・納品日から請求書を自動生成
4. **分析**: 入札準備経費（旅費・印刷・外注）と落札実績を突合し、費用対効果をレポート

設定ファイルと4つのワークフロー例は[examples/freee-integration/](https://github.com/sugukurukabe/koko-call-mcp/tree/main/examples/freee-integration)に公開しています。

## 今後の展望 — 入札 × 補助金 × 会計の先にある拡張

入札（KKJ）・補助金（Jグランツ）・会計（freee）の三軸が揃ったことで、公的資金の取得から経理処理までを一つの AI 会話でカバーする基盤が成立しました。次の拡張は、ここに資格管理や電子帳簿保存対応を重ねていく方向にあります。

- **調達実績 × 補助金交付実績**のクロス分析
- **入札資格管理**MCPとの連携（全省庁統一資格の更新管理）
- **電子帳簿保存法対応**: freee + 入札書類のタイムスタンプ管理

これは一社が作り切るものではありません。JP Bids MCPはそのコンポーネントの一つとして、互換性を最優先にMCP仕様書に忠実な実装を続けます。

---

## MCP App の画面 — 会話の中に直接描画される業務 UI

MCP Apps（旧称: MCP-UI）は、MCP の tool 実行結果を JSON ではなく、会話の中に直接描画される HTML / React コンポーネントとして返せる仕組みです。JP Bids MCP の `search_bids_app` ツールはこの仕組みに対応しており、検索結果のテーブル・再検索ボックス・CSV 出力ボタンが、Claude Desktop / Cursor の会話の続きにそのまま現れます。

以下、実際の Claude Desktop 上のスクリーンショットで補足します。

### プロンプト1: `Search for IT system bids in Tokyo published this week`

会話の中に「JP Bids `search_bids_app`」というウィジェットが描画され、検索キーワードを変えながら何度でも再検索できる状態になります。

![検索ウィジェットが会話に描画される様子](/images/zenn-jp-bids-jgrants/01-search-app-loading.png)
*検索の過程。ウィジェット自体が会話の中に置かれ、再検索ボタンを内蔵しています*

検索が完了すると、113件のうち先頭20件が表に表示され、横にAIによる解説が並びます。「AI Bid Workspace」は CSV 出力ボタンと同期ボタンを内蔵しており、結果に対する次の操作がそのまま行えます。

![検索結果と解説が並ぶ様子](/images/zenn-jp-bids-jgrants/02-search-app-results.png)
*ヒット件数・案件一覧・AIによる注目案件のピックアップが、ひとつの会話の中にまとまっています*

### プロンプト2: `Rank these bids for a 50-person IT consulting firm`

ランキングを実行する前に、エージェントはツールの入力スキーマに沿って、判定に必要な追加情報をユーザーへ確認します。

![ランキング前に判定条件を確認する様子](/images/zenn-jp-bids-jgrants/03-rank-elicitation.png)
*専門領域・地域希望・全省庁統一資格の有無を、ランキング前に対話で確定します*

回答を得ると `rank_bids` が実行され、スコア順の表が会話に描画されます。各案件には Pursue / Review のタグと、件数の少なさ・期限不明などの注意点が添えられます。

![ランキング表](/images/zenn-jp-bids-jgrants/04-rank-table.png)
*スコア・案件名・発注機関・都道府県・公告リンクが並ぶランキング表*

最後にエージェントが、Pursue トップ3 と Review 案件の扱い方を、会話形式で要約します。

![ランキング結果の要約](/images/zenn-jp-bids-jgrants/05-rank-summary.png)
*Pursue 上位案件の理由付け、共通リスク、Review 案件をスキップする判断が、ひとつの返答にまとまっています*

これらはすべて、tool 一回の実行結果として、会話の続きに置かれているものです。**JSON でも、外部リンクでもなく、会話の中に小さな業務画面が現れる** という体験は、MCP Apps と複数MCPの掛け合わせがあって初めて成立します。

---

## まとめ — 三つのサーバーで、公的資金の文脈をひとつにする

JP Bids MCP（入札）× Jグランツ MCP（補助金）× freee MCP（会計）は、いずれも独立した MCP サーバーですが、同じ AI 会話に追加することで「公的資金の取得から経理処理まで」を一つの文脈で扱える環境になります。

- **入札 × 補助金**: Jグランツ連携の 3 ワークフローを [examples/jgrants-integration/](https://github.com/sugukurukabe/koko-call-mcp/tree/main/examples/jgrants-integration) に公開しました
- **入札 × 会計**: freee 連携の 4 ワークフローを [examples/freee-integration/](https://github.com/sugukurukabe/koko-call-mcp/tree/main/examples/freee-integration) に公開しました
- **MCP Apps**: `search_bids_app` により、検索結果テーブル・再検索 UI・CSV 出力ボタンが、会話の中に直接描画されます

公的資金の流れを AI が読めるようになると、入札と補助金と会計の境界が、人ではなく会話の側に移ります。

---

*JP Bids MCP は[スグクル株式会社](https://sugukuru.co.jp)が開発しています。Jグランツ MCP はデジタル庁の公式 OSS です。freee MCP は freee 株式会社が提供しています。それぞれ独立した運営であり、本記事の結果は参考情報です。実際の入札・補助金・会計処理は必ず公式サイトと一次情報源を確認してください。*
