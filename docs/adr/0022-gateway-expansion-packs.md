# ADR-0022: Gateway 拡張パック — child MCP の段階投入と mode の一般化
# ADR-0022: Gateway Expansion Packs — Phased Child MCP Onboarding and Mode Generalization
# ADR-0022: Paket Perluasan Gateway — Penambahan MCP Anak Bertahap dan Generalisasi Mode

## Status / Status / Status

Accepted / Accepted / Diterima

## Context / 背景 / Konteks

**日本語**

Public MCP JP Gateway（ADR-0016）は現在 6 本の公開 child MCP を束ねている: JP Bids、J-Grants、AgriOps、法人番号、freee、MoneyForward。GMO銀行系APIは公開 Gateway では提供せず、利用許諾とAPI取得が完了した後の private connector として扱う。しかし Gateway の価値は child MCP の数ではなく「業務の流れが完成する組み合わせ」で決まる。

入札→補助金→法人確認→会計の流れは作れたが、次の問いに答えられない:

- 「この自治体の農業構造はどうなっているか」（AgriOps により Phase 1 で対応開始）
- 「取引先や発注機関の法人情報を確認したい」（法人確認）
- 「この地域の人口・産業・就業者データは」（地域統計）
- 「関連する法令の一次情報を確認したい」（法令参照）
- 「特定技能スタッフの配置可否や在留期限は」（人材コンプライアンス）

これらを段階的に child MCP として接続し、Gateway を「日本の中小企業向け AI 業務基盤」に進化させる。

同時に、現在の `GatewayMode` は 4 つの固定 enum（`bid_search` / `subsidy_search` / `financial_check` / `full_orchestration`）であり、新しいドメインを追加するたびに enum とハードコード分岐を増やす設計になっている。mode を一般化する必要がある。

**English**

The Public MCP JP Gateway (ADR-0016) currently bundles 6 public child MCPs: JP Bids, J-Grants, AgriOps, Corporate Number, freee, and MoneyForward. GMO banking APIs are not exposed in the public Gateway and are treated as a future private connector after permission and API access are obtained. However, the Gateway's value comes from composable business workflows, not from the number of child MCPs.

The bid-to-subsidy-to-corporate-identity-to-accounting flow works, but cannot yet answer questions about broader agricultural context, regional statistics, legal references, or SSW/visa compliance.

Additionally, the current `GatewayMode` is a fixed 4-value enum (`bid_search` / `subsidy_search` / `financial_check` / `full_orchestration`), requiring enum extension and hardcoded branching for each new domain. Mode handling must be generalized.

**Bahasa Indonesia**

Public MCP JP Gateway (ADR-0016) saat ini menggabungkan 6 MCP anak publik: JP Bids, J-Grants, AgriOps, Nomor Korporasi, freee, dan MoneyForward. API perbankan GMO tidak diekspos di Gateway publik dan diperlakukan sebagai konektor privat masa depan setelah izin dan akses API diperoleh. Namun, nilai Gateway ditentukan oleh alur kerja bisnis yang dapat disusun, bukan jumlah MCP anak.

Selain itu, `GatewayMode` saat ini adalah enum tetap 4-nilai, memerlukan perluasan enum dan percabangan hardcoded untuk setiap domain baru. Penanganan mode harus digeneralisasi.

## Decision / 決定 / Keputusan

### 1. 段階投入する child MCP と優先順位

| Phase | child MCP | risk_level | 主な価値 |
|-------|-----------|------------|----------|
| 1 | AgriOps（`@sugukuru/agriops-mcp`） | `read_only` | 農業・自治体・地域文脈（registry 追加済み） |
| 2 | 法人番号 MCP | `read_only` | 法人実在確認・取引先照合 |
| 3 | e-Stat / RESAS MCP | `read_only` | 人口・産業・就業・地域経済 |
| 4 | e-Gov 法令検索 MCP | `read_only` | 法令・行政手続の一次情報参照 |
| 5 | SSW / Visa MCP | `read_only`（初期） | 在留期限・届出・配置可否 |

Phase 1-4 は `read_only` で開始する。Phase 5 の SSW/Visa は初期は read-only の rule/reference 系に限定し、OCR・申請書生成・外部提出は `read_write` + `required_approval` として後段に分ける。

