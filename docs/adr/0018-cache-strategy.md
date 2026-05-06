# ADR-0018 Cache Strategy

## ステータス / Status / Status

Accepted — 2026-05-07

## 文脈 / Context / Konteks

Gateway は各ツール呼び出しを子 MCP サーバーにプロキシする。入札公告・補助金情報は更新頻度が低いにもかかわらず、同一クエリが複数エージェントから繰り返し発行されることがある（特に Grok 16-agent のような multi-agent 構成では同一データを並列に参照する）。このとき無制限にプロキシすると：

- KKJ API のレートリミット（官公需ポータルは過度なアクセスを明示的に禁止している）に抵触するリスクがある。
- API コストとレイテンシが無駄に増加する。
- キャッシュが長すぎると古い文脈を LLM に渡すリスクがある。

Gateway proxies every tool call to child MCP servers. Public bid/subsidy data has low update frequency, yet identical queries may be issued by multiple agents in parallel (e.g. Grok 16-agent). Unlimited proxying risks hitting KKJ rate limits, increases API cost, and raises latency. However, caching too aggressively causes stale context for LLMs.

Gateway meneruskan setiap panggilan alat ke server MCP anak. Data tender/subsidi memiliki frekuensi pembaruan rendah, namun query identik dapat dikeluarkan oleh beberapa agen secara paralel. Proxy tanpa batas berisiko melanggar batas laju API dan meningkatkan latensi.

## 決定 / Decision / Keputusan

**読み取り専用かつべき等なツール呼び出しにのみ TTL キャッシュを適用する**。財務データ（freee）はキャッシュ対象外とする。

**Apply TTL cache only to read-only and idempotent tool calls.** Financial data (freee) is never cached.

**Terapkan cache TTL hanya pada panggilan alat yang read-only dan idempotent.** Data keuangan (freee) tidak pernah di-cache.

### キャッシュ可否ポリシー / Cacheability Policy / Kebijakan Cacheability

ポリシーエンジンが各サーバーの `risk_level` と MCP ツールの `annotations` を参照して判定する：

| 条件 | キャッシュ | 理由 |
|---|---|---|
| `risk_level === "financial"` | **禁止** | freee 残高・取引は即時性が必要 |
| `readOnlyHint: false` | **禁止** | 副作用のあるツールはキャッシュ不可 |
| `idempotentHint: false` | **禁止** | 非べき等ツール（検索の乱数性など）は不可 |
| 上記いずれにも該当しない | **許可** | TTL 内はキャッシュから返す |

### TTL 設定 / TTL Configuration / Konfigurasi TTL

データの更新頻度に応じてサーバー別 TTL を設定する：

| サーバー ID | デフォルト TTL | 根拠 |
|---|---|---|
| `jp-bids` | **60秒** | 入札公告は毎日更新されるが、リアルタイム性は不要 |
| `jgrants` | **300秒（5分）** | 補助金情報は週次程度の更新 |
| `freee` | **キャッシュ禁止** | 残高・取引は即時性が必要 |

TTL は `registry.json` の `cache_ttl_seconds` フィールドで上書き可能とする。

### キャッシュキーの設計 / Cache Key Design / Desain Cache Key

```
{server_id}:{tool_name}:{SHA256(sorted_JSON(arguments))}
```

- `server_id` + `tool_name`: ツールの同一性を保証
- `SHA256(sorted_JSON(arguments))`: 引数の完全一致を保証（引数順序に依存しない）
- Actor（ユーザー）はキャッシュキーに**含めない**: 公開データは全アクターで共有可能

### キャッシュの実装 / Implementation / Implementasi

メモリ内 TTL キャッシュ（`Map<string, CacheEntry>`）を使用する。

- **LRU は採用しない**: Cloud Run は stateless + 短命のインスタンスのため、LRU の恩恵が少ない。TTL のみで十分。
- **最大エントリ数**: 1,000件（超過した場合は古いものから削除）
- **永続化しない**: インスタンスリスタート時はキャッシュクリア。これは意図した動作（古いデータを引き継がない）。
- **v1 以降**: Redis/Memorystore への移行を検討（インスタンス間でキャッシュ共有が必要になった場合）。

### キャッシュのバイパス / Cache Bypass / Bypass Cache

以下の条件でキャッシュをバイパスする：

1. `Cache-Control: no-cache` リクエストヘッダーが付いている場合
2. `mode === "full_orchestration"` でかつ `force_fresh: true` が渡された場合（v0.2 で実装）

## 結果 / Consequences / Konsekuensi

### メリット / Benefits / Manfaat

- KKJ API への過度なアクセスを防ぎ、利用規約への準拠を担保する。
- Multi-agent 構成（16エージェントが同一クエリを並列発行）でのコスト削減。
- レイテンシ改善（特に並列検索の `search_public_opportunities` ツール）。
- 財務データのキャッシュ禁止により、freee の残高・取引の即時性を保証。

### トレードオフ / Trade-offs / Kompromi

- TTL 内は古いデータを返す可能性がある（許容済み: 入札・補助金は短期間で大きく変わらない）。
- メモリ使用量が増加する（上限1,000件は約1MB以下の想定）。
- キャッシュミスの場合はレイテンシは変わらない。

## 参照 / References / Referensi

- ADR-0016: Public MCP Federation Hub
- ADR-0017: Dynamic Tool Surface
- `gateway/src/cache/tool-cache.ts`（実装 / implementation / implementasi）
- 官公需ポータル利用規約（過度なアクセスの禁止）
