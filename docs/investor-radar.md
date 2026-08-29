# Investor Radar

## 日本語

Investor Radar は、KKJ 官公需公告を上場企業の銘柄コードへ名寄せする Pro 機能です。売買の推奨は行いません。KKJ は公告であり、公式の落札者・落札金額を含みません。

### ツール

| ツール | 内容 | J-Quants |
|---|---|---|
| `map_awards_to_listed` | 公告テキストから銘柄へ名寄せ | 任意 |
| `get_listed_award_history` | 企業・銘柄の公告履歴 | 任意 |
| `analyze_award_price_impact` | 公告日前後の公開終値 | 必須 |
| `watch_listed_awards` | ウォッチリストと差分 | 不要 |
| `search_investor_radar_app` | MCP Apps 画面 | 不要 |

株価取得には利用者自身の J-Quants API キー（refresh token）を `jquants_api_key` または環境変数 `JQUANTS_API_KEY` で渡します。サーバーはキーを保存しません（ADR-0026）。

出典は常に `attribution`（KKJ）に加え、株価利用時は J-Quants 出典を返します。

## English

Investor Radar is a Pro feature that maps KKJ procurement notices to listed-company tickers. It does not provide investment advice. KKJ records are notices, not official award results.

Price series require the caller's own J-Quants API key via `jquants_api_key` or `JQUANTS_API_KEY`. The server never persists the key (ADR-0026).

## Bahasa Indonesia

Investor Radar adalah fitur Pro yang memetakan pengumuman pengadaan KKJ ke ticker perusahaan tercatat. Ini bukan nasihat investasi. KKJ adalah pengumuman, bukan hasil pemenang resmi.

Deret harga memerlukan kunci API J-Quants milik pemanggil. Server tidak menyimpan kunci tersebut (ADR-0026).
