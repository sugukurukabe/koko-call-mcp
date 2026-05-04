---
title: "無形資産の4SからみたMCP — 小さなプロトコルが、なぜ新しい価値を生むのか"
emoji: "📐"
type: "idea"
topics: ["mcp", "ai", "claude", "anthropic", "経済"]
published: false
---

## はじめに

机のうえに置かれた一枚の請求書は、紙としてはほとんど価値を持ちません。インクと薄い紙でできた、数十円の物体です。

しかし、その紙が運んでいる「いつ・誰が・何を・いくらで」という情報は、会社の意思決定を変えます。資金繰りが変わり、来月の給与日が変わり、ときに採用の可否すら変わります。

紙そのものは安く、紙のうえに乗っている情報は重い。これは経済学者がかなり前から指摘してきた現象です。Jonathan Haskel と Stian Westlake は、この現象を『[Capitalism without Capital](https://press.princeton.edu/books/hardcover/9780691175034/capitalism-without-capital)』（2017）で、**無形資産（intangible assets）の4S**として整理しました。

本稿の主張はひとつです。

> [Model Context Protocol（MCP）](https://modelcontextprotocol.io/) は、4Sのすべてに当てはまる珍しい技術であり、その掛け合わせこそが、これまでにない価値を生む仕組みになっています。

派手な新機能の話ではありません。小さなプロトコルが、無形資産の経済特性とほぼ同じ形をしているという観察の話です。

---

## 無形資産の4Sとは

Haskel と Westlake は、ソフトウェア・ブランド・R&D・組織知のような無形資産が、機械や建物のような有形資産と異なる4つの特徴を持つと指摘しました。

| S | 内容 |
|---|------|
| **Scalability** | 一度作れば、追加コストほぼゼロで何度でも使える |
| **Sunkenness** | 一度投じた費用は、企業が消えれば回収しにくい（沈む） |
| **Spillovers** | 価値が作った人の外側に漏れ出して、他者にも流れる |
| **Synergies** | 他の無形資産と掛け合わせると、価値が跳ねる |

経済学の文脈では、これらの特徴は「測りにくく、課税しにくく、けれども現代経済の中心になりつつある」と語られます。

ここから先は、この4Sを**MCPに当てはめる地図**として使います。

---

## MCPとは何か（ごく短く）

[MCP公式仕様](https://modelcontextprotocol.io/specification/latest)はこう書いています。

> An open protocol that standardizes how applications provide context to large language models.

要点はとても短いです。

- LLM（クライアント）に対して、外部のデータと操作を **標準化された方法** で渡す
- サーバー側は **Tools / Resources / Prompts / Completion / Logging / Notifications** などのプリミティブを公開する
- 通信は JSON-RPC 2.0 で行う

何ができるかというより、**何が「同じ形」で並ぶようになるか**を定めた規約です。

その意味で、MCPは「機能」ではありません。**並べ方の規約** です。

---

## S1. Scalability — 一度公開すれば、文脈は何度でも呼ばれる

Scalability は、無形資産の最も語られる特徴です。ソフトウェアは1人に売っても1万人に売っても、追加生産コストがほぼ変わりません。

MCPサーバーには、これと同じ性質があります。

ひとつのMCPサーバーは、Claude Desktop、Cursor、ChatGPT、社内のエージェント、さらには将来登場するMCPホストから、**同じ形のまま呼び出される** ようになります。サーバーを書いた人は、クライアントごとに移植する必要がありません。

実例:

- [GitHub MCP](https://github.com/github/github-mcp-server) は、Issue・PR・コードを公開する。同じサーバーがClaude DesktopとCursorで同じように動く。
- [Stripe MCP](https://docs.stripe.com/mcp) は、決済データへの読み取りを公開する。財務担当者が見るときも、エンジニアがデバッグするときも、同じToolが呼ばれる。
- [Slack MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/slack) は、組織のチャットに対する文脈を公開する。

ここで起きているのは「APIをラップしたツールができた」ではありません。**「文脈そのもの」がスケーラブルな単位になった** ということです。

### 未来に起きそうなこと

会社ごとの就業規則、契約雛形、与信判断の基準、稟議の慣習。こうした「文書化されているが、社外からは触れない無形資産」が、MCPサーバーとして社内・取引先・関係省庁の間で共有されるようになる可能性があります。

そのとき、**会社の知識は、SaaS画面ではなく、エージェント越しに反復利用される無形資産になります**。

---

## S2. Sunkenness — MCPの価値は、外から見えない実装に沈む

Haskel と Westlake は、無形投資の費用は「沈みやすい（sunk）」と表現します。R&Dや組織開発に投じたお金は、会社が傾いたとき、機械や建物のように転売できません。

MCPサーバーにも、同じ性質があります。

外から見えるのは、tool名と短い説明文だけです。たとえば `extract_bid_requirements` という名前と「PDF仕様書から要件を抽出します」という一文。

しかし、その背後に沈んでいるものは小さくありません。

- 仕様書PDFのテキスト抽出と章構造の正規化
- 「参加資格」「評価基準」など、現場で使われる語の同義語処理
- 出典（ページ番号・原文）を必ず添える設計
- 失敗したときに、人間にとって意味のあるエラーメッセージを返す処理

これらは、UIにもREADMEにもほとんど表に出ません。けれども、これがあるかどうかで、エージェントの判断の質は決定的に変わります。

実例:

- [Anthropic Filesystem MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) は、見た目は「ファイルを読む」だけのサーバーですが、安全な root の制限、シンボリックリンクの扱い、権限境界がきちんと沈んでいます。
- [Supabase MCP](https://github.com/supabase-community/supabase-mcp) は、SQLを直接叩かせず、リスクのある書き込みを `--read-only` で制御するなど、本体APIの上に「人と機械が一緒に使える境界」を沈ませています。

### 未来に起きそうなこと

法令解釈、社内規程、業界の暗黙ルール。これらは、これまで「文書」と「実務担当者の頭」に分かれて存在してきました。

MCPサーバーは、その間に**沈める層**になり得ます。表面の自然言語ではなく、schema・annotations・出典保持・監査ログとして、判断の根拠を企業内に留める。

UIに浮いていた業務知識が、プロトコルの下に沈んで、はじめて他の判断と組み合わせられるようになります。

---

## S3. Spillovers — よいMCPは、作った人の外側に知識を漏らす

無形投資のもうひとつの特徴は、**価値が作った企業の外側に流れ出す**ことです。基礎研究の成果は同業他社にも流れ、優れた組織運営は転職者を通じて漏れ出します。

MCPは、この性質を**設計上、最初から持っている** プロトコルです。

なぜなら、MCPサーバーが公開するのは「APIへの接続」だけではないからです。

- **Tool名と description** が、その業務で重要な操作を言語化する
- **inputSchema / outputSchema** が、その領域のデータモデルを公開する
- **Prompts** が、現場で有効な聞き方の型を共有する
- **Resources** が、参照すべき公式情報の場所を地図として残す

ひとつのMCPサーバーは、コードを使わない人にとっても**業務の整理** として読まれ得ます。

実例:

- デジタル庁が公開した [Jグランツ MCP](https://github.com/digital-go-jp/jgrants-mcp-server) は、補助金APIをラップしたサーバーですが、その存在自体が「行政データはMCP化できる」という実例として広く参照されています。
- [Smithery](https://smithery.ai/) や [Glama](https://glama.ai/mcp/servers)、[mcp.so](https://mcp.so) のようなレジストリは、各サーバーのschemaやannotationsをスキャンして、業務領域ごとに地図を作ろうとしています。
- 私たち自身、Jグランツ MCPのコードを精読する過程で、`accepting` カウントが常に0になるバグを見つけ、PRとしてデジタル庁リポジトリに送りました（[#2 ほか合計4本](https://github.com/digital-go-jp/jgrants-mcp-server/pulls)）。これは spillover が一方通行ではないことの小さな証左です。

### 未来に起きそうなこと

MCPサーバーが増えれば、業務領域ごとの「最小単位の理解」が、コミュニティ全体に蓄積していきます。

会計、法務、人事、調達、研究開発、医療、教育。それぞれの領域で「最初の一つ」が公開されると、後発のサーバーはその schema と prompt を参照しながら作られます。

つまりMCPの spillover は、**「業務の語彙」そのもの**を公共に流していく仕組みになります。

---

## S4. Synergies — MCPの本質は、掛け合わせにある

ここまで見てきたS1〜S3だけでも、MCPは無形資産としての性質を備えています。けれども、MCPの本当の意味はここにありません。

**S4 — Synergies、掛け合わせ。**

Haskel と Westlake は、無形資産は他の無形資産と組み合わせることで、最も大きな価値を生むと指摘しました。R&Dは、優れた組織と組み合わさってはじめて製品になり、ブランドは販売チャネルと組み合わさってはじめて売上になります。

MCPは、この性質を**プロトコルそのものの形**として持っています。

ホスト（Claude / Cursor / ChatGPT 等）は、複数のサーバーを同時に接続できます。会話の中で、エージェントは複数のサーバーのtoolを順番に呼び、結果を組み合わせて新しい判断を作ります。

実例: 入札 × 補助金 × 会計

私たちの環境では、3つのMCPサーバーが同時につながっています。

- [JP Bids MCP](https://mcp.bid-jp.com)（官公需入札）
- [Jグランツ MCP](https://github.com/digital-go-jp/jgrants-mcp-server)（補助金）
- [freee MCP](https://www.npmjs.com/package/freee-mcp)（会計）

ひとつの会話の中で、こう尋ねることができます。

```
鹿児島県のITシステム調達案件のうち、当社のキャッシュで応札可能な額のものを抽出してください。
落札を見込んだ場合、当面の運転資金として活用できる補助金も合わせて教えてください。
```

エージェントは、

1. 入札MCPで該当案件を検索
2. 会計MCPで現在のキャッシュ残高を取得
3. 補助金MCPで現在受付中の補助金を取得
4. 3つを突き合わせ、ひとつの判断として返す

という4段階を、ひとつの会話の中でこなします。

これは、3社が3つのSaaSとして提供しても起きませんでした。**MCPという同じ形** で並べ直したからこそ、エージェントが連結できたのです。

### 未来に起きそうなこと

掛け合わせは、2つや3つで止まる理由がありません。

- 公共調達 × 補助金 × 会計 × 契約 × 人材 × カレンダー
- 医療記録 × 保険 × 薬価 × 服薬カレンダー × 家族通知
- 不動産 × 都市計画 × 補助金 × 建築基準 × 工程管理

掛け算の組み合わせは、当事者の頭の中にあった「業務」の構造をそのままなぞります。誰かがホワイトボードに矢印を書いていた業務図が、ホストの中で、エージェントの呼び出しグラフとして再現されるようになります。

ここに、無形資産の最大の特性 — **使うほどに価値が増える、組み合わせるほど予想外の価値が生まれる** という現象が、ようやくソフトウェアの形で実装されます。

---

## 公式の思想 — シンプルで、美しいこと

MCPの[公式アーキテクチャ](https://modelcontextprotocol.io/docs/concepts/architecture)を読むと、驚くほどシンプルです。

- 3つの登場人物（Host / Client / Server）
- JSON-RPC 2.0
- 7つほどのプリミティブ
- ステートフルな接続

新しい概念をたくさん導入していません。むしろ、既存の標準と既存の設計言語の組み合わせで成立しています。

しかし、4Sの観点から見ると、この最小限の規約こそが、無形資産的な掛け合わせを可能にする土台になっています。プロトコルが小さいからこそ、領域も実装言語も越えて並べられます。

[MCP Apps](https://github.com/modelcontextprotocol/typescript-sdk) のように、tool 実行結果が会話の中に表として直接描画される拡張も、この最小規約の上に載っています。JSON でも外部リンクでもなく、**会話の続きに、業務画面が静かに置かれる**。

それは、新しい派手な機能ではありません。**同じ形で並ぶことの、当然の結果**です。

---

## おわりに — 掛け合わせは、どこまで続くか分かりません

無形資産の4Sに、MCPはほとんどそのまま当てはまりました。

- Scalability: ホストを越えて、同じ形で何度でも呼ばれます
- Sunkenness: 価値の本体は、tool名の下に沈みます
- Spillovers: schema と prompt として、業務の語彙が外に漏れます
- Synergies: 掛け合わせるほど、予想していなかった判断が生まれます

掛け合わせがどこまで続くのかは、誰にも分かりません。

ただ、ひとつだけ言えることがあります。**正しく掛け合わせれば、公式の思想が言うとおり、シンプルで美しいまま、強い体験を生む**ということです。

派手な変革を語る必要はありません。机のうえの一枚の紙が、いま、エージェントを通じて、補助金や会計や契約と静かに繋がりはじめています。

それは、これまでのソフトウェアが扱えなかった種類の価値です。

---

### 参考

- Jonathan Haskel and Stian Westlake, *[Capitalism without Capital: The Rise of the Intangible Economy](https://press.princeton.edu/books/hardcover/9780691175034/capitalism-without-capital)*, Princeton University Press, 2017
- [Model Context Protocol — Specification (latest)](https://modelcontextprotocol.io/specification/latest)
- [Model Context Protocol — Architecture overview](https://modelcontextprotocol.io/docs/concepts/architecture)
- [GitHub MCP Server](https://github.com/github/github-mcp-server)
- [Stripe MCP](https://docs.stripe.com/mcp)
- [Supabase MCP Server](https://github.com/supabase-community/supabase-mcp)
- [デジタル庁 Jグランツ MCP](https://github.com/digital-go-jp/jgrants-mcp-server)
- [JP Bids MCP](https://github.com/sugukurukabe/koko-call-mcp) / [mcp.bid-jp.com](https://mcp.bid-jp.com)
