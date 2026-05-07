# 公的データ・農業・会計を横断する30分を、1回の会話に近づける — Public MCP JP Gateway の設計と実装

## はじめに — いくつものタブが、ひとつの会話になる

月末の机には、いつも似たようなものが並びます。入札公告のタブ。補助金ポータルのタブ。農業・自治体データのタブ。会計ソフトのタブ。法人確認のタブ。どれも正しい情報を持っています。ただ、それぞれが別々の場所にあります。

Public MCP JP Gateway は、この往復を AI エージェントの 1 回の会話に近づけるための MCP Gateway です。

> 鹿児島県の農業/IT案件を探して、使える補助金を確認し、法人番号とMoneyForwardで会計確認する流れまで案内してください。

Public MCP JP Gateway は、JP Bids MCP、Jグランツ MCP、AgriOps MCP、法人番号 MCP、MoneyForward Cloud Accounting MCP を順番に呼べる構成として設計しています。ユーザーは複数の SaaS や公開データサイトに入るのではなく、1 つの Gateway に話しかけます。GMO銀行系APIは公開 Gateway では提供せず、利用許諾とAPI取得が完了した後の private connector として追加予定です。

---

## MCP Gateway の概要 — AI のための業務窓口

MCP Gateway は、複数の MCP サーバーを 1 つの接続先にまとめる中継サーバーです。

MCP（Model Context Protocol）は、AI エージェントが外部のデータやツールに触れるための標準仕様です。JP Bids MCP は、官公需情報ポータルサイト（KKJ）の入札データを AI に渡すために作りました。

しかし、入札は入札だけで終わりません。補助金、会計、法人確認、労務、ビザ、契約管理につながります。だから、単独 MCP ではなく Gateway が必要になります。

構成は単純です。AI Agent / Cursor / Claude / Grok などのクライアントは Gateway だけに接続し、Gateway が目的に応じて JP Bids、Jグランツ、AgriOps、法人番号、MoneyForward などの child MCP を呼び分けます。仕訳作成などの副作用がある操作は、HMAC 署名付き Approval Token を挟みます。


| 子 MCP                                  | 担当     | 役割                 |
| -------------------------------------- | ------ | ------------------ |
| JP Bids MCP                            | 官公需入札  | KKJ の入札情報を検索・ランキング |
| Jグランツ MCP                              | 補助金    | 補助金・助成金の検索         |
| AgriOps MCP                            | 農業・自治体 | 市区町村単位の農業統計を確認     |
| 法人番号 MCP                              | 法人確認   | 取引先・企業実在確認         |
| MoneyForward Cloud Accounting MCP      | 会計     | 仕訳・試算表・推移表の確認      |


ここで大事なのは、単に API を増やしたことではありません。AI に「どの窓口へ行けばよいか」を判断させる形にしたことです。

---

## Gateway が必要になる時 — 情報はあるのに、判断がつながらない

Public MCP JP Gateway が必要になるのは、情報が足りない時ではありません。

むしろ、情報はすでにあります。入札情報は KKJ にあります。補助金は Jグランツにあります。農業・自治体データは AgriOps にあります。法人番号は国税庁にあります。会計情報は MoneyForward にあります。

問題は、それらが別々の画面にあることです。


| 作業                        | 従来                  | Gateway          |
| ------------------------- | ------------------- | ---------------- |
| 入札 → 補助金 → 農業統計 → 法人確認 → 会計 | 複数タブ + 手動コピペ        | 1 会話             |
| 設定                        | OAuth や API キーを個別管理 | 接続口を Gateway に集約 |
| 監査ログ                      | SaaS ごとに分散          | 1 箇所に集約          |
| AI に渡るツール                 | 270 以上に膨らむ可能性       | mode で必要分だけ      |


人間は最後に判断したいだけです。この案件を追うべきか。補助金を使えるか。取引先は確認できるか。資金繰りは大丈夫か。Gateway は、その手前の検索、照合、コピー、確認、転記を束ねます。

---

## 使うことで生み出す価値 — 調査から意思決定へ

Public MCP JP Gateway が生み出す価値は、単なる時短ではありません。

時短は入口です。本当の価値は、ばらばらだった業務判断が、ひとつの会話の中で連続することです。

