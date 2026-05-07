# Public MCP Federation Hub — Gateway MVP アーキテクチャ仕様
# Public MCP Federation Hub — Gateway MVP Architecture Specification
# Public MCP Federation Hub — Spesifikasi Arsitektur Gateway MVP

バージョン / Version / Versi: 0.1.0-draft
設計日 / Design date / Tanggal desain: 2026-05-07

---

## 全体図 / Overall Architecture / Arsitektur Keseluruhan

```
MCP Client (Cursor / Claude / ChatGPT)
         │
         │ HTTP POST /mcp  (MCP 2025-11-25, OAuth 2.0 Bearer)
         │ + X-Mcp-Child-Authorization-{server-id} (per OAuth child MCP)
         ▼
┌─────────────────────────────────────────────────────────────┐
│              Public MCP JP Gateway                          │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐                 │
│  │ Auth     │  │ Policy   │  │ Audit     │                 │
│  │ (JWT /   │  │ Engine   │  │ Logger    │                 │
│  │  APIkey) │  │(allowlist│  │(JSONL /   │                 │
│  └────┬─────┘  │ /denylist│  │ Cloud Log)│                 │
│       │        └────┬─────┘  └─────┬─────┘                 │
│       └──────┬──────┘              │                       │
│              ▼                     │                       │
│        ┌────────────┐              │                       │
│        │ Smart      │◄─────────────┘                       │
│        │ Router     │                                       │
│        └─────┬──────┘                                       │
│              │                                               │
│    ┌─────────┼──────────┬──────────────┐                   │
│    ▼         ▼          ▼              ▼                   │
│ ┌────────┐ ┌───────┐ ┌──────┐ ┌───────────────┐           │
│ │JP Bids │ │J-Grants│ │freee │ │MoneyForward CA│  ← Proxy │
│ │Proxy   │ │Proxy   │ │Proxy │ │Proxy          │           │
│ └───┬────┘ └───┬────┘ └──┬───┘ └───────┬───────┘           │
└─────┼──────────┼──────────┼─────────────┼──────────────────┘
      │          │          │             │
      ▼          ▼          ▼             ▼
mcp.bid-jp.com  jgrants-  freee-mcp  beta.mcp.developers.
(JP Bids MCP)   mcp-server (freee)   biz.moneyforward.com
                                     (Cloud Accounting MCP)
```

---

## 1. 子 MCP Registry / Child MCP Registry / Registry MCP Anak

### 設計方針 / Design Principles / Prinsip Desain

- 静的 JSON ファイルで定義する（動的 registry は v0.3 以降で検討）
- サーバーごとに `endpoint`, `auth_type`, `tool_allowlist`, `risk_level`, `attribution` を持つ
- `tool_allowlist` が空の場合は全ツールを許可する
- `risk_level` は `read_only` / `read_write` / `financial` の3段階

### Registry スキーマ / Registry Schema / Skema Registry

`gateway/config/registry.json`:

```json
{
  "$schema": "https://sugukuru-labs.github.io/schemas/mcp-registry/v1.json",
  "version": "1",
  "servers": [
    {
      "id": "jp-bids",
      "display_name": "JP Bids MCP（官公需入札）",
      "endpoint": "https://mcp.bid-jp.com/mcp",
      "auth_type": "bearer_apikey",
      "risk_level": "read_only",
      "tool_allowlist": [],
      "attribution": {
        "source": "中小企業庁 官公需情報ポータルサイト KKJ",
        "license": "政府標準利用規約 第2.0版",
        "url": "https://kkj.go.jp"
      },
      "routing_keywords": ["入札", "公告", "落札", "調達", "官公需", "bid", "procurement", "tender"]
    },
    {
      "id": "jgrants",
      "display_name": "Jグランツ MCP（補助金）",
      "endpoint": "http://localhost:8000",
      "auth_type": "none",
      "risk_level": "read_only",
      "tool_allowlist": ["search_subsidies", "get_subsidy_detail", "get_subsidy_overview"],
      "attribution": {
        "source": "デジタル庁 Jグランツ",
        "license": "MIT",
        "url": "https://www.jgrants-portal.go.jp"
      },
      "routing_keywords": ["補助金", "助成金", "グラント", "申請", "subsidy", "grant", "funding"]
    },
    {
      "id": "freee",
      "display_name": "freee MCP（会計・請求書）",
      "endpoint": "https://mcp.freee.co.jp/mcp",
      "auth_type": "bearer_oauth",
      "risk_level": "financial",
      "tool_allowlist": [
        "get_account_items",
        "get_deals",
        "get_invoices",
        "get_companies",
        "get_walletables"
      ],
      "attribution": {
        "source": "freee株式会社",
        "license": "Apache-2.0",
        "url": "https://developer.freee.co.jp"
      },
      "routing_keywords": ["会計", "請求書", "仕訳", "残高", "収支", "freee", "accounting", "invoice", "balance"]
    },
    {
      "id": "moneyforward-ca",
      "display_name": "マネーフォワード クラウド会計 MCP（仕訳・試算表・推移表）",
      "endpoint": "https://beta.mcp.developers.biz.moneyforward.com/mcp/ca/v3",
      "auth_type": "bearer_oauth",
      "risk_level": "financial",
      "tool_allowlist": [],
      "attribution": {
        "source": "株式会社マネーフォワード（クラウド会計）",
        "license": "proprietary",
        "url": "https://developers.biz.moneyforward.com/mcp/"
      },
      "routing_keywords": [
        "仕訳", "試算表", "残高試算表", "推移表", "勘定科目", "補助科目", "部門", "税区分",
        "入出金明細", "会計年度", "事業者情報", "マネーフォワード", "MoneyForward",
        "journal entry", "trial balance", "accounting period"
      ]
    }
  ]
}
```

