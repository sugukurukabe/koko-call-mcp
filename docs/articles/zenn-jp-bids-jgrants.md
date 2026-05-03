---
title: "JP Bids MCP × デジタル庁 Jグランツ MCP — 入札と補助金をひとつの会話で"
emoji: "🏛️"
type: "tech"
topics: ["mcp", "claude", "govtech", "公共調達", "補助金"]
published: false
---

<!-- 草稿 / Draft — 公開前にレビュー必須 -->

# JP Bids MCP × デジタル庁 Jグランツ MCP — 入札と補助金をひとつの会話で

## はじめに

日本の公的資金には2つの流れがある。

1. **官公需入札**：国や自治体が民間企業に仕事を発注する。中小企業庁の[官公需情報ポータルサイト（KKJ）](https://kkj.go.jp)に年間180万件超の公示が掲載される。
2. **補助金・助成金**：国や自治体が民間の取り組みを支援する。デジタル庁が運営する[Jグランツ](https://www.jgrants-portal.go.jp)に年間約1,000種類の補助金が掲載される。

この2つは従来、まったく別のシステムで管理されてきた。入札担当者は入札情報サービスを使い、補助金担当者は補助金ポータルを使う。情報が分断されているため、「補助金を原資に入札へ参加する」「落札案件と使える補助金を組み合わせる」といった複合的な意思決定は人間が手動で行うしかなかった。

それをMCPで解消しようというのが、この記事のテーマだ。

## 2つのMCPサーバー

### JP Bids MCP（入札）

[JP Bids MCP](https://github.com/sugukurukabe/koko-call-mcp)は、KKJ公開APIをModel Context Protocol（MCP）化したサーバーだ。スグクル株式会社が開発・運営する。

主な機能：

- `search_bids`：キーワード・地域・業種で入札案件を検索
- `rank_bids`：自社プロファイルに基づくAIスコアリング
- `extract_bid_requirements`：PDF仕様書から要件を構造化抽出
- `create_bid_review_packet`：社内検討メモの自動生成

MCP仕様 [2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) に準拠し、OAuth 2.0認証、Streamable HTTP、Resources、Resource Templates、Promptsを実装している。

### Jグランツ MCP（補助金）

[Jグランツ MCP](https://github.com/digital-go-jp/jgrants-mcp-server)は、デジタル庁が2025年10月に公開した公式リファレンス実装だ。JグランツAPIをFastMCP（Python）でラップし、MCP経由で補助金を自然言語検索できる。

主な機能：

- `search_subsidies`：キーワード・業種・地域・受付状態で補助金を検索
- `get_subsidy_detail`：添付ファイルを含む詳細取得
- `get_subsidy_overview`：締切・金額別の統計概要

[Jグランツ Open API 利用規約](https://www.jgrants-portal.go.jp/open-api)に準拠したMIT OSSであり、同サーバーを使った商用連携サービスもすでに登場している。

## なぜ「組み合わせ」が価値を生むか

MCPの設計思想は「サーバーを組み合わせてコンテキストを広げる」ことにある。JP Bids MCPとJグランツ MCPは**補完関係**にある：

| 観点 | JP Bids MCP（KKJ） | Jグランツ MCP |
|---|---|---|
| 主体 | 企業が政府の仕事を取りに行く | 企業が政府から支援を受ける |
| 性質 | 競争（他社が相手） | 審査（基準を満たすか） |
| 締切の性質 | 入札締切（絶対厳守） | 申請期間（受付期間あり） |
| 情報の粒度 | 案件単位（仕様書・落札者） | 補助金単位（上限額・対象者） |

この2軸をAIが同時に扱えるようになることで、「補助金の申請期限と入札の提出期限が重ならない組み合わせを探す」「補助金で原資を確保してから入札に挑む」という判断を会話ひとつで完結できる。

## デモ

### 設定

```bash
# 1. Jグランツ MCP をローカルで起動
git clone https://github.com/digital-go-jp/jgrants-mcp-server.git
cd jgrants-mcp-server && pip install -e .
python -m jgrants_mcp_server.core
# → http://127.0.0.1:8000/mcp

# 2. Cursor の設定ファイル（cursor.mcp.json）
```

```json
{
  "mcpServers": {
    "jp-bids": {
      "url": "https://mcp.bid-jp.com/mcp",
      "type": "streamable-http"
    },
    "jgrants": {
      "url": "http://127.0.0.1:8000/mcp",
      "type": "streamable-http"
    }
  }
}
```

### ワークフロー例 1：同時探索

プロンプト：

```
鹿児島県のITシステム調達案件を探して、同時に中小企業向けのDX補助金も調べてください。
スコアが高い入札案件と、現在申請受付中の補助金の一覧を合わせて教えてください。
```

LLMが実行する呼び出し：

1. `search_bids(query="システム", prefecture="鹿児島県", category="役務", limit=10)`
2. `rank_bids(bids=[...], company_profile={...})`
3. `search_subsidies(keyword="DX", target_number_of_employees="21-50人", acceptance=1)`

結果として得られるもの：
- スコア順の入札案件リスト（締切・金額・推奨理由付き）
- 申請受付中の補助金リスト（上限金額・対象者・締切付き）

### ワークフロー例 2：補助金で原資 → 入札

プロンプト：

```
IT補助金で原資を確保した上で、AIシステム開発の入札案件を絞り込んでください。
補助金の締切と入札の締切が重ならない組み合わせを提案してください。
```

LLMが実行する呼び出し：

1. `search_subsidies(keyword="AI システム", acceptance=1)`
2. `search_bids(query="AI システム開発")`
3. `rank_bids(bids=[...], company_profile={...})`
4. `create_bid_review_packet(bid_key="...", additional_notes="補助金: ものづくり補助金（締切2026-06-30）を申請予定")`

## デジタル庁OSSへの貢献

JP Bids MCP開発の過程でJグランツ MCPのコードを精読し、`get_subsidy_overview` の `accepting` カウントが常に0になるバグを発見した。

**問題の箇所**（`core.py` L266-L303）：

```python
stats = {
    "by_deadline_period": {
        "accepting": 0,      # ← 常に0のまま更新されない
        "this_month": 0,
        ...
    }
}

for subsidy in subsidies.get("subsidies", []):
    if subsidy.get("acceptance_end_datetime"):
        end_date = datetime.fromisoformat(...)
        days_left = (end_date - now).days
        if days_left <= 30:
            stats["by_deadline_period"]["this_month"] += 1
        elif days_left <= 60:
            stats["by_deadline_period"]["next_month"] += 1
        else:
            stats["by_deadline_period"]["after_next_month"] += 1
        # ↑ accepting は一度も加算されない
```

**修正**：`acceptance_start_datetime` と `acceptance_end_datetime` の両端チェックを追加する。

```python
if subsidy.get("acceptance_start_datetime") and subsidy.get("acceptance_end_datetime"):
    start_date = datetime.fromisoformat(
        subsidy["acceptance_start_datetime"].replace("Z", "+00:00")
    )
    if start_date <= now <= end_date:
        stats["by_deadline_period"]["accepting"] += 1
```

このバグ修正PRをデジタル庁のリポジトリに送った。OSSエコシステムへの貢献として、また「コードを読み込んでいる開発者」として存在を示す一手だ。

この修正を含む4本のPR（バグ修正、`stateless_http=True`対応、Dockerfile追加、pytestユニットテスト14件）をデジタル庁リポジトリに送信した。残りの改善候補（英語README、Completion実装）は[docs/contributions/jgrants-roadmap.md](../contributions/jgrants-roadmap.md)にロードマップを公開している。

## 今後の展望

MCPは「サーバーを組み合わせる」ことが前提の設計になっている。入札（KKJ）・補助金（Jグランツ）を皮切りに、次のような「日本の公的データMCPエコシステム」が形成される素地がある：

- **調達実績分析**：過去落札データと補助金交付実績のクロス分析
- **入札 + 資格管理**：入札資格の申請管理MCPとの連携
- **税務 + 公共契約**：freee MCPと入札情報の統合会計フロー

これは一社が作り切るものではない。JP Bids MCPはそのコンポーネントの一つとして、互換性を最優先にMCP仕様書に忠実な実装を続ける。

---

## まとめ

- JP Bids MCP（入札）× Jグランツ MCP（補助金）は補完的なMCPサーバーとして機能する
- 3つのエンドツーエンドワークフローと動作する設定ファイルを公開した
- Jグランツ MCPへ4本のPR（バグ修正・Cloud Run対応・Dockerfile・ユニットテスト14件）をデジタル庁リポジトリに送信した
- 残り2本の貢献候補をロードマップとして公開している

---

*JP Bids MCP は[スグクル株式会社](https://sugukuru.co.jp)が開発。Jグランツ MCPはデジタル庁の公式OSS。それぞれ独立した運営であり、結果は参考情報です。*
