# 入札調査の2時間15分が、2分になった話 — JP Bids MCP を作って使ってみて

> note.com 公開用原稿。壁が note.com に貼り付けて公開する。
> 想定読者: 入札担当者・行政書士・中小企業経営者・自治体職員・公共調達 SaaS の開発者
> 想定検索クエリ: 「入札 検索 AI」「KKJ API」「官公需 自動化」「Claude MCP 入札」「Cursor MCP 補助金」

---

## 結論 — 何が、どう変わったか

官公需入札の調査作業は、AI アシスタント（Claude / Cursor / ChatGPT）に話しかけるだけで終わるようになりました。「鹿児島県の IT 系入札を探して、うちに合う順に並べて」と書くだけで、検索・スコアリング・PDF 仕様書の要件抽出・参加資格チェック・締切日のカレンダー登録まで、ひとつの会話の中で完結します。

私たちが計測した範囲では、従来 2 時間 15 分かかっていた一件あたりの入札調査が、約 2 分に短縮されました（自社による顧客ヒアリング, n=12, 2025 年）。

その仕組みの名前は **JP Bids MCP** です。中小企業庁の[官公需情報ポータルサイト KKJ](https://kkj.go.jp) の公開 API を、Anthropic が策定した [Model Context Protocol（MCP）](https://modelcontextprotocol.io/specification/2025-11-25) で AI に提供する、読み取り専用のサーバーです。

---

## 従来の入札調査は、なぜ時間がかかっていたのか

中小企業庁の官公需情報ポータルサイト（KKJ, Kankouju Kanren Joho）には、年間 180 万件超の公共調達情報が掲載されています（出典: 中小企業庁 KKJ 公式ポータル, 2024 年度）。一次情報としては十分すぎるほど揃っているのに、現場の入札担当者は、案件 1 件あたり 2 時間以上を「調査」だけに費やしてきました。理由は三つあります。

**一つ目: キーワード検索の精度が低い。** 「システム」と検索しただけで、関係ない案件が大量に混じります。絞り込みに時間がかかります。

**二つ目: 仕様書が PDF。** ダウンロードして開いて読みます。参加資格は後ろの方のページにしか書いていません。20 ページ読んで「うちの資格では無理だった」と分かることがよくあります。

**三つ目: 締切管理が属人的。** Excel で管理している会社が多く、抜け漏れが起きます。

### 1 件あたりの調査時間（手作業との比較）

| 工程 | 手作業 | JP Bids MCP |
|---|---|---|
| 案件検索・絞り込み | 30 分 | 約 1 分 |
| 仕様書 PDF 読み込み | 1 時間 | 約 30 秒 |
| 参加資格確認 | 30 分 | 約 10 秒 |
| 締切管理登録 | 15 分 | 約 5 秒 |
| **合計** | **2 時間 15 分** | **約 2 分** |

週に 10 件チェックしたら、22.5 時間。それが調査だけでかかっている計算です。月 90 時間。営業や提案書作成の時間は、ここからさらに削られていきます。

---

## JP Bids MCP は、何をするツールなのか

JP Bids MCP は、KKJ の公開データを Claude / Cursor / ChatGPT などの AI アシスタントから自然言語で扱えるようにする、読み取り専用の MCP サーバーです。インストール不要で、`https://mcp.bid-jp.com/mcp` という URL を AI クライアントの設定に書き加えるだけで動きます。

「MCP（Model Context Protocol）」というのは、Anthropic が 2024 年 11 月に公開したオープンプロトコルの名前で、AI に外部のデータと操作を渡す方法を標準化するための共通仕様です。現在は Anthropic / OpenAI / Google / Microsoft のエコシステムでサポートが広がっています。

### 話しかけるだけでいい例

入札担当者が AI に対して送る「話しかける一文」と、その裏で AI が自動的に行う処理の対応は、こんな具合です。

| 話しかけ方（自然言語） | 裏で起きること |
|---|---|
| 「農林水産省の過去 3 年の発注傾向を教えて」 | 落札実績取得 → 予算規模・競合・落札率を分析 → 次の入札戦略を提案 |
| 「この仕様書 PDF の参加資格と評価基準を整理して」 | PDF 自動取得 → 構造化された要件抽出 → 不足書類の取得方法まで提示 |
| 「来月締切の役務案件を鹿児島県で 5 件リストアップして」 | 締切日でフィルタ → 地域で絞り込み → ICS カレンダーで予定登録 |
| 「うちの会社（資格 A 等級, 売上 5 億）でこの入札に参加できる？」 | 参加資格と要件を照合 → 参加可否の即判定 → 不足要件の取得方法を提示 |

---

## どうやって始めるのか — Cursor / Claude Desktop / ChatGPT 別の設定

JP Bids MCP は、MCP に対応した AI クライアントなら、どれでも同じように使えます。

### Cursor で使う場合

`.cursor/mcp.json` に以下を追加します。

```json
{
  "mcpServers": {
    "jp-bids": {
      "url": "https://mcp.bid-jp.com/mcp"
    }
  }
}
```

これだけです。再起動すれば、Cursor のチャット欄から「入札を検索して」と話しかけられるようになります。初回は OAuth 2.0 で自動認証されます。

### Claude Desktop で使う場合

`claude_desktop_config.json` に以下を追加します。

```json
{
  "mcpServers": {
    "jp-bids": {
      "command": "npx",
      "args": ["--yes", "mcp-remote", "https://mcp.bid-jp.com/mcp"]
    }
  }
}
```

### ChatGPT で使う場合

ChatGPT の Custom Connectors（または GPT Builder）から、MCP サーバー URL として `https://mcp.bid-jp.com/mcp` を登録します。

詳しい設定方法と動画は [https://mcp.bid-jp.com](https://mcp.bid-jp.com) にまとめています。

---

## なぜ無料なのか、いつまで無料なのか

2026 年 6 月末までのベータ期間中は、17 ツールすべてを無料で使えます。これは、入札調査の現場で実際にどう使われるかを知りたいという理由から、価格をいったん引いた状態で公開しているためです。

ベータ期間後は、Free（4 ツール）と Pro（全 17 ツール、月額 990 円）の二段構成を予定しています。料金は変わる可能性がありますが、ベータ期間中に使い始めた方には、移行時に余裕を持って案内します。

---

## 入札・補助金・会計を、ひとつの会話でつなぐ

JP Bids MCP は単独でも動きますが、本当に面白くなるのは、隣接領域の MCP サーバーと組み合わせたときです。

| サーバー | 担当 | 提供元 |
|---|---|---|
| **JP Bids MCP** | 官公需入札（KKJ） | スグクル株式会社 |
| **Jグランツ MCP** | 補助金（Jグランツ） | デジタル庁公式 OSS |
| **freee MCP** | 会計・請求書 | freee 株式会社 |

この三つを同じ AI 会話に追加すると、たとえばこう聞けるようになります。

> 「鹿児島県の IT システム調達案件のうち、当社のキャッシュで応札可能な額のものを抽出してください。落札を見込んだ場合、当面の運転資金として使える補助金も合わせて教えてください。」

AI は、入札 MCP で案件を検索し、会計 MCP で残高を取得し、補助金 MCP で受付中の補助金を引いて、三つを突き合わせた答えを返します。三社が三つの SaaS として提供しても起きなかったことが、MCP という共通の形に並べたことで初めて成立します。

サンプル設定とワークフロー例は、[examples/jgrants-integration/](https://github.com/sugukurukabe/koko-call-mcp/tree/main/examples/jgrants-integration) と [examples/freee-integration/](https://github.com/sugukurukabe/koko-call-mcp/tree/main/examples/freee-integration) に公開しています。

---

## 公共情報は、もともと公開されている

入札情報は最初から公開されています。誰でも見られます。中小企業庁が政府標準利用規約 第 2.0 版に基づいて開放してくれているデータです。

JP Bids MCP は、その公開情報を AI が読みやすい形に整えただけです。新しいデータを作ったわけではありません。ただ、使える形にした。

入札調査に時間を取られている方や、公共調達 SaaS を作っている開発者の方に、試してもらえると嬉しいです。OSS（Apache-2.0）なので、自社サーバーでホストすることもできます。

---

## よくある質問 — 入札担当者・開発者からの問い合わせより

### Q. AI が間違った入札を返してきたら責任はどうなりますか？
A. JP Bids MCP は KKJ の公開データを参照情報として返すサーバーであり、最終判断は必ず公式の入札公告で確認してください、というスタンスです。すべての応答に出典（KKJ ポータルへのリンクと「政府標準利用規約 第 2.0 版」の表示）を含めています。

### Q. 自社の独自評価基準でランキングしたい場合は？
A. `rank_bids` ツールに自社プロファイル（業種・資格・キーワード・予算レンジ）を渡せます。そのプロファイルは AI 会話の中だけで完結し、サーバー側に保存されません。

### Q. データはサーバーに保存されますか？
A. 検索クエリ・参照した入札・自社プロファイルは保存しません。OAuth 2.0 のセッション管理に必要な最小限の情報のみ、Cloud Run のメモリ上でリクエスト処理中だけ保持します。詳しくは[プライバシーポリシー](https://mcp.bid-jp.com/privacy)をご覧ください。

### Q. オンプレミスで使えますか？
A. はい。Apache-2.0 ライセンスの OSS なので、リポジトリの Dockerfile を使って自社環境で動かせます。`npx jp-bids-mcp` でローカル stdio モードでも動きます。

### Q. 開発者ですが、どんな技術で作られていますか？
A. TypeScript + Express + MCP TypeScript SDK + Vertex AI（PDF 抽出）+ Google Cloud Run。OAuth 2.0 Authorization Code + PKCE + Dynamic Client Registration を実装しています。MCP 2025-11-25 仕様の 7 プリミティブすべて（Tools / Resources / Resource Templates / Prompts / Completion / Logging / Notifications）を実装した数少ないサーバーの一つです。詳しくは [GitHub リポジトリ](https://github.com/sugukurukabe/koko-call-mcp) をご覧ください。

---

## リンク集

- **サービスサイト**: [https://mcp.bid-jp.com](https://mcp.bid-jp.com)
- **GitHub**: [sugukurukabe/koko-call-mcp](https://github.com/sugukurukabe/koko-call-mcp)
- **npm**: [jp-bids-mcp](https://www.npmjs.com/package/jp-bids-mcp)
- **Smithery**（MCP 検索）: [a-kabe-1qio/jp-bids-mcp](https://smithery.ai/servers/a-kabe-1qio/jp-bids-mcp)
- **mcp.so**: [server/sugukurukabe/koko-call-mcp](https://mcp.so/server/sugukurukabe/koko-call-mcp)
- **公式 MCP Registry**: `io.github.sugukurukabe/jp-bids`

---

*JP Bids MCP は[スグクル株式会社](https://sugukuru.co.jp)（鹿児島県霧島市）が開発・運営しています。Jグランツ MCP はデジタル庁の公式 OSS、freee MCP は freee 株式会社が提供しています。それぞれ独立した運営であり、本記事の所要時間や事例は参考情報です。実際の入札参加にあたっては、必ず公式の入札公告と一次情報源をご確認ください。*