### 2. mode の一般化

現在のハードコード enum を、registry-driven の動的 mode に移行する。

**変更前:**

```typescript
export const GatewayModeSchema = z.enum([
  "bid_search", "subsidy_search", "financial_check", "full_orchestration",
]);
```

**変更後:**

```typescript
export const GatewayModeSchema = z.string().min(1);
```

`tool_modes` も `z.record(z.string(), z.array(z.string()))` に変更する。`full_orchestration` は予約済み mode として扱い、全サーバーを表示する特別扱いを維持する。

`tool-filter.ts` のハードコード分岐（`server.id !== "jp-bids"` など）は、`tool_modes[mode]` が空配列かどうかで一般的に判定する形に書き換える。

### 3. Vertical Bundle の定義

Bundle は marketing / UX 概念であり、runtime には影響しない。

| Bundle | 含む child MCP | 想定ユーザー |
|--------|---------------|-------------|
| Public Sales Pack | JP Bids + J-Grants + 法人番号 | 入札・補助金を探す企業 |
| Agri Expansion Pack | AgriOps + e-Stat + JP Bids + J-Grants | 農業法人・自治体・派遣会社 |
| Finance Pack | freee + MoneyForward + 法人番号 | 経理・財務担当者 |
| Compliance Pack | SSW/Visa + e-Gov + audit log | 行政書士・登録支援機関 |

## Rationale / 理由 / Alasan

### read_only から始める安全性

新しい child MCP は `read_only` から始める。cache が効き、audit log の複雑性が低く、approval token が不要で、policy engine への影響が最小限になる。write/action 系は需要と安全性が確認されてから Phase 2 以降で追加する。

### mode の一般化が必要な理由

固定 enum のままだと、child MCP を 1 本追加するたびに schema.ts の enum、tool-filter.ts の分岐、全テストの mode fixture を更新する必要がある。registry.json の `tool_modes` キーで mode を定義し、コード側は `tool_modes[mode]` の有無だけで判定する形にすれば、child MCP 追加時のコード変更がゼロに近づく。

### Bundle は runtime ではなく UX 概念

Bundle を Gateway の runtime に組み込むと、mode × bundle × tier の組み合わせ爆発が起きる。Bundle は記事・ドキュメント・営業資料での表現に留め、runtime は mode + registry で制御する。

## Consequences / 影響 / Konsekuensi

**良い影響:**

- child MCP 追加時に schema.ts と tool-filter.ts のコード変更が不要になる
- 新ドメイン（農業・法人・統計・法令・ビザ）を安全に段階投入できる
- Bundle は marketing 概念なので、runtime の複雑性を増やさない
- Phase 1（AgriOps）は既存パッケージがあるため registry に追加済み

**悪い影響:**

- mode を文字列にすると型安全性が下がる。`full_orchestration` の特別扱いは維持する必要がある
- 既存の `tool-filter.ts` テストを mode 一般化に合わせて書き換える必要がある
- Phase 2 以降の新 child MCP は、それぞれの MCP サーバーが実在・稼働していることが前提

## Related ADRs / 関連 ADR / ADR Terkait

- ADR-0016: Public MCP Federation Hub（Extensibility-First 原則）
- ADR-0017: Dynamic Tool Surface（mode の原型設計）
- ADR-0018: Cache Strategy（read_only child は cache 対象）
- ADR-0019: Approval and Compliance Policy（write/action 系の二重ロック）
- ADR-0020: LLM Router Fallback（routing_keywords の重要性）
- ADR-0021: MoneyForward 会計 MCP 連携

## References / 参考 / Referensi

- AgriOps MCP: `@sugukuru/agriops-mcp` v1.10.3（npm 公開済み）
- 国税庁法人番号公表サイト Web-API: https://www.houjin-bangou.nta.go.jp/webapi/
- e-Stat API: https://www.e-stat.go.jp/api/
- RESAS API: https://opendata.resas-portal.go.jp/
- e-Gov 法令 API: https://elaws.e-gov.go.jp/apitop/
- Gateway 実現可能性メモ: [docs/public-mcp-hub/feasibility.md](../public-mcp-hub/feasibility.md)
