# X（Twitter）投稿スレッド

> 壁の手動作業: 3連投をスレッド形式で投稿する。1→2→3の順で返信として投稿。

---

## スレッド A: 営業・入札担当者向け（日本語）

**1/3（最初のツイート）**
```
官公需入札の調査、まだ手作業でやってますか？

「鹿児島県のIT系入札を探して、うちに合う順に並べて」

AIに話しかけるだけで全部終わります。

手作業2時間15分 → 約2分。

JP Bids MCP、ベータ期間中は全機能無料。

https://mcp.bid-jp.com
```

**2/3（1のリプライ）**
```
具体的にできること:

→ 全国180万件/年の入札情報をキーワード・都道府県・区分で絞り込み
→ 仕様書PDFを自動取得して必須要件・評価基準を構造化
→ 参加資格の適合チェック（全省庁統一資格）
→ 締切日をICSカレンダーへ登録
→ 社内検討メモをMarkdownで生成

Claude / Cursor / ChatGPT から使えます。
```

**3/3（2のリプライ）**
```
技術的背景:

MCP 2025-11-25仕様完全準拠
17ツール / Streamable HTTP / OAuth 2.0
デジタル庁 Jグランツ MCP との連携デモも公開

コード:
https://github.com/sugukurukabe/koko-call-mcp

#MCP #官公需 #AI
```

---

## スレッド B: エンジニア向け（日本語）

**1/3**
```
JP Bids MCP をリリースしました。

日本の官公需入札情報（年間180万件）を
MCP 2025-11-25 仕様で公開するサーバー。

17ツール / Streamable HTTP / OAuth 2.0 PKCE / outputSchema全対応

https://github.com/sugukurukabe/koko-call-mcp
```

**2/3（リプライ）**
```
デジタル庁が公開している Jグランツ MCP に
バグ修正・Cloud Run対応・Dockerfile・pytestを
4本PRとして送信しました。

入札（KKJ）× 補助金（Jグランツ）× 会計（freee）の
3 MCP連携デモも公開。

公共データMCPのエコシステムを少しずつ広げています。
```

**3/3（リプライ）**
```
技術的こだわり:

- MCP 7プリミティブ実装（Tools/Resources/Templates/Prompts/Completion/Logging/Notifications）
- server.json / agents.json / mcp-server.json の標準メタデータ
- biome lint / 103テスト / GitHub Actions CI

Smithery / Glama / mcp.so に掲載中。

#MCP #TypeScript #GovTech
```

---

## スレッド C: 英語（HN/dev.toとのクロスポスト）

**1/2**
```
Built an MCP server for Japanese government procurement.

180万件/yr (1.8M) public bids from the SME Agency portal.
17 tools: search, rank, extract PDF specs, check qualifications, export CSV, generate calendar ICS.

Streamable HTTP + OAuth 2.0. Free during beta.

https://mcp.bid-jp.com
```

**2/2（リプライ）**
```
Also contributed 4 PRs to @digital_go_jp's J-Grants MCP server:

1. Bug fix: accepting count always returned 0
2. stateless_http=True for Cloud Run
3. Official Dockerfile
4. 14 pytest unit tests

Building Japan's public data MCP ecosystem one PR at a time.

github.com/sugukurukabe/koko-call-mcp
```

---

## 投稿タイミング推奨

| スレッド | 投稿時間 | 理由 |
|---------|---------|------|
| A（営業向け） | 平日 8:00〜9:00 | 始業前チェックに引っかかる |
| B（エンジニア向け） | 平日 12:00〜13:00 | ランチタイム |
| C（英語） | 日本時間 22:00〜23:00 | 欧米の朝〜昼に重なる |

---

## 画像素材の説明（壁がスクリーンショット撮影）

1. **Before/Afterテーブル**: `https://mcp.bid-jp.com` のランディングページにある表を画面録画
2. **Claude会話デモ**: Cursorまたはクロードで `search_bids → rank_bids` を実行した会話スクリーンショット
3. **Smitheryバッジ**: https://smithery.ai/servers/a-kabe-1qio/jp-bids-mcp の画面