---

## 2. Smart Router / スマートルーター / Smart Router

### v0.1 設計: ルールベース（LLM不使用）/ v0.1 Design: Rule-based (No LLM) / Desain v0.1: Berbasis Aturan (Tanpa LLM)

v0.1 は LLM によるルーティングではなく、以下の順序でルーティングを決定する:

1. **Tool 名の明示指定**: MCP クライアントが `call_registered_mcp` ツールで `server_id` を直接指定した場合はそちらを使う
2. **キーワードスコアリング**: registry の `routing_keywords` を使い、クエリテキストに対してキーワードマッチング数でスコアを計算する
3. **スコア最大のサーバーを選択**: スコアが同点の場合は `risk_level` が低いサーバーを優先する
4. **マッチなし**: `list_connected_servers` を呼ぶよう促すエラーメッセージを返す

将来（v0.3+）: embedding ベースのセマンティックマッチングに差し替える。Router のインターフェースは変えない。

### Router インターフェース / Router Interface / Antarmuka Router

```typescript
export interface RouterContext {
  query: string;
  explicitServerId?: string;
}

export interface RouterResult {
  serverId: string;
  score: number;
  reason: string;
}

export interface SmartRouter {
  route(context: RouterContext): RouterResult | null;
}
```

---

## 3. Policy Engine / ポリシーエンジン / Mesin Kebijakan

### v0.1 設計 / v0.1 Design / Desain v0.1

Policy Engine は以下の2種類の判定を行う:

**Tool-level Policy（サーバーごとの allowlist/denylist）:**

- Registry の `tool_allowlist` が空でなければ、リストにないツール呼び出しを `denied` にする
- `risk_level: "financial"` のサーバーは、APIキー認証では `denied`にし、OAuth認証のみ許可する

**Rate Limit Policy:**

- サーバーごとに 1秒あたりのリクエスト数を制限する（デフォルト: 1 req/sec）
- 超過した場合は `429 Too Many Requests` 相当のエラーを返す

### Policy 判定結果 / Policy Decision / Keputusan Kebijakan

```typescript
export type PolicyDecision = "allowed" | "denied" | "rate_limited";

export interface PolicyResult {
  decision: PolicyDecision;
  reason: string;
}
```

---

## 4. Audit Logger / 監査ロガー / Logger Audit

### データ保存方針 / Data Retention Policy / Kebijakan Penyimpanan Data

保存する情報のみ（個人情報・財務データ・入力全文は保存しない）:

```typescript
export interface AuditEvent {
  request_id: string;          // UUIDv4
  timestamp: string;           // ISO 8601
  actor_hash: string;          // SHA-256(APIキー or JWT sub)、元の値は保存しない
  selected_server: string;     // "jp-bids" | "jgrants" | "freee"
  tool_name: string;           // 呼び出されたツール名
  decision: "allowed" | "denied" | "rate_limited";
  reason?: string;             // denied/rate_limited の場合のみ
  attribution_url?: string;    // 出典URL（JP Bidsなら KKJ ページ）
  latency_ms: number;
}
```

### 出力先 / Output Destinations / Tujuan Output

```
v0.1: JSONL ファイル (stdout / Cloud Logging 自動取り込み)
v0.3: Cloud Logging + Cloud Storage WORM retention lock
v0.5: 署名付きイベント（ED25519）、Merkle root anchoring（optional）
```

---

## 5. Gateway MCP Tools / ゲートウェイ MCP ツール / Alat MCP Gateway