1. JP Bids MCP で鹿児島県の IT 入札を検索する
2. Jグランツ MCP で関連補助金を探す
3. AgriOps MCP で自治体の農業統計を確認する
4. 法人番号 MCP で取引先や企業情報を確認する
5. MoneyForward Cloud Accounting MCP で仕訳候補と試算表を確認する
6. 最後に「追うべき案件」「見送るべき案件」「地域面の根拠」「資金面の注意点」「月次会計への反映」をまとめる

これは、単に複数の API を呼ぶ話ではありません。業務の順番を、AI の実行順序として表現できるようにする話です。

---

## 世界の MCP Gateway 事情 — Gateway はすでにカテゴリになっている

MCP Gateway は、世界でもすでに 1 つのカテゴリになり始めています。

2026 年 4 月時点の調査メモでは、企業 AI チームの 78% が少なくとも 1 つの MCP エージェントを本番稼働中で、公開 MCP サーバー数は 9,400 超に拡大したと整理しています（出典: [Digital Applied, MCP Adoption Statistics 2026](https://www.digitalapplied.com/blog/mcp-adoption-statistics-2026-model-context-protocol) を参照した `docs/public-mcp-hub/feasibility.md`）。

agentgateway、PingGateway、Permit MCP Gateway、Bifrost、Kuadrant/mcp-gateway などのプロジェクトも出ています。共通しているのは、複数の MCP をそのまま LLM に渡すのではなく、認証、監査、ルーティング、権限管理を Gateway 側でまとめようとしている点です。

Public MCP JP Gateway は、この流れを日本の公的データと国内 SaaS に寄せて実装する試みです。単なる海外 Gateway の日本語化ではありません。

---

## JP Bids MCP から Gateway へ — 単独ツールから、業務の束へ

最初に作ったのは JP Bids MCP でした。

KKJ の公開 API を AI から扱えるようにした、読み取り専用の MCP サーバーです。入札検索、ランキング、仕様書の確認、カレンダー登録。これだけでも、従来 2 時間 15 分かかっていた入札調査を約 2 分に短縮できました。

でも、入札調査の先には必ず別の問いがあります。「この案件、補助金を使えるのか」「取引先や法人情報は確認できるのか」「受けたとして、資金繰りは大丈夫か」「請求と会計処理まで見た時に、無理がないか」。

そこで JP Bids MCP 本体を大きくするのではなく、別サービスとして Gateway を作りました。読み取り専用の公共データ MCP と、会計データを扱う financial MCP は、同じリスクではありません。境界を分けることは、機能追加ではなく責任の整理でした。

---

## ユーザーができるようになること — 会話例

Public MCP JP Gateway を使うと、ユーザーは複数の業務を 1 つの会話にまとめられます。

> 鹿児島県の IT 入札を探して、使える補助金も一緒に確認して。

> この案件、うちの今月の会計データから見て受けても大丈夫そうですか？

> 法人番号を確認して、MoneyForwardで会計確認する流れまで案内してください。

> 入札、補助金、法人確認、財務を分担して調べて、最後に事業計画としてまとめてください。

最初の一手も用意しています。ユーザーが迷ったら、Gateway に `get_gateway_demo` を呼ばせれば十分です。デモプロンプト、必要な認証、推奨ツール順が返ります。

Grok のようなマルチエージェント構成では、入札担当、補助金担当、法人確認担当、財務担当に役割を分けられます。Gateway は単一の接続先でありながら、mode によって見せるツールを絞れます。

---

## セキュリティについて — 書き込み操作は、同じ扱いにしない

Public MCP JP Gateway は、読み取り操作と書き込み操作を同じ扱いにしません。


| 層              | 内容                                                      |
| -------------- | ------------------------------------------------------- |
| Tier           | Free / Pro で使える Gateway ツールを分ける                         |
| Risk level     | `read_only` / `read_write` / `financial` を registry に定義 |
| Mode           | 入札検索、補助金検索、財務確認など目的別にツールを絞る                             |
| Approval Token | 仕訳作成などの操作は HMAC 署名付き token を要求                            |


特に会計データを書き込む操作では、認証だけでは足りないと考えました。そこで `issue_approval_token` というツールを作りました。AI はまず内容や金額を確認し、必要な条件を満たしている場合にだけ、5 分間有効な Approval Token を取得します。その token がなければ、書き込み系ツールは実行できません。

監査ログも、保存するものを最小限にしています。入力全文、PDF、財務データ、個人情報は保存しない方針です。

---

## 今後の展望 — 日本の業務 MCP Hub へ

いま Public MCP JP Gateway が束ねているのは入札、補助金、農業・自治体統計、法人番号、会計です。

今回、AgriOps MCP（`@sugukuru/agriops-mcp`、npm 公開済み）を Gateway の child MCP として追加しました。まずは `get_municipality_stats` を `agri_research` / `municipality_analysis` mode で使えるようにし、農業統計と自治体データを AI に渡せるようにしています。これにより、「この地域で入札を取れるか」「補助金と農業規模と資金繰りを合わせて判断したい」という会話が成り立ちます。

その先には、国税庁法人番号 API による法人確認、e-Stat / RESAS の地域統計、e-Gov 法令検索、そして特定技能ビザ管理 MCP も視野にあります。


| Pack                | 組み合わせ                             | 対象ユーザー        |
| ------------------- | --------------------------------- | ------------- |
| Public Sales Pack   | 入札 + 補助金 + 法人番号                   | 入札・補助金を探す企業   |
| Agri Expansion Pack | AgriOps + e-Stat + 入札 + 補助金       | 農業法人・自治体・派遣会社 |
| Finance Pack        | freee + MoneyForward + 法人番号 | 経理・財務担当者      |
| Compliance Pack     | SSW/Visa + e-Gov + 監査ログ           | 行政書士・登録支援機関   |


今回の Gateway は、子 MCP を増やす前提で作っています。`registry.json` に 1 エントリ追加し、Cloud Run の環境変数で endpoint を渡す。基本的にはそれだけで、新しい子 MCP を追加できる設計です。

AI エージェントの時代に必要なのは、すごいチャット画面だけではありません。AI が制度と業務に入っていくための、信頼できる通路です。Public MCP JP Gateway は、その通路を日本向けに作る試みです。

---

## リンク集

- 技術詳細（Zenn 記事）: 技術読者向けに別記事として公開予定
- GitHub: [sugukurukabe/koko-call-mcp](https://github.com/sugukurukabe/koko-call-mcp)
- JP Bids MCP: [https://mcp.bid-jp.com](https://mcp.bid-jp.com)
- ADR-0016: [Public MCP Federation Hub](https://github.com/sugukurukabe/koko-call-mcp/blob/main/docs/adr/0016-public-mcp-federation-hub.md)
- ADR-0017: [Dynamic Tool Surface](https://github.com/sugukurukabe/koko-call-mcp/blob/main/docs/adr/0017-dynamic-tool-surface.md)
- ADR-0018: [Cache Strategy](https://github.com/sugukurukabe/koko-call-mcp/blob/main/docs/adr/0018-cache-strategy.md)
- ADR-0019: [Approval and Compliance Policy](https://github.com/sugukurukabe/koko-call-mcp/blob/main/docs/adr/0019-approval-and-compliance-policy.md)
- ADR-0020: [LLM Router Fallback](https://github.com/sugukurukabe/koko-call-mcp/blob/main/docs/adr/0020-llm-router-fallback.md)
- ADR-0022: [Gateway Expansion Packs](https://github.com/sugukurukabe/koko-call-mcp/blob/main/docs/adr/0022-gateway-expansion-packs.md)

---

## 出典

- 中小企業庁 官公需情報ポータルサイト KKJ: [https://kkj.go.jp](https://kkj.go.jp)
- Jグランツ: [https://www.jgrants-portal.go.jp](https://www.jgrants-portal.go.jp)
- freee Developer: [https://developer.freee.co.jp](https://developer.freee.co.jp)
- MoneyForward Cloud Accounting MCP: [https://developers.biz.moneyforward.com/mcp/](https://developers.biz.moneyforward.com/mcp/)
- Model Context Protocol Specification: [https://modelcontextprotocol.io](https://modelcontextprotocol.io)
- Gateway 実現可能性メモ: [docs/public-mcp-hub/feasibility.md](https://github.com/sugukurukabe/koko-call-mcp/blob/main/docs/public-mcp-hub/feasibility.md)
- Digital Applied, MCP Adoption Statistics 2026: [https://www.digitalapplied.com/blog/mcp-adoption-statistics-2026-model-context-protocol](https://www.digitalapplied.com/blog/mcp-adoption-statistics-2026-model-context-protocol)

*Public MCP JP Gateway は、スグクル株式会社が開発中の MCP Federation Gateway です。GMO銀行系APIは現時点の公開 Gateway では提供していません。利用許諾とAPI取得が完了した後、社内利用または契約範囲内の private connector として追加する予定です。実際の入札参加、補助金申請、会計処理にあたっては、必ず各公式サービスと一次情報を確認してください。*