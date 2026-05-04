---
title: "特定技能派遣会社のCEOが自社のためにMCPサーバーを作ったら、MCP Apps UIまで実装する羽目になった"
emoji: "📋"
type: "tech"
topics: ["mcp", "ai", "入札", "stripe", "vertexai"]
published: false
---

毎朝、PDFが届く。

農業分野の特定技能外国人を全国の農家へ派遣している会社として、農業関係の政府調達・補助金・事業委託の公告をチェックするのは日課の一つになっている。官公需情報ポータルサイトを開き、キーワードを入れ、ヒットした案件ページを開き、PDFをダウンロードして、仕様書を読む。この作業を毎朝繰り返していた。

読んでいるのは、入力フォームではない。制度の外に出てきた要件書だ。「農業分野」「特定技能」「令和7年3月31日締切」——その言葉が何件の仕事を産み、何人のスタッフの働き口になるかは、書いた公務員には関係ない。それでも私は読む。

あるとき気づいた。これはAPIになっている。

## なぜ作ったか

官公需情報ポータルサイトは、公式REST APIを提供している。エンドポイントは `https://www.kkj.go.jp/api/v1/` から始まる。都道府県コード、業種コード、日付範囲、フリーキーワード——自分が毎朝手でやっていたことが、JSONで返ってくる。

知っているだけでは足りない。実装して、テストを通して、リリースして初めて知ったことになる。

最初は Claude.ai に直接「この案件を分析して」と入れていた。コピーペーストで。ところが案件は毎日出る。10件、20件。AIへの手渡しが新しい手作業になっていた。

MCPサーバーにすれば、エージェントが直接KKJ APIを叩ける。私が手で開いていたウィンドウを、プロトコルが担う。そう考えて、JP Bids MCPを作り始めた。

## 何ができるか

現在17のツールがある。

```
search_bids          — 全文検索。都道府県・業種・期限で絞り込み
rank_bids            — 自社条件でスコアリング
explain_bid_fit      — 案件との適合度を説明
assess_bid_qualification  — 参加資格の充足確認
extract_bid_requirements  — PDF/HTMLから要件を抽出（Vertex AI）
create_bid_review_packet  — 社内検討メモを生成
draft_bid_questions  — 質問書ドラフト
create_bid_calendar  — 締切をICSカレンダーに変換
export_bid_shortlist — CSV/JSON出力
analyze_past_awards  — 落札実績の分析
search_bids_app      — MCP Apps UI付き検索
```

典型的な流れはこうなる:

1. `search_bids` で農業関係の案件を20件取得する
2. `rank_bids` で自社の強みと照合しスコアを付ける
3. `extract_bid_requirements` で仕様書PDFを読む
4. `assess_bid_qualification` で参加資格を確認する
5. `create_bid_review_packet` で社内検討用のメモを生成する
6. `draft_bid_questions` で質問書のドラフトを作る
7. `create_bid_calendar` で締切を手帳に入れる

朝30分かかっていた作業が、エージェントとの会話で動くようになった。

## MCP Apps UIのこと

MCPの仕様書（2025-11-25）には、Toolsの他にResources、Prompts、Completionなどが定義されている。さらに、`@modelcontextprotocol/ext-apps` という実験的な拡張があり、MCPサーバーがHTMLのUIパネルをクライアントに埋め込めるようになっている。

「実験段階だから後回し」ではなく、「だからこそ先に実装して真のフィードバックをする」と判断した。

`search_bids_app` を呼ぶと、Claude.aiのサイドパネルに「AI Bid Workspace」が現れる。案件一覧、優先度ラベル、提出期限の残日数、PDFの有無——これらが検索結果から自動計算されて並ぶ。案件を選び、「読む」ボタンを押すと、エージェントが `extract_bid_requirements` を実行する。UIからチャットへのブリッジは、MCP Appsの `sendMessage` APIで実装されている。

```typescript
const result = await app.sendMessage({
  role: "user",
  content: [{
    type: "text",
    text: `このPDFを読んで参加要件を抽出してください。\n\nツール: extract_bid_requirements\n引数: { "bid_key": "${bid.key}", "fetch_documents": true }`,
  }],
});
```

UIは、エージェントを動かすためのリモコンだ。クリックひとつで、30行の指示がプロトコルを通じて送られる。

## 技術的に何が違うか

**和暦の処理**。日本の公告書類は「令和7年3月31日」と書く。ISOもUnixタイムスタンプも書かない。`parseJapaneseDateToDate` という関数を書いた。戦前から対応している必要はなかったので、令和・平成・昭和の3元号に絞って実装した。

**Vertex AI の直接呼び出し**。PDFをテキストに変換してからLLMへ送る方式ではなく、Gemini 2.5 Flashのネイティブ画像認識でPDFをそのまま処理している。`@google/genai` SDKを使い、1件あたり推定1〜3円のコストで動作する。

**Toolsだけで終わらせない**。JP Bids MCPは、Tools、Resources、Resource Templates、Prompts、Completionを組み合わせている。Toolsだけのサーバーは動くが、公共データの信頼性はResourcesとPromptsで担保される。

**SSRF対策**。外部URLからPDFを取得するツールは、攻撃ベクターになりえる。プライベートIPレンジとループバックアドレスへのリクエストを検証でブロックしている。外部PDFを扱うMCPサーバーの設計として、この制限は省けない。

## Free/Proの話

990円/月のProプランを設定した。**2026年6月末まではベータ期間として全機能を無料で開放している。**

根拠は単純だ。Vertex AIでPDF1件を処理するコストは約1〜3円。月30件込みのPro料金として990円は、原価より十分大きい。競合するSaaSの1/3以下の価格でもある。

`Authorization: Bearer jp-bids_xxx` ヘッダーを付けると、17ツール全部と MCP Apps UIが解放される。ヘッダーなしでは、検索・一覧・詳細・スコアリングの4ツールのみ。PDF抽出・AI分析・保存検索は、実際にコストがかかる処理だから、Proに置いた。

PDF抽出が発生するたびに、Stripe Metersへイベントが飛ぶ。月30件を超えた分は1件10円で請求される。Stripe v2のMeter API、`stripe.v2.billing.meterEvents.create()` で実装した。課金処理は fire-and-forget——成功しなくてもツールの実行は止まらない。

```text
Remote MCP: https://mcp.bid-jp.com/mcp
```

6月末まではAPIキー不要で全ツールが使える。7月以降はProキーが必要になる。キーの発行方法は上記から。

## なぜ公開するのか

官公需のデータは公開情報だ。処理する能力が、どこにでも届けられるべきだと思っている。大手コンサルや商社の調査部門ではなく、地方の農家、小さな人材会社、NPOが、同じ情報へのアクセスを持てる状態を作りたい。

私が鹿児島の農村で毎朝PDFを読んでいるのは、それが仕事だからだ。それをプロトコルに変えて公開するのは、同じ作業を別の誰かがやらなくて済むようにするためだ。

認識は求めない。次のリリースに戻るための環境があれば十分だ。

---

最後にひとつだけ言うと、毎朝のPDF確認は、MCPサーバーを作ってからも消えていない。

ツールが案件を抽出し、スコアを付け、要件書を読んで、質問書まで下書きする。それを眺めながら、私はまだ判断している。「これは本当に取れる仕事か」という問いは、プロトコルの外にある。

どんな道具を作っても、最後の判断だけは手元に残る。それが、今のところの正しい状態だと思っている。
