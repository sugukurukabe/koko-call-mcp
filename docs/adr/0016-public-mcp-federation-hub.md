# ADR-0016: Public MCP Federation Hub を JP Bids MCP とは別サービスとして作る
# ADR-0016: Build the Public MCP Federation Hub as a Separate Service from JP Bids MCP
# ADR-0016: Membangun Public MCP Federation Hub sebagai Layanan Terpisah dari JP Bids MCP

## Status / Status / Status

Accepted / Accepted / Diterima

## Context / 背景 / Konteks

JP Bids MCP（v0.7.2）は官公需情報ポータルサイト KKJ に特化した読み取り専用 MCP サーバーである。
ADR-0012 でスコープを KKJ 入札検索に絞る判断を行った。

ここで JP Bids MCP を核に、Jグランツ（補助金）・freee（会計）等の複数 MCP サーバーを
1回の接続で利用できる「Federation Hub / Gateway」を構築する需要が生まれた。

Hub を JP Bids MCP リポジトリ内に追加するか、独立したサービスとして構築するかを決定する必要がある。

---

JP Bids MCP (v0.7.2) is a read-only MCP server specialized for the KKJ public procurement portal.
ADR-0012 decided to keep the scope focused on KKJ bid search.

A demand has now emerged to build a "Federation Hub / Gateway" that connects JP Bids, J-Grants (subsidies),
and freee (accounting) so they can all be used in a single MCP connection.

A decision is needed on whether to add the Hub inside the JP Bids MCP repository or as an independent service.

---

JP Bids MCP (v0.7.2) adalah server MCP read-only yang berspesialisasi untuk portal pengadaan publik KKJ.
ADR-0012 memutuskan untuk menjaga cakupan terfokus pada pencarian tender KKJ.

Kini muncul kebutuhan untuk membangun "Federation Hub / Gateway" yang menghubungkan JP Bids, J-Grants (subsidi),
dan freee (akuntansi) agar semuanya dapat digunakan dalam satu koneksi MCP.

Keputusan diperlukan apakah menambahkan Hub di dalam repositori JP Bids MCP atau sebagai layanan independen.

## Decision / 決定 / Keputusan

**Hub は JP Bids MCP とは別のサービス（別ディレクトリ・別パッケージ）として構築する。**

**Build the Hub as a separate service (separate directory and package) from JP Bids MCP.**

**Bangun Hub sebagai layanan terpisah (direktori dan paket terpisah) dari JP Bids MCP.**

具体的には:

- リポジトリ内の `gateway/` ディレクトリを新しい TypeScript パッケージとして作成する。
- npm パッケージ名は `@sugukuru-labs/public-mcp-jp-gateway` とする。
- Cloud Run サービス名は `public-mcp-jp-gateway` とし、`mcp.bid-jp.com` とは別のエンドポイントで動かす。
- JP Bids MCP 本体の `src/` 以下に Hub 固有の変更を加えない。
- 子 MCP（JP Bids・Jグランツ・freee）は Gateway から HTTP クライアントとして呼び出す。JP Bids MCP の TypeScript 型や KkjClient を直接インポートしてよいが、JP Bids の MCP primitives を Gateway の primitives とは混在させない。

Specifically:

- Create a new TypeScript package at `gateway/` directory within this repository.
- npm package name: `@sugukuru-labs/public-mcp-jp-gateway`.
- Cloud Run service name: `public-mcp-jp-gateway`, served from a different endpoint than `mcp.bid-jp.com`.
- Do not add Hub-specific changes to `src/` of JP Bids MCP.
- Child MCPs (JP Bids, J-Grants, freee) are called from the Gateway as HTTP clients. TypeScript types and KkjClient from JP Bids MCP may be imported, but JP Bids MCP primitives must not be mixed with Gateway primitives.

## Rationale / 理由 / Alasan

### JP Bids MCP 本体を汚染しない / Keeps JP Bids MCP clean / Menjaga JP Bids MCP tetap bersih

JP Bids MCP は KKJ APIに特化した単一責任サーバーである。ADR-0012 で確定したスコープを壊さない。
Gateway の認証・routing・proxy ロジックが JP Bids の tool surface と混在すると、
MCP Inspector や Anthropic ディレクトリの掲載審査に影響する可能性がある。

### リスクプロファイルが異なる / Different risk profiles / Profil risiko berbeda

JP Bids MCP はゼロトラスト・読み取り専用・出典強制の設計である。
Gateway は子 MCP への書き込み（freee会計エントリー等）や OAuth token 委任を将来扱う可能性があり、
リスクレベルが異なる。ランタイムを分けることで本番障害の影響範囲を限定できる。

### スケールが独立している / Independent scaling / Penskalaan independen

入札検索（JP Bids）と Gateway Orchestration は異なる負荷特性を持つ。
Cloud Run の revision を独立させることで、Gateway だけスケールアップするか、
JP Bids だけ rollback するかを選べる。

### SaaS 判断をリポジトリ構造に反映する / Reflects SaaS decision boundary / Mencerminkan batas keputusan SaaS

Hub の Go/No-Go 判断（docs/public-mcp-hub/feasibility.md 参照）は Private Beta 後に下す。
仮に No-Go になった場合も、JP Bids MCP リポジトリ本体への影響はゼロである。
`gateway/` ディレクトリを削除するだけで済む。

## Architecture Decision / アーキテクチャ決定 / Keputusan Arsitektur