Gateway が公開する MCP ツールは最小限に絞る。子 MCP のツールを全部 re-expose せず、
Gateway 固有の横断ユースケースだけをツール化する。

| ツール名 | 目的 | tier |
|---|---|---|
| `get_gateway_demo` | 初回デモ、必要な認証、推奨ツール順を返す | Free |
| `list_connected_servers` | 接続中の子 MCP サーバー一覧と各サーバーのツール一覧を返す | Free |
| `search_public_opportunities` | 入札 + 補助金を並列検索し、統合結果を返す | Free |
| `analyze_funding_fit` | 指定案件に対して入札可否・補助金利用可否・会計余力を分析 | Pro |
| `call_registered_mcp` | 任意の登録済み子 MCP のツールを直接呼び出す | Pro |
| `get_audit_events` | 過去のリクエスト監査ログを取得する（自分のリクエストのみ） | Pro |

### ツール annotations / Tool Annotations / Anotasi Alat

全ツールに以下の annotations を設定する:

```typescript
{
  readOnlyHint: true,         // search_public_opportunities, list_connected_servers
  idempotentHint: true,       // 全ての読み取りツール
  openWorldHint: true,        // 子 MCP 経由で外部 API を呼ぶため
  destructiveHint: false,     // v0.1 は read-only のみ
}
```

---

## 6. 認証設計 / Authentication Design / Desain Autentikasi

JP Bids MCP の OAuth 実装（`src/oauth/`）をテンプレートに使い、Gateway 独自の JWT secret を持つ。

```
Gateway 認証フロー:
1. MCP クライアント → Gateway POST /mcp（Bearer なし）
2. Gateway → 401 + WWW-Authenticate（Gateway の OAuth server metadata を指す）
3. MCP クライアント → Gateway の OAuth エンドポイントで認可コードフロー
4. Gateway → JWT 発行（sub, tier, allowed_servers を claims に持つ）
5. MCP クライアント → Gateway POST /mcp（Bearer: JWT）
6. Gateway → JWT 検証 → Router → Policy → 子 MCP Proxy

子 MCP への認証:
- JP Bids MCP: Gateway が自分の Pro APIキーを環境変数で持ち、Proxy 時に付与
- Jグランツ MCP: 認証なし（公開 API）
- freee MCP: ユーザーが持ち込んだ freee OAuth トークンを Gateway が JWT claims に格納し、Proxy 時に付与
```

---

## 7. MVP 除外事項 / MVP Exclusions / Pengecualian MVP

以下は v0.1 MVP に含めない:

- 管理 UI / ダッシュボード
- gBizID / JPKI 統合
- ブロックチェーン Registry
- LLM ベースの Smart Router
- 子 MCP の動的追加・削除
- Enterprise 組織ポリシー（allowlist の組織別カスタマイズ）
- 監査ログのエクスポート UI
- freee への書き込み操作（v0.1 スコープ外）
- MoneyForward クラウド会計への書き込み（仕訳作成等）は `required_approval` + `compliance_check` 経由で v0.1 から対応（ADR-0021）

---

## 8. 実装ディレクトリ構造 / Implementation Directory Structure / Struktur Direktori Implementasi

```
gateway/
├── package.json
├── tsconfig.json
├── biome.json
├── Dockerfile
├── config/
│   └── registry.json              ← 子 MCP registry 定義
├── src/
│   ├── server.ts                  ← HTTP エントリポイント
│   ├── mcp.ts                     ← createGatewayServer() factory
│   ├── registry/
│   │   ├── schema.ts              ← Zod schema for registry.json
│   │   └── loader.ts              ← registry.json 読み込み
│   ├── router/
│   │   ├── smart-router.ts        ← キーワードスコアリング実装
│   │   └── router.test.ts
│   ├── policy/
│   │   ├── policy-engine.ts       ← allowlist / risk_level / rate limit
│   │   └── policy.test.ts
│   ├── audit/
│   │   ├── audit-logger.ts        ← AuditEvent の JSONL 書き出し
│   │   └── audit.test.ts
│   ├── proxy/
│   │   ├── mcp-proxy.ts           ← 子 MCP への Streamable HTTP Proxy
│   │   └── proxy.test.ts
│   ├── tools/
│   │   ├── register-tools.ts
│   │   ├── list-connected-servers.ts
│   │   ├── search-public-opportunities.ts
│   │   ├── analyze-funding-fit.ts
│   │   ├── call-registered-mcp.ts
│   │   └── get-audit-events.ts
│   ├── filter/
│   │   └── tool-filter.ts         ← Mode別動的ツール絞り込み（ADR-0017）
│   ├── cache/
│   │   └── tool-cache.ts          ← TTLキャッシュ（ADR-0018）
│   ├── oauth/
│   │   ├── router.ts              ← JP Bids MCP の oauth/router.ts に準拠
│   │   └── jwt.ts
│   └── lib/
│       ├── env.ts
│       ├── errors.ts
│       ├── auth.ts                ← tier 判定（Gateway 版）
│       └── version.ts
└── tests/
    └── smoke/
        └── gateway.smoke.ts       ← MCP Inspector 相当の E2E smoke test
```

