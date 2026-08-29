# ADR-0025: Investor Radar のスコープと投資助言非該当設計
# ADR-0025: Investor Radar Scope and Non-Advisory Design
# ADR-0025: Lingkup Investor Radar dan Desain Bukan Nasihat Investasi

## Status / Status / Status

Accepted / Accepted / Diterima

## Context / 背景 / Konteks

**日本語**

JP Bids MCP は KKJ 官公需検索に専念してきた（ADR-0012）。一方、上場企業が官公需案件に関与する事実は株式市場の材料になりうるが、KKJ 公告と銘柄コードを繋ぐ MCP は存在しない。公式ロードマップ（2026-08-22）は Tasks 拡張・`ttlMs`/`cacheScope`・progressive discovery を優先するが、SDK `@modelcontextprotocol/sdk` 1.29.0 はこれらを未実装である。

金融商品取引法上の投資助言に該当しないよう、売買推奨や「買い/売り」スコアは出さない。提供するのは事実情報（公告の言及・公開株価の時系列）のみとする。

**English**

JP Bids MCP has stayed focused on KKJ procurement search (ADR-0012). Listed-company involvement in public procurement can be market-relevant, but no MCP currently joins KKJ notices to ticker codes. The official MCP roadmap (updated 2026-08-22) prioritizes the Tasks extension, `ttlMs`/`cacheScope`, and progressive discovery; `@modelcontextprotocol/sdk` 1.29.0 does not implement them yet.

To stay outside investment-advisory regulation, the server must never emit buy/sell recommendations or advisory scores. It returns facts only: notice mentions and public price series.

**Bahasa Indonesia**

JP Bids MCP tetap fokus pada pencarian pengadaan KKJ (ADR-0012). Keterlibatan perusahaan tercatat dalam pengadaan publik dapat relevan bagi pasar, tetapi belum ada MCP yang menghubungkan pengumuman KKJ dengan kode ticker.

Agar tidak masuk nasihat investasi, server tidak boleh mengeluarkan rekomendasi beli/jual. Hanya fakta yang dikembalikan.

## Decision / 決定 / Keputusan

### 1. 境界 / Boundary / Batas

- KKJ 由来（公告・件名・企業名の名寄せ）は JP Bids コアに置く。
- 株価・上場マスタの鮮度は J-Quants API v2 のパススルー（ADR-0026）。キー未指定時はバンドル済み名寄せカタログのみ使う。
- EDINET XBRL の自前解析はしない。TDnet / EDINET は公式 URL への案内に留める。
- Gateway の Finance Pack（ADR-0022）は jp-bids の Investor ツールを `investor_radar` / `financial_check` mode で露出する。J-Quants を独立 child MCP としては登録しない。

KKJ-derived mapping lives in the JP Bids core. Prices come from J-Quants passthrough (ADR-0026). EDINET XBRL is out of scope. Gateway exposes Investor tools via mode, without registering a separate J-Quants child MCP.

### 2. 投資助言非該当 / Not investment advice / Bukan nasihat investasi

禁止:

- 「買い」「売り」「オーバーウェイト」等の推奨語
- 総合スコアやシグナルラベル（bullish / bearish）
- 将来価格の予測

許可:

- 公告件数・最新公告日・都道府県/カテゴリ内訳
- 公告日前後の終値系列と変化率（事実）
- 「本情報は投資助言ではありません」免責を全 structuredContent に付与

### 3. 公式ロードマップとの関係 / Roadmap / Peta jalan

検証日: 2026-08-30。SDK 1.29.0 に `ttlMs` / `cacheScope` / `CreateTaskResult` / `server/discover` / Tasks extension は存在しない。

| 項目 | 本リリース | 将来 |
|------|------------|------|
| `content` + `structuredContent`（ADR-0003） | 維持 | — |
| Tasks / `subscriptions/listen`（SEP-2663） | 実装しない。長時間イベントスタディは同期ツールとして完結 | SDK が ext-tasks を提供し、ホスト対応が確認できてから |
| `ttlMs` / `cacheScope`（SEP-2549） | 実装しない | SDK 対応後に list 結果へ付与 |
| progressive discovery / `server/discover` | 実装しない | SDK 対応後 |
| DPoP / Agent Identity | 実装しない | Agent Identity WG の仕様確定後 |

KKJ 公告は落札確定情報ではない。ツール説明と caveats で「公告への言及であり公式落札結果ではない」と明示する。

## Consequences / 影響 / Konsekuensi

良い影響: KKJ にしかない官公需×銘柄の接続を、既存の App / attribution / Pro tier パターンで提供できる。

制約: バンドル名寄せは全上場企業を覆わない。J-Quants キーがあるときだけマスタを拡張する。Tasks 未実装のため長時間ジョブの再開はホスト再呼び出しに依存する。

## Related ADRs / 関連 ADR / ADR Terkait

- ADR-0003 Response format
- ADR-0006 Attribution
- ADR-0007 Tool surface
- ADR-0012 Roadmap boundaries
- ADR-0014 MCP Apps host actions
- ADR-0016 Federation Hub
- ADR-0021 MoneyForward passthrough
- ADR-0022 Expansion packs
- ADR-0023 MCP 2026-07-28
- ADR-0026 J-Quants passthrough auth

## References / 参考 / Referensi

- [MCP Roadmap (2026-08-22)](https://modelcontextprotocol.io/development/roadmap)
- [SEP-2663 Tasks extension](https://modelcontextprotocol.io/extensions/tasks/overview)
- [J-Quants API](https://jpx-jquants.com/)
