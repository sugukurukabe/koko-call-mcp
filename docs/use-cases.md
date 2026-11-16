# ユースケース / Use Cases / Kasus Penggunaan

JP Bids MCP が解決する、利用者ごとの具体的な課題。

> **プロファイル構成について**: 公開リモートエンドポイント（`https://mcp.bid-jp.com/mcp`）および既定の `public_mvp` プロファイルは、**完全無料・読み取り専用の公開7ツール**（`search_bids`, `list_recent_bids`, `get_bid_detail`, `search_bids_app`, `rank_bids`, `extract_bid_requirements`, `export_bid_shortlist`）を提供します（月額課金・Stripe呼出しなし）。ICS生成・検討メモ・過去公告集計・Investor Radar を含む全22ツールは、ローカル自己ホスト用の開発者プロファイル（`JP_BIDS_PROFILE=full_local`）で利用できます。

## 1. 入札情報サービス事業者・業務システム開発者

**課題**: 既存の検索UIに加え、AI対話型のアクセスを顧客や社内チームに提供したい。ゼロからMCP基盤を開発するコストと時間が障壁。

**JP Bids MCPでの解決**:
- 公開7ツール（`public_mvp`）およびローカル拡張22ツール（`full_local`）・Remote Streamable HTTP・OAuth 2.0がApache-2.0 OSSとして即利用可能
- MCP Apps UI（`search_bids_app`）で、互換クライアントの会話内に案件ワークスペースを描画
- 署名付き `bid_ref` スナップショットと16列CSV/JSONエクスポートを備え、後続システムへの連携が容易

**想定シナリオ（公開MVP 7ツール）**:
```
担当者: 「来週締切のIT系案件を東京都で探して」
AI:     search_bids_app で検索 → 候補一覧をUI表示
        → rank_bids で優先キーワード・期限に基づき比較採点
        → extract_bid_requirements で確認すべき参加要件チェックリストを整理
        → export_bid_shortlist で選択候補をCSV/JSON出力
```

**自社開発との比較**:

| 項目 | 自社開発 | JP Bids MCP 導入 |
|------|----------|-----------------|
| 開発期間 | 3-6ヶ月 | 即日 |
| MCP仕様対応 | 要学習 | 2025-11-25仕様に基づく実装 |
| OAuth 2.0 | 要実装 | 実装済み（PKCE + DCR） |
| AI分析・出力機能 | 要設計 | 公開7ツール（ローカル最大22ツール） |
| ライセンス | 自社保守 | Apache-2.0 OSS（公開MVPは完全無料） |

---

## 2. 中小企業の入札担当者

**課題**: 入札案件の検索・公告内容の確認・要件チェックリスト作成・候補リスト共有を手作業で行っている。

**JP Bids MCPでの解決**:
- AIに「うちに合う入札を探して」と話しかけるだけで横断検索（`search_bids` / `list_recent_bids`）
- 優先語句・除外語句と締切に基づく比較採点（`rank_bids`）
- 公告メタデータ（および自己ホスト設定時の添付PDF）から確認すべき要件を構造化（`extract_bid_requirements`）
- 選んだ候補を順序そのままCSV/JSON出力（`export_bid_shortlist`）

---

## 3. 行政書士・コンサルタント（`full_local` ローカル拡張の活用例）

**課題**: 複数クライアントの入札案件を並行調査し、要件整理・質問案・社内検討メモを作成する反復作業。

**JP Bids MCP（`JP_BIDS_PROFILE=full_local`）での解決**:
- クライアントごとの対象地域・資格等級に応じた適合確認補助（`assess_bid_qualification`）
- 過去公告データからの発注機関別傾向集計（`analyze_past_awards` / `summarize_bids_by_org`）
- 社内検討メモ・質問書ドラフト・ICSカレンダー生成（`create_bid_review_packet` / `draft_bid_questions` / `create_bid_calendar`）

---

## 4. GovTech / デジタル庁エコシステム企業

**課題**: 公共データのMCP化に取り組みたいが、MCP 2025-11-25仕様やMCP Apps UIの実践リファレンスが少ない。

**JP Bids MCPでの解決**:
- MCP 2025-11-25仕様に基づくTypeScriptリファレンス実装
- OAuth 2.0 / Streamable HTTP / Resource Templates / Prompts / Completions / MCP Apps UI の実装パターン
- `server.json` / `.well-known/mcp/server-card.json` のメタデータ設計
- Jグランツ MCP との相互運用構成例（`examples/jgrants-integration/`）

---

## 5. 会計 × 入札の連携ワークフロー（参考構成）

**課題**: 受注後の会計処理（取引登録・請求書作成・経費集計）が手作業で、案件メタデータとの紐づけが断絶。

**JP Bids MCP × freee MCPでの解決**（別途 `freee-mcp` を併用する参考構成）:
- `get_bid_detail` で取得した案件名・発注機関情報をもとに、会計MCP側で取引・請求書作成を補助
- 入札準備経費と受注案件の費用対効果整理

---

## 6. 上場企業の官公需公告調査（Investor Radar — `full_local` 限定参考実装）

**課題**: 官公需の公告にどの上場企業が名前として出てくるかを、KKJ と株価画面を行き来しながら手で集めている。

**JP Bids MCP（`JP_BIDS_PROFILE=full_local`）での解決**:
- `map_awards_to_listed` で公告を銘柄コードへ名寄せ
- `analyze_award_price_impact` で公告日前後の公開終値を確認（利用者自身の J-Quants キーを使用）
- 売買推奨は出さない。KKJ は公告であり公式落札結果ではない

---

## 導入判断のための指標

| 指標 | 値 |
|------|-----|
| MCP仕様バージョン | 2025-11-25 |
| ツール数 | 公開MVP 7ツール（ローカル `full_local` 22ツール） |
| 自動テスト | 41ファイル・290テスト |
| 品質ゲート | Biome lint + `tsc` 全層型検査 + 再現性ビルド検証 + Vitest |
| トランスポート | stdio + Streamable HTTP |
| 認証 | リモート HTTP: OAuth 2.0 (PKCE + DCR) / ローカル stdio: 不要 |
| エコシステム連携例 | Jグランツ MCP + freee MCP |
| ライセンス | Apache-2.0（公開MVP完全無料） |
