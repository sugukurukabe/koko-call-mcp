# ADR-0020: Smart Router の LLM フォールバック（opt-in）
# ADR-0020: LLM Fallback for Smart Router (opt-in)
# ADR-0020: Fallback LLM untuk Smart Router (opt-in)

## Status / Status / Status

Accepted / Accepted / Diterima

## Context / 背景 / Konteks

ADR-0016 の Smart Router はキーワードスコアリング（v0.1）で子 MCP へのルーティングを行う。
これは高速・ゼロコスト・予測可能だが、以下のケースで `null`（ルーティング不能）を返す:

- 日英インドネシア語以外の言語でのクエリ
- キーワードリストに含まれていないドメイン用語（業界固有の言い回し等）
- 複数サーバーにまたがる複合クエリ（スコアが完全に 0 になるケース）

Gateway が 4 本以上の子 MCP を集約するにつれて「初めて見る言い回し」が増える。
ルールベース単独では捕捉しきれないクエリに対して LLM フォールバックが有効になる。

---

The ADR-0016 Smart Router uses keyword scoring (v0.1) to route to child MCPs.
This is fast, zero-cost, and predictable, but returns `null` (unroutable) in the following cases:

- Queries in languages other than Japanese/English/Indonesian
- Domain terms not in the keyword list (industry-specific phrasing, etc.)
- Compound queries spanning multiple servers (where total score becomes 0)

As the Gateway aggregates 4+ child MCPs, "novel phrasings" increase.
LLM fallback becomes effective for queries that rule-based routing cannot capture.

---

Router Smart ADR-0016 menggunakan penilaian kata kunci (v0.1) untuk merutekan ke MCP anak.
Ini cepat, tanpa biaya, dan dapat diprediksi, tetapi mengembalikan `null` (tidak dapat dirutekan) dalam kasus berikut:

- Kueri dalam bahasa selain Jepang/Inggris/Indonesia
- Istilah domain yang tidak ada dalam daftar kata kunci (frasa spesifik industri, dll.)
- Kueri majemuk yang mencakup beberapa server (di mana total skor menjadi 0)

Saat Gateway mengagregasi 4+ MCP anak, "frasa baru" meningkat.
Fallback LLM menjadi efektif untuk kueri yang tidak dapat ditangkap oleh perutean berbasis aturan.

## Decision / 決定 / Keputusan

**`GATEWAY_ROUTER_LLM_FALLBACK=true` のときだけ、スコアが 0 の場合に Anthropic Claude Haiku に問い合わせる LLM フォールバックを有効化する。デフォルトは OFF。**

**Enable LLM fallback that queries Anthropic Claude Haiku only when score is 0, and only when `GATEWAY_ROUTER_LLM_FALLBACK=true`. Default is OFF.**

**Aktifkan fallback LLM yang menanyakan Anthropic Claude Haiku hanya saat skor 0, dan hanya ketika `GATEWAY_ROUTER_LLM_FALLBACK=true`. Default adalah MATI.**

### ルール / Rules / Aturan

1. **ルールベース優先**: キーワードスコアが 1 以上なら LLM は呼ばない
2. **opt-in**: `GATEWAY_ROUTER_LLM_FALLBACK=true` がない限り完全に無効
3. **キャッシュ必須**: クエリの SHA-256 を key に TTL 1h でキャッシュ（同じクエリで LLM を叩かない）
4. **フォールバック**: LLM がエラーまたは未知の server_id を返したら `null`（ルーティング不能）として扱う
5. **モデル**: `claude-haiku-4-5`（最速・最安価な Anthropic モデル）

