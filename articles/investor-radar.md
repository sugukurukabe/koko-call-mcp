---
title: "官公需の公告に、銘柄コードを付ける — JP Bids Investor Radar"
emoji: "📡"
type: "tech"
topics: ["mcp", "typescript", "claude", "govtech", "公共調達"]
published: true
---

## Investor Radar の定義 — 公告と銘柄を結ぶ橋

Investor Radar（インベスター・レーダー）は、JP Bids MCP v0.9.0 が追加した Pro 機能で、中小企業庁 官公需情報ポータルサイト（KKJ）の公告テキストを上場企業の銘柄コードへ名寄せする。売買の推奨は出さない。KKJ が返すのは公告であり、公式の落札者・落札金額ではない。

件名に「富士通」と書いてある行は、長いあいだ検索結果の一行で終わっていた。住所も、提出期限も、添付 PDF の URI もある。ないのは、その名前が市場で何と呼ばれているかという対応表だった。Investor Radar はその対応表を、Model Context Protocol（MCP）のツールとして公開した。

リモートは `https://mcp.bid-jp.com/mcp`。npm は `jp-bids-mcp@0.9.0`。出典は常に KKJ（政府標準利用規約 第2.0版）を返す。

## 同じ会話に株価を置く

公開終値は、JP Bids が預からない。利用者が自分の J-Quants API キー（refresh token）を `jquants_api_key` または環境変数 `JQUANTS_API_KEY` で渡したときだけ、`analyze_award_price_impact` が公告日前後の終値系列を返す。サーバーはキーを保存しない（[ADR-0026](https://github.com/sugukurukabe/koko-call-mcp/blob/main/docs/adr/0026-jquants-passthrough-auth.md)）。

市場データ MCP を同じ Cursor / Claude セッションに並べれば、日足や開示と突き合わせできる。JP Bids は官公需側の橋であり、市場側のマスタではない。二つのサーバーが一つの会話にいる、というだけのことだ。

```text
「6702 の官公需公告と、公告日前後の終値を見せて」
```

禁止している語は短い。「買い」「売り」「オーバーウェイト」。許可しているのは件数、日付、終値、変化率、そして「本情報は投資助言ではありません」という一文である。

| 見たいもの | 使うもの |
|---|---|
| **銘柄への名寄せ** | `map_awards_to_listed`（J-Quants キー不要） |
| **公告履歴** | `get_listed_award_history` |
| **公告日前後の終値** | `analyze_award_price_impact`（J-Quants キー必須） |
| **ウォッチ** | `watch_listed_awards` |
| **画面** | `search_investor_radar_app`（`ui://jp-bids/investor-radar.html`） |

## 実装が先に決めた境界

KKJ 由来の名寄せはコアに置いた。株価はパススルーにした。EDINET の XBRL は自前で解析しない。公式ロードマップの Tasks 拡張は、SDK `@modelcontextprotocol/sdk` 1.29.0 に無いので同期ツールのまま出した（[ADR-0025](https://github.com/sugukurukabe/koko-call-mcp/blob/main/docs/adr/0025-investor-radar-scope.md)）。

知っているだけでは足りない。schema に落ち、test に通り、`jp-bids-mcp@0.9.0` として release されて初めて、この橋は実在する。

接続は MCP 対応クライアントにこの URL を登録するだけである。

```text
https://mcp.bid-jp.com/mcp
```

仕様書は古びた紙ではない。機械に制度の壁を教えるための地図である。官公需の一行に銘柄コードを付けることは、相場を語ることではない。公的な事実が、どの会社の名前で書かれているかを、省略せずに返すことだ。

- ランディング: [https://mcp.bid-jp.com/](https://mcp.bid-jp.com/)
- 設計メモ: [docs/investor-radar.md](https://github.com/sugukurukabe/koko-call-mcp/blob/main/docs/investor-radar.md)
- GitHub Release: [v0.9.0](https://github.com/sugukurukabe/koko-call-mcp/releases/tag/v0.9.0)
