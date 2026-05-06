# ADR-0017 Dynamic Tool Surface（Mode-based Tool Filtering）

## ステータス / Status / Status

Accepted — 2026-05-07

## 文脈 / Context / Konteks

freee MCP 単体で約270のツールが存在する。Jグランツ、JP Bids と合計すると Gateway 経由で LLM に露出されるツール数は300以上になりうる。ツールリストが大きいほどコンテキストウィンドウを圧迫し、LLMの推論精度が低下する（特に function-calling モデルは100ツール超で誤選択が増える）。

freee MCP alone exposes ~270 tools. Combined with J-Grants and JP Bids, the Gateway could expose 300+ tools to the LLM. Large tool surfaces consume context window, degrade reasoning accuracy, and increase misrouting — especially in multi-agent setups where each agent should have a focused role.

freee MCP saja memiliki sekitar 270 alat. Gabungan dengan J-Grants dan JP Bids, Gateway bisa mengekspos 300+ alat ke LLM. Daftar alat yang besar mengonsumsi konteks jendela dan menurunkan akurasi penalaran.

## 決定 / Decision / Keputusan

`registry.json` の各サーバー定義に `tool_modes` フィールドを追加し、**Agent の目的（Mode）に応じて露出するツールを動的に絞り込む**。

Add a `tool_modes` field to each server definition in `registry.json` and **dynamically filter exposed tools based on the agent's declared purpose (Mode)**.

Tambahkan field `tool_modes` ke setiap definisi server di `registry.json` dan **filter alat yang diekspos secara dinamis berdasarkan tujuan agen (Mode)**.

### Mode 定義 / Mode Definitions / Definisi Mode

| Mode ID | 日本語 | 用途 | 典型エージェント |
|---|---|---|---|
| `bid_search` | 入札検索モード | 入札案件の探索・絞り込み | 「高勝率案件を探す」エージェント |
| `subsidy_search` | 補助金検索モード | 補助金・助成金のマッチング | 「案件に使える補助金を探す」エージェント |
| `financial_check` | 財務確認モード | 残高・CF・売掛の確認 | 「受注できる財務状況か検証する」エージェント |
| `full_orchestration` | フルオーケストレーション | 全許可ツールへのアクセス | 統合オーケストレーター（Grok 16-agent など） |

### スキーマ変更 / Schema Change / Perubahan Skema

```typescript
// registry/schema.ts に追加 / Added to registry/schema.ts
const ToolModeMapSchema = z.object({
  bid_search: z.array(z.string()),
  subsidy_search: z.array(z.string()),
  financial_check: z.array(z.string()),
  full_orchestration: z.array(z.string()), // 空配列 = allowlist に委譲
}).partial();
```

各 Mode のツールリストが**空配列**の場合は `tool_allowlist` に従う（= 全許可またはallowlist通り）。

### フィルタリングの優先順位 / Filter Priority / Prioritas Filter

```
tool_modes[mode] → tool_allowlist → (全ツール許可)
```

1. Mode が指定され、そのサーバーに `tool_modes[mode]` が定義されている → Mode のリストで絞り込む
2. `tool_allowlist` が空でない → allowlist で絞り込む
3. どちらも空 → 全ツール許可

### Mode の伝達方法 / How Mode is Passed / Cara Meneruskan Mode

Mode はツール呼び出し引数として渡す（MCP セッション開始時に宣言）。

```
search_public_opportunities(keyword: "農業", mode: "bid_search")
list_connected_servers(mode: "financial_check")
call_registered_mcp(server_id: "freee", tool_name: "get_deals", mode: "financial_check")
```

将来的には `X-Gateway-Mode: bid_search` HTTPヘッダーでセッション全体に適用可能にする（v0.2で実装）。

### Multi-agent 活用パターン / Multi-agent Pattern / Pola Multi-agent

Grok の16エージェントモードを例に取ると、単一の Gateway エンドポイントに対して各エージェントが異なる Mode で接続することで、コンテキスト汚染なしに役割分担できる：

```
Agent 1: mode=bid_search        → JP Bids の入札検索ツールのみ見える
Agent 2: mode=subsidy_search    → Jグランツの補助金ツールのみ見える
Agent 3: mode=financial_check   → freee の残高・CF ツールのみ見える
Orchestrator: mode=full_orchestration → 全ツールを統合して最終判断
```

## 結果 / Consequences / Konsekuensi

### メリット / Benefits / Manfaat

- LLM に渡るツール数が削減され、推論精度が向上する。
- Multi-agent オーケストレーション（Grok 16-agent 等）との親和性が高い。
- 新しいサーバー追加時も `tool_modes` を設定するだけで自動適用される。
- freee の270ツール問題が解消される。

### トレードオフ / Trade-offs / Kompromi

- Registry 設定が複雑になる（`tool_modes` を適切に設定する運用コスト）。
- `full_orchestration` モードは引き続き全ツール露出のため、オーケストレーターには強いモデルが必要。
- Mode の追加・変更は registry 更新 → デプロイが必要（v0.2 で動的更新を検討）。

## 参照 / References / Referensi

- [Grok API Multimodal/Multi-agent best practices](https://x.ai/api)
- ADR-0016: Public MCP Federation Hub
- `gateway/src/filter/tool-filter.ts`（実装 / implementation / implementasi）
