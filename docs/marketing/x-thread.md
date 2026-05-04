# X 投稿テキスト

> 壁の手動作業: 下記をそのまま投稿。
> 原則: 露出は目的ではない。成果物が届くために最小限の信号を出すだけ。
> ブランド比較・煽り・「ぜひ試して」系の community 営業表現は使わない。

---

## スレッド A: 入札実務に近い読者向け（日本語）

**1/3**
```
中小企業庁の官公需情報ポータルサイトには、
年間180万件超の入札公告が公開されている。
ただし、人間が一件ずつ読める形では公開されていない。

JP Bids MCP は、その公開情報をAIが読める形に整えるサーバーです。

https://mcp.bid-jp.com
```

**2/3（1のリプライ）**
```
仕様書PDFは、20ページ目の先に参加資格が書かれていることがある。
読み終わってから「うちの資格では出せない」と気づく作業を、
何度繰り返しただろうか。

extract_bid_requirements は、その20ページを構造化して返す。
資格不適合は最初の3秒で分かる。
```

**3/3（2のリプライ）**
```
コードは BSL-1.1 で公開、Cloud Run で運用、ベータ期間中は無料。
売却・OEMの相談も受けます。

GitHub: https://github.com/sugukurukabe/koko-call-mcp
```

---

## スレッド B: エンジニア向け（日本語）

**1/3**
```
JP Bids MCP を公開しました。

中小企業庁の官公需情報ポータルサイト（KKJ）を、
Model Context Protocol 2025-11-25 仕様で扱うサーバー。

仕様準拠は宣言ではなく、tool ごとの inputSchema / outputSchema / annotations と
7 primitives の実装で担保しています。

https://github.com/sugukurukabe/koko-call-mcp
```

**2/3（リプライ）**
```
副産物として、デジタル庁が公開している jgrants-mcp-server に PR を4本送っています。

- accepting カウントが常に0を返すバグ修正
- Cloud Run 用 stateless_http=True
- Dockerfile（マルチステージ）
- pytest 14件

公共データのMCPは、まだ揃っていない。揃える側に回りたい。
```

**3/3（リプライ）**
```
Streamable HTTP + OAuth 2.0（PKCE / DCR）、Smithery Quality 90+。

依存している原典はひとつ。中小企業庁 KKJ Web-API です。
それを正確に翻訳する以上のことを、サーバーはしていません。
```

---

## スレッド C: 英語（HN / dev.to と整合）

**1/2**
```
JP Bids MCP — an MCP server for Japan's SME Agency procurement portal (KKJ).
1.8M+ public bids per year, exposed as 17 tools.
MCP 2025-11-25 spec, all 7 primitives, Streamable HTTP, OAuth 2.0 (PKCE + DCR).

https://github.com/sugukurukabe/koko-call-mcp
```

**2/2（リプライ）**
```
Built alongside 4 PRs to Japan's Digital Agency jgrants-mcp-server:
bug fix, Cloud Run support, Dockerfile, 14 pytest cases.

KKJ + J-Grants together cover procurement and subsidies in one conversation.

Endpoint: https://mcp.bid-jp.com/mcp
```

---

## 投稿時の判断基準

- **画像**: 1枚だけ。tool 実行の生のレスポンスを切り出したスクリーンショット（`extract_bid_requirements` の構造化出力など）。プロモ画像・ロゴ単体は載せない。
- **時間帯**: 平日朝が読者と一致しやすい。ただし「最適時間」の最適化に意味はない。書いたら出す。
- **ハッシュタグ**: 付けない。MCP / GovTech タグは検索流入のためでなく、検索者が偶然たどり着けるための地図として最小限。今回は無くてよい。
- **連投の間隔**: 30秒以上空ける（X側の自動結合バグ対策）。

---

## 投稿しないことを選んだ場合

このスレッドを出さなくても、Zenn と GitHub は残る。
露出は目的ではなく、成果物が届くための補助である。
今日に納得が来ない文章なら、明日まで保留してよい。