1. **Rule-based priority**: If keyword score ≥ 1, LLM is not called
2. **Opt-in**: Completely disabled without `GATEWAY_ROUTER_LLM_FALLBACK=true`
3. **Cache required**: Cache with query SHA-256 as key, TTL 1h (don't hit LLM for same query)
4. **Fallback**: If LLM errors or returns unknown server_id, treat as `null` (unroutable)
5. **Model**: `claude-haiku-4-5` (fastest and cheapest Anthropic model)

## Rationale / 理由 / Alasan

### なぜルールベース優先か / Why rule-based priority / Mengapa prioritas berbasis aturan

コスト・レイテンシ・予測可能性のすべてでルールベースが優れている。
LLM は「ルールベースが失敗したときの最後の手段」として機能する。
ルールベースの keyword を充実させることが LLM 呼び出し削減に直結する（経済的インセンティブが設計と一致）。

Rule-based routing is superior in cost, latency, and predictability.
LLM functions as a "last resort when rule-based routing fails."
Enriching rule-based keywords directly reduces LLM calls (economic incentives align with design goals).

### なぜ opt-in か / Why opt-in / Mengapa opt-in

- Anthropic API の障害が Gateway 全体のルーティング障害に直結するリスクを排除
- 開発者が意図せずコストが発生することを防ぐ
- Staging / Prod でのコスト管理を env var で切り替え可能にする

- Eliminates risk that Anthropic API outages directly cause Gateway-wide routing failures
- Prevents unexpected costs for developers
- Allows cost management in Staging/Prod to be toggled via env var

### なぜ claude-haiku-4-5 か / Why claude-haiku-4-5 / Mengapa claude-haiku-4-5

- 応答トークンが 32 以下（server_id 文字列のみ）でコストがほぼゼロ
- ルーティング用途はタスクが単純なため高精度モデルは不要
- Haiku は Anthropic の最安価モデルファミリー（2026 年 5 月時点）

- Response tokens ≤ 32 (server_id string only), cost nearly zero
- Routing tasks are simple enough that high-accuracy models are unnecessary
- Haiku is the cheapest Anthropic model family (as of May 2026)

### なぜ TTL 1h キャッシュか / Why 1h cache TTL / Mengapa cache TTL 1 jam

- 同じクエリに対して毎回 LLM を呼ぶのはコスト・レイテンシともに無駄
- 1 時間以内に registry が変わることは通常ない（子 MCP 追加はデプロイが必要）
- 既存の `tool-cache.ts` を流用し、新たなインフラ不要

- Calling LLM for every same query is wasteful in cost and latency
- Registry rarely changes within 1 hour (adding child MCPs requires deployment)
- Reuses existing `tool-cache.ts`, no new infrastructure required

## Implementation / 実装 / Implementasi

```
gateway/src/router/
├── smart-router.ts     ← route() を async 化、score=0 のとき routeViaLlm() を呼ぶ
└── llm-fallback.ts     ← routeViaLlm(): fetch Anthropic API + cache

環境変数 / Environment variables / Variabel lingkungan:
  GATEWAY_ROUTER_LLM_FALLBACK=true   ← 有効化スイッチ
  ANTHROPIC_API_KEY=<key>             ← Anthropic API キー
```

## Consequences / 影響 / Konsekuensi

**良い影響 / Positive / Positif:**

- 英日インドネシア語以外のクエリや業界固有用語でもルーティングできる可能性が上がる
- opt-in なので既存の動作に影響しない
- キャッシュにより LLM 呼び出し頻度を最小化できる

**悪い影響 / Negative / Negatif:**

- `route()` が `async` になったため、呼び出し側すべてを `await` に変更する必要があった
- Anthropic API への外部依存が増える（opt-in なので本番で OFF なら無影響）
- キャッシュ TTL 内に registry が変わると古いルーティング結果を返す可能性がある
  - 対策: Cloud Run デプロイ時に `resetRegistryCache()` が走るため、gateway 再起動でキャッシュもリセットされる

## Related ADRs / 関連 ADR / ADR Terkait

- ADR-0016: Federation Hub 設計 — Smart Router の基本要件
- ADR-0018: Cache Strategy — TTL キャッシュポリシー（LLM 結果にも同じ原則を適用）
- ADR-0019: Approval and Compliance Policy — 書込み系ツールの二重ロック

## References / 参考 / Referensi

- [gateway/src/router/smart-router.ts](../../gateway/src/router/smart-router.ts)
- [gateway/src/router/llm-fallback.ts](../../gateway/src/router/llm-fallback.ts)
- [Anthropic claude-haiku-4-5](https://docs.anthropic.com/en/docs/about-claude/models)
- [agentgateway Smart Router](https://agentgateway.dev) — ルールベース + LLM ハイブリッドの業界パターン
