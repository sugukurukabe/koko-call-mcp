# X 投稿テキスト

> 表の目的: 作ったものと、それでできること、MCP Apps の先を、淡々と置く。
> 隠している目的: 多く語らない。スキル自慢をしない。
>
> 成果物が届けば、見る人は黙って評価する。
> こちらから自慢を添えると、せっかくの artifact が軽く見える。

---

## 原則

1. **「ぜひ試して」「無料です」「相談受けます」を書かない**  
   呼び込みの言葉は artifact の重さを減らす。
2. **「テスト数」「PR数」「品質スコア」など数値の自己開示をしない**  
   読む人は github を開けば自分で確かめられる。
3. **「上級」「リファレンス品質」など肩書語を使わない**  
   そう見えるかどうかは読み手が決める。
4. **書くことは、対象（入札／MCP）の話だけにする**  
   開発者の話にしない。

---

## 推奨: 単発投稿 3パターン

連投スレッドより、単発1ツイートを別タイミングで3回流す方が、声として整う。

### パターン A — 入札を読む人に向けて

```
中小企業庁の官公需情報ポータルサイトには、
年間180万件を超える入札公告が公開されている。

公開されてはいるが、人が一件ずつ読める量ではない。

JP Bids MCP は、その公開情報を AI から読めるようにしたサーバーです。

https://mcp.bid-jp.com
```

### パターン B — MCP / AI 側に関心がある人に向けて

```
JP Bids MCP を公開しました。

`search_bids_app` という tool は、AI の返答の中に
検索結果のテーブルがそのまま描画されます（MCP Apps 対応クライアントで）。

会話の中に、JSON でも外部リンクでもなく、表が置かれる。

https://github.com/sugukurukabe/koko-call-mcp
```

### パターン C — 英語

```
JP Bids MCP — an MCP server for Japan's SME Agency procurement portal.
1.8M+ public bids per year, exposed through MCP 2025-11-25.

One tool renders results as a table inside the conversation,
using MCP Apps. Not JSON. Not a link out.

https://github.com/sugukurukabe/koko-call-mcp
```

---

## 連投にしたい場合の最小セット

どうしても連投にする場合は2本まで。
2本目は「使う人にとって何が変わるか」だけ。技術自慢を続けない。

### A の続き（任意・1本）

```
仕様書 PDF は、20ページ目を読み終わってから
「うちの資格では出せない」と気づくことがある。

extract_bid_requirements は、その20ページを構造化して返す。
要件と参加資格は、最初の数行で読める形になる。
```

### B の続き（任意・1本）

```
Resources / Resource Templates / Prompts / Completion も実装してあります。

MCP は tool の集まりではなく、対話の中で振る舞う小さな制度として
扱える、ということを確かめたかった。
```

---

## 添える画像（もし添えるなら 1 枚だけ）

- A 用: `extract_bid_requirements` の応答 JSON を整形したスクリーンショット（実物）
- B 用: `search_bids_app` のテーブルが Claude / Cursor の会話に描画された画面（実物）
- C 用: 同上、英語UIで

ロゴ単体・OGP 画像・宣伝バナーは付けない。

---

## ハッシュタグ・メンション

- ハッシュタグは付けない。
- `@modelcontextprotocol` `@AnthropicAI` `@cursor_ai` などへのメンションも付けない（こちらから話しかけるのではなく、artifact の側を歩かせる）。
- 例外: 仕様書のバグや不明点をデジタル庁・MCP コミュニティに公式に問う場合のみ、相手アカウントを正しく付ける。

---

## 投稿しないことを選ぶ

書いてみて、これは添えなくてもよいと感じたら、出さなくてよい。
Zenn 記事と GitHub は残る。
出すかどうかは、artifact の重さを今日上げるか、明日も触り続けるかの選択でしかない。
