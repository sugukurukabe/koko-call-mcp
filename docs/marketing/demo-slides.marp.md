---
marp: true
theme: default
size: 16:9
paginate: true
header: 'JP Bids MCP'
footer: 'Sugukuru Inc. / mcp.bid-jp.com'
style: |
  section {
    font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif;
    background: #ffffff;
    color: #111827;
    padding: 64px;
  }
  h1 {
    color: #0f172a;
    font-size: 56px;
    font-weight: 700;
    border-bottom: 4px solid #0f172a;
    padding-bottom: 8px;
  }
  h2 {
    color: #0f172a;
    font-size: 40px;
    font-weight: 700;
  }
  h3 {
    color: #1e293b;
    font-size: 28px;
  }
  table {
    font-size: 22px;
    border-collapse: collapse;
    margin: 16px 0;
  }
  th {
    background: #0f172a;
    color: #ffffff;
    padding: 8px 16px;
    text-align: left;
  }
  td {
    padding: 8px 16px;
    border-bottom: 1px solid #e5e7eb;
  }
  pre, code {
    font-size: 18px;
    background: #f3f4f6;
    color: #111827;
    border-radius: 6px;
  }
  .lead {
    font-size: 28px;
    color: #475569;
  }
  .accent {
    color: #b91c1c;
    font-weight: 700;
  }
  header {
    color: #6b7280;
    font-size: 16px;
  }
  footer {
    color: #6b7280;
    font-size: 14px;
  }
---

<!-- _class: lead -->
<!-- _paginate: false -->
<!-- _header: '' -->

# JP Bids MCP

## 官公需入札調査をAIに任せる

Model Context Protocol 2025-11-25 仕様準拠

`https://mcp.bid-jp.com`

スグクル株式会社

---

## 課題 — 入札調査は時間がかかりすぎる

### 入札担当者の1日

| 工程 | 時間 |
|------|------|
| 入札情報検索 | 30分 |
| 仕様書PDF読み込み | 1時間 |
| 参加資格確認 | 30分 |
| 締切管理登録 | 15分 |
| **合計 / 1件** | **2時間15分** |

週10件なら **22.5時間**。本業に使う時間がない。

---

## 解決策 — AIに話しかけるだけ

### こう変わる

> 「鹿児島県のIT系入札を探して、うちに合う順にランク付けして」

↓

```
検索 → スコアリング → PDF解析 → カレンダー登録
約 2 分
```

2時間15分 → <span class="accent">約2分</span>。同じ時間でカバーできる件数が60倍に。

---

## JP Bids MCP とは

### 技術基盤

| 項目 | 内容 |
|------|------|
| プロトコル | Model Context Protocol 2025-11-25（最新仕様） |
| データソース | 中小企業庁 官公需情報ポータル（年間180万件） |
| ツール数 | 17（検索・ランキング・PDF解析・資格確認・カレンダー・CSV出力） |
| トランスポート | Streamable HTTP + OAuth 2.0 |
| 対応クライアント | Claude / Cursor / ChatGPT（MCP対応ツール全般） |
| デプロイ | Cloud Run（asia-northeast1） |

---

## 17ツール一覧

| 区分 | ツール |
|------|--------|
| 検索・発見 | `search_bids` / `list_recent_bids` / `get_bid_detail` |
| 分析・判断 | `rank_bids` / `explain_bid_fit` / `analyze_past_awards` / `summarize_bids_by_org` |
| 書類・資格 | `extract_bid_requirements` / `assess_bid_qualification` / `draft_bid_questions` |
| アクション | `create_bid_calendar` / `create_bid_review_packet` / `export_bid_shortlist` |
| アラート | `save_search` / `check_saved_search` / `list_saved_searches` |

会話の中に検索結果のテーブルを描画する MCP Apps（`search_bids_app`）にも対応します。

---

## エコシステム — 他MCPとの連携

### 入札だけじゃない

```
JP Bids MCP（入札）
     ↕
Jグランツ MCP（補助金）  ↔  freee MCP（会計）
```

**3つのワークフロー例**

1. 入札応募費用を freee で確認 → 採算が合えば応募
2. 落札後の売上を freee へ自動登録
3. 補助金と入札を同時に検索して最適な収益を試算

---

## 技術品質

### 信頼できるコードベース

| 指標 | 内容 |
|------|------|
| テスト | 100件以上のユニット・統合テスト |
| ビルド | GitHub Actions による継続的インテグレーション |
| リント | biome（zero-config） |
| ライセンス | BSL-1.1（商用権保持） |
| MCP仕様準拠 | 7プリミティブすべてを実装 |
| 掲載ディレクトリ | Smithery / mcp.so / 公式 MCP Registry |

---

## 収益モデル

### 現行（ベータ）

- Free: 4ツール無料
- Pro: ¥990/月（17ツール全機能）

### 拡張シナリオ

- **OEMライセンス**: 御社ブランドで提供 — 月額固定 + API従量課金
- **エンタープライズ**: 大手向けプライベートインスタンス — 月額50〜200万円
- **データ販売**: 落札実績の統計レポート — 月額10〜50万円

---

## 提案内容

### 3つの選択肢

| 形態 | 内容 | 目線 |
|------|------|------|
| **完全売却** | コード + ドメイン + npm + MCP Registry 名 | 応相談 |
| **OEMライセンス（独占）** | 御社ブランドで提供。開発・運用はスグクル継続 | 月額固定 + 従量 |
| **技術提携** | 御社サービスに API 組込み。レベニューシェア | 売上の10〜20% |

---

## 次のステップ

### 今日決めること

- デモ環境へのアクセス付与
  - `https://mcp.bid-jp.com` にアクセスするだけ
- 技術的な詳細確認
  - GitHub リポジトリを共有
  - コードレビュー・技術質問対応（2週間以内）
- 条件交渉の開始
  - まず電話 1 本 or メール返信だけで OK

---

<!-- _class: lead -->
<!-- _paginate: false -->

# ありがとうございました

スグクル株式会社 / 壁

`https://sugukuru.co.jp`
`https://mcp.bid-jp.com`