```
Koko-call-mcp/           ← この JP Bids MCP リポジトリ
├── src/                  ← JP Bids MCP 本体（変更しない）
├── gateway/              ← 新規 TypeScript パッケージ（本 ADR の対象）
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── server.ts         ← Gateway HTTP エントリポイント
│   │   ├── mcp.ts            ← createGatewayServer() factory
│   │   ├── registry/         ← 子 MCP registry 定義
│   │   ├── router/           ← Smart Router（ルールベース）
│   │   ├── policy/           ← Policy Engine（allowlist/denylist）
│   │   ├── audit/            ← 監査ログ（request id/actor/decision のみ保存）
│   │   ├── proxy/            ← 子 MCP への HTTP Proxy 呼び出し
│   │   ├── tools/            ← Gateway MCP tools（少数）
│   │   └── lib/              ← env, errors, auth（JWT/APIキー）
│   └── Dockerfile
└── docs/
    ├── adr/0016-*.md         ← 本ファイル
    └── public-mcp-hub/       ← Hub 固有のドキュメント
```

## Consequences / 影響 / Konsekuensi

**良い影響 / Positive / Positif:**

- JP Bids MCP の品質・ADR・ドキュメントを汚染しない
- Gateway が失敗しても JP Bids MCP に影響しない
- リスクレベル・スケール設計・デプロイサイクルが独立する
- 将来 Gateway を別リポジトリへ切り出すことが容易

**悪い影響 / Negative / Negatif:**

- `gateway/` と `src/` の間でコードの重複が発生する可能性がある（auth, env, logging）
  - 対策: 共通ロジックは `src/lib/` からのインポートを許可し、3本目のパッケージが出るまで抽出しない
- CI/CD パイプラインを `gateway/` 向けに追加する必要がある
  - 対策: 既存の GitHub Actions を `if: startsWith(github.event.inputs.service, 'gateway')` で分岐させる

## Extensibility-First Design / 拡張性ファースト設計 / Desain Extensibility-First

**原則: 子 MCP の追加はコード変更ゼロで済むように設計する。**

**Principle: Adding a child MCP requires zero code changes.**

**Prinsip: Menambahkan MCP anak tidak memerlukan perubahan kode sama sekali.**

### 追加手順（2 ステップ）/ Add steps (2 steps) / Langkah penambahan (2 langkah)

```
1. gateway/config/registry.json に 1 エントリ追加
   Add 1 entry to gateway/config/registry.json

2. Cloud Run 環境変数に GATEWAY_CHILD_ENDPOINT_<ID> を追加
   Add GATEWAY_CHILD_ENDPOINT_<ID> to Cloud Run environment variables
```

**「コード変更が必要な場合は設計を疑え」**
If you need to change code to add a new child MCP, question the design first.

### 実証: MoneyForward の追加 / Proof: Adding MoneyForward / Bukti: Menambahkan MoneyForward

```json
// registry.json に 1 エントリ追加するだけで以下が自動的に動作する:
// Adding 1 entry to registry.json automatically enables:
{
  "id": "moneyforward-ca",
  "risk_level": "financial",
  "tool_allowlist": ["get_trial_balance", "create_journal_entry", ...],
  "tool_modes": { "financial_check": [...], "full_orchestration": [...] },
  "tool_policies": { "create_journal_entry": { "required_approval": true } },
  "routing_keywords": ["仕訳", "試算表", ...]
}
```

自動的に動作するもの / Auto-enabled capabilities:
- `list_connected_servers` での表示（mode フィルタリング含む）
- Policy Engine での risk_level / tier 判定
- Smart Router でのキーワードスコアリング
- risk_level に応じた cache 禁止または TTL 適用
- Approval Token フロー（`required_approval: true` が設定されたツール）

GMO銀行系APIは、現時点の公開 Gateway では提供しない。利用許諾とAPI取得が完了した後、社内利用または契約範囲内の private connector として追加する。
GMO banking APIs are not exposed in the public Gateway. They are planned as a future private connector after permission and API access are obtained.

### 将来の拡張候補 / Future expansion candidates / Kandidat perluasan masa depan

registry.json に 1 エントリ追加するだけで以下を将来追加できる:

| id | 用途 |
|----|------|
| `smarthr` | SmartHR（HR 管理） |
| `moneyforward` | MoneyForward（会計） |
| `gbizid` | gBizID（法人認証） |
| `mynumber` | マイナンバー連携 |
| `tokutei-gino` | 特定技能ビザ管理（Sugukuru 固有） |

---

## Related ADRs / 関連 ADR / ADR Terkait

- ADR-0002: Transport 選択（Streamable HTTP）— Gateway も同じ transport を使う
- ADR-0005: 認証方針（OAuth 2.0）— Gateway の OAuth は JP Bids と同じパターンを踏襲
- ADR-0012: Roadmap Boundaries — JP Bids MCP のスコープを KKJ に固定する決定（本 ADR の前提）
- ADR-0017: Dynamic Tool Surface — mode ベースの tool 絞り込み
- ADR-0018: Cache Strategy — 子 MCP 結果の TTL キャッシュ
- ADR-0019: Approval and Compliance Policy — 書込み系ツールの二重ロック
- ADR-0020: LLM Router Fallback — Smart Router の LLM フォールバック（opt-in）

## References / 参考 / Referensi

- [docs/public-mcp-hub/feasibility.md](../public-mcp-hub/feasibility.md) — 実現可能性・需要・規制境界
- [docs/adr/0012-roadmap-boundaries.md](0012-roadmap-boundaries.md) — JP Bids MCP スコープ確定
- [agentgateway OSS](https://agentgateway.dev) — MCP Gateway のリファレンス実装（Rust）
- [Permit MCP Gateway](https://docs.permit.io/permit-mcp-gateway) — tool-level authorization のリファレンス