---

## 6. Dynamic Tool Surface（Mode-based Filtering）— ADR-0017

### 課題

freee MCP は単体で約270のツールを持つ。JP Bids / Jグランツと合わせると300以上のツールが LLM に露出されうる。ツールリストが大きいほど：

- LLM のコンテキストウィンドウを圧迫する
- 推論精度が低下する（特に function-calling モデルで誤選択が増える）
- Multi-agent 構成でのロール分担が機能しない

### 解決策：Gateway Mode

エージェントが目的（Mode）を宣言することで、LLM に渡るツールリストを動的に絞り込む。

```
mode=bid_search            → JP Bids の入札ツールのみ表示
mode=subsidy_search        → Jグランツの補助金ツールのみ表示
mode=financial_check       → freee / MoneyForward の財務系ツールのみ表示
mode=agri_research         → AgriOps / e-Stat の農業・自治体ツールのみ表示
mode=municipality_analysis → 自治体分析ツールのみ表示
mode=full_orchestration    → 全許可ツールを表示（デフォルト）
```

### 実装

```typescript
// registry.json（サーバーごとの mode 設定）
{
  "id": "freee",
  "tool_modes": {
    "bid_search": [],                                          // 非表示
    "subsidy_search": [],                                      // 非表示
    "financial_check": ["get_walletables", "get_deals", "get_invoices"],  // 財務確認のみ
    "full_orchestration": []                                   // 全allowlist
  }
}

{
  "id": "agriops",
  "tool_modes": {
    "agri_research": ["get_municipality_stats"],               // 農業調査のみ
    "municipality_analysis": ["get_municipality_stats"],       // 自治体分析のみ
    "financial_check": [],                                     // 非表示
    "full_orchestration": []                                   // 全allowlist
  }
}

// ツール呼び出し時に mode を指定
list_connected_servers(mode: "financial_check")
call_registered_mcp(server_id: "freee", tool_name: "get_walletables", mode: "financial_check")
```

### Multi-agent オーケストレーション例（Grok 16-agent）

単一の Gateway エンドポイントに対し、各エージェントが異なる Mode で接続することでコンテキスト汚染なしに役割分担できる：

```
Agent 1 (mode=bid_search)      → JP Bids で高勝率案件を探す
Agent 2 (mode=subsidy_search)  → 案件に使える補助金をマッチング
Agent 3 (mode=agri_research)    → AgriOps で自治体の農業統計を確認
Agent 4 (mode=financial_check)  → freee / MoneyForward で資金面を検証
Orchestrator (full_orchestration) → 各エージェントの出力を統合して事業計画を生成
```

---

## 7. Cache Strategy — ADR-0018

### 方針

**読み取り専用かつべき等なツール呼び出しにのみ TTL キャッシュを適用する。財務データは禁止。**

| サーバー | TTL | 理由 |
|---|---|---|
| jp-bids | 60秒 | 入札公告は日次更新 |
| jgrants | 300秒 | 補助金情報は週次更新 |
| freee | **禁止** | 残高・取引は即時性が必要 |
| moneyforward-ca | **禁止** | 仕訳・試算表は即時性が必要 |

### キャッシュキー設計

```
{server_id}:{tool_name}:{SHA256(sorted_JSON(arguments))[:16]}
```

引数を JSON でシリアライズしてキーをソートすることで引数順序非依存にする。Actor（ユーザー）はキーに含めない（公開データは共有可能）。

### 実装の特徴

- **メモリ内 TTL キャッシュ**（`Map<string, CacheEntry>`）。Cloud Run の stateless 環境に適している。
- **最大1,000エントリ**。超過時は FIFO で削除。
- **永続化なし**。インスタンスリスタート時はクリア（古いデータの引き継ぎを防ぐ）。
- **v1 以降**：Redis/Memorystore でインスタンス間共有を検討。

### キャッシュバイパス

- `bypassCache: true` を `proxyToolCall` に渡すことで強制更新可能
- `risk_level === "financial"` のサーバーは常にキャッシュをスキップ
- `cache_ttl_seconds` が設定されていないサーバーはキャッシュ対象外
