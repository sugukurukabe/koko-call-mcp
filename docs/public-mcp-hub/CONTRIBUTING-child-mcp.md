# 子 MCP の追加手順
# How to Add a Child MCP
# Cara Menambahkan MCP Anak

Public MCP JP Gateway は**コード変更ゼロ**で子 MCP を追加できるよう設計されています。
The Public MCP JP Gateway is designed to add child MCPs with **zero code changes**.
Public MCP JP Gateway dirancang untuk menambahkan MCP anak dengan **tanpa perubahan kode**.

---

## 5 ステップで追加完了 / 5 Steps to Add / 5 Langkah untuk Menambahkan

### Step 1: 子 MCP の仕様を確認する / Check child MCP specs / Periksa spesifikasi MCP anak

追加する子 MCP について以下を確認してください:
Check the following for the child MCP you want to add:

| 確認項目 | 例（gmo-bank） |
|---------|---------------|
| MCP エンドポイント URL | `https://sugukuru-finance-xxx.run.app/mcp` |
| 認証方式 | `bearer_apikey` / `bearer_oauth` / `none` |
| リスクレベル | `read_only` / `read_write` / `financial` |
| 利用可能なツール名 | `gmo_bank_get_balance`, `gmo_bank_transfer`, ... |
| 書込み系ツールの有無 | `gmo_bank_transfer` は実送金のため `required_approval: true` |
| 出典・ライセンス | `GMOあおぞらネット銀行 API`, `proprietary` |

---

### Step 2: `gateway/config/registry.json` に 1 エントリ追加する
### Step 2: Add 1 entry to `gateway/config/registry.json`
### Langkah 2: Tambahkan 1 entri ke `gateway/config/registry.json`

`servers` 配列の末尾に追加します。`gmo-bank` を実例として参照してください。

```json
{
  "id": "your-service",
  "display_name": "サービス名（日本語）",
  "display_name_en": "Service Name (English)",
  "display_name_id": "Nama Layanan (Indonesia)",
  "endpoint": "http://localhost:9999",
  "auth_type": "bearer_apikey",
  "risk_level": "read_only",
  "tool_allowlist": [
    "tool_name_1",
    "tool_name_2"
  ],
  "tool_modes": {
    "bid_search": [],
    "subsidy_search": [],
    "financial_check": ["tool_name_1"],
    "full_orchestration": ["tool_name_1", "tool_name_2"]
  },
  "tool_policies": {
    "tool_name_2": {
      "required_approval": true,
      "compliance_check": ["my_compliance_key"]
    }
  },
  "cache_ttl_seconds": 60,
  "attribution": {
    "source": "データ提供元名",
    "license": "ライセンス名",
    "url": "https://example.com"
  },
  "routing_keywords": [
    "キーワード1",
    "キーワード2",
    "keyword1",
    "keyword2"
  ]
}
```

**設計ガイドライン / Design guidelines:**

| フィールド | ガイドライン |
|-----------|-------------|
| `tool_allowlist` | 書込み系ツールは除外（`required_approval: true` で制御する場合は除く） |
| `tool_modes` | 無関係な mode には空配列 `[]`（LLM コンテキスト節約） |
| `tool_policies` | 実送金・削除・外部通知など不可逆操作は `required_approval: true` を設定 |
| `cache_ttl_seconds` | 財務データ: 30 秒、補助金: 300 秒、入札: 60 秒を目安に |
| `routing_keywords` | 日英インドネシア語を混ぜる（最低 6 〜 10 個） |

---

### Step 3: Cloud Run 環境変数を追加する
### Step 3: Add Cloud Run environment variables
### Langkah 3: Tambahkan variabel lingkungan Cloud Run

```bash
# エンドポイント上書き（ID を大文字・ハイフンをアンダースコアに変換）
# Endpoint override (convert ID to uppercase, hyphens to underscores)
GATEWAY_CHILD_ENDPOINT_YOUR_SERVICE=https://your-service.run.app/mcp

# 認証トークン（bearer_apikey の場合）
# Auth token (for bearer_apikey)
GATEWAY_CHILD_TOKEN_YOUR_SERVICE=your-api-token-here
```

`loader.ts` が自動的に `GATEWAY_CHILD_ENDPOINT_<ID>` を読んでエンドポイントを上書きします。
`loader.ts` automatically reads `GATEWAY_CHILD_ENDPOINT_<ID>` to override the endpoint.

---

### Step 4: ローカルで動作確認する / Verify locally / Verifikasi secara lokal

```bash
cd gateway

# 1. ビルドが通ることを確認
npm run build

# 2. テストが green であることを確認
npm test

# 3. 開発サーバーを起動して list_connected_servers を確認
npm run dev
```

別ターミナルで動作確認:

```bash
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-11-25" \
  -d '{
    "jsonrpc": "2.0", "id": 1,
    "method": "tools/call",
    "params": {
      "name": "list_connected_servers",
      "arguments": { "mode": "financial_check" }
    }
  }' | jq '.result.content[0].text | fromjson | .servers[].id'
# → "your-service" が表示されることを確認
```

---

### Step 5: PR を出して smoke test に追加する / Open PR and update smoke test / Buka PR dan perbarui smoke test

`gateway/tests/smoke/gateway.smoke.ts` の `/readyz` テストに新しい server_id を追加します:

```typescript
expect(res.body.connected_servers).toContain("your-service");
```

PR のタイトルと説明に以下を含めてください:
- 追加するサービスの名称と用途
- エンドポイントの URL（本番は環境変数で管理するため PR には含めない）
- `tool_allowlist` に含めたツール名一覧
- `required_approval` を設定したツール名（あれば）

---

## 確認手順チェックリスト / Verification Checklist / Daftar Periksa Verifikasi

子 MCP を追加した後、以下の手順で動作を確認してください:
After adding a child MCP, verify with the following steps:

```bash
cd gateway

# 1. TypeScript ビルド確認
npx tsc --noEmit

# 2. 全テスト green 確認（smoke test 含む）
npx vitest run

# 3. 開発サーバー起動
npm run dev &

# 4. list_connected_servers で新サーバーが見えるか確認
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-11-25" \
  -d '{
    "jsonrpc": "2.0", "id": 1,
    "method": "tools/call",
    "params": {
      "name": "list_connected_servers",
      "arguments": { "mode": "full_orchestration" }
    }
  }' | jq '.result.content[0].text | fromjson | .servers[].id'

# 5. 新 mode でフィルタリングされるか確認（例: agri_research）
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-11-25" \
  -d '{
    "jsonrpc": "2.0", "id": 1,
    "method": "tools/call",
    "params": {
      "name": "list_connected_servers",
      "arguments": { "mode": "agri_research" }
    }
  }' | jq '.result.content[0].text | fromjson | .servers[].id'
# → 新サーバーのみが表示されれば OK

# 6. routing_keywords で Smart Router が新サーバーを選択するか確認
# route テストでキーワードを渡し、期待するサーバーが選ばれることを確認

# 7. cache が read_only サーバーに効くか確認
# 同じリクエストを 2 回送り、2 回目がキャッシュから返ることを確認

# 8. policy engine が risk_level を正しく判定するか確認
# financial サーバーの write tool を Pro 未認証で呼び、denied になることを確認
```

| チェック項目 | 確認方法 | 期待結果 |
|-------------|---------|----------|
| `tsc --noEmit` | TypeScript ビルド | エラー 0 |
| `vitest run` | 全テスト | 全 pass |
| `list_connected_servers(full_orchestration)` | 新サーバーが一覧に出る | `id` が含まれる |
| `list_connected_servers(新 mode)` | 新 mode でフィルタ | 対象サーバーのみ表示 |
| `list_connected_servers(既存 mode)` | 既存 mode に影響なし | 従来通りの結果 |
| routing_keywords | Smart Router | 期待サーバーが選ばれる |
| cache TTL | 同一リクエスト 2 回 | `read_only` はキャッシュ有効 |
| policy engine | 認証なし書込み | `denied` |

---

## 実例: gmo-bank の追加 / Example: Adding gmo-bank / Contoh: Menambahkan gmo-bank

[`gateway/config/registry.json`](../../gateway/config/registry.json) の `gmo-bank` エントリが完全な実例です。

ポイント:
- `gmo_bank_transfer` は `tool_allowlist` に含まれていない（読み取り系のみを公開）
- `tool_modes.full_orchestration` にだけ `gmo_bank_transfer` を追加（使いたいモードで明示）
- `tool_policies.gmo_bank_transfer.required_approval: true` で二重ロック
- `tool_policies.gmo_bank_transfer.compliance_check: ["tx_amount_under_limit"]` でコンプライアンス宣言を要求
- `cache_ttl_seconds: 30`（残高は鮮度が重要なため短め）

---

## よくある間違い / Common mistakes / Kesalahan umum

| NG | OK |
|----|-----|
| 書込み系ツールを `tool_allowlist` に入れる | `required_approval: true` + `full_orchestration` のみに追加 |
| `routing_keywords` を日本語だけにする | 日英インドネシア語を混ぜる |
| `financial` なのに `risk_level: read_only` にする | 正しい `risk_level` を設定する |
| コード変更して tool 登録ロジックを追加する | `registry.json` のみ変更する（設計を疑え） |
| attribution の `url` を空にする | データライセンスルール（ADR-02）により必須 |

---

## 新しい mode の追加 / Adding new modes / Menambahkan mode baru

ADR-0022 により、mode は固定 enum ではなく `registry.json` の `tool_modes` キーで動的に定義します。

新しいドメインの child MCP を追加するときは、`tool_modes` に新しいキーを定義するだけで、コード変更は不要です。
When adding a child MCP for a new domain, define a new key in `tool_modes` — no code changes required.

```json
{
  "id": "agriops",
  "tool_modes": {
    "agri_research": ["get_municipality_stats"],
    "municipality_analysis": ["get_municipality_stats"],
    "bid_search": [],
    "full_orchestration": []
  }
}
```

| mode | 用途 | 対象 child MCP 例 |
|------|------|-------------------|
| `bid_search` | 入札検索 | JP Bids |
| `subsidy_search` | 補助金検索 | J-Grants |
| `financial_check` | 財務確認 | freee / GMO / MoneyForward |
| `agri_research` | 農業・自治体分析 | AgriOps / e-Stat |
| `municipality_analysis` | 自治体データ横断 | AgriOps / e-Stat |
| `company_identity` | 法人確認 | 法人番号 MCP |
| `legal_reference` | 法令参照 | e-Gov 法令検索 |
| `visa_compliance` | 在留管理確認 | SSW/Visa MCP |
| `full_orchestration` | 全サーバー表示 | 全 child MCP |

`full_orchestration` は予約済み mode であり、全サーバーが常に表示されます。
`full_orchestration` is a reserved mode and always shows all servers.

---

## 将来の拡張候補テンプレート / Future expansion templates / Templat perluasan masa depan

[expansion-registry-templates.json](./expansion-registry-templates.json) に法人番号・e-Stat・e-Gov 法令・SSW/Visa の候補テンプレートがあります。本番投入時に `registry.json` へコピーしてください。

---

## 関連ドキュメント / Related documents / Dokumen terkait

- [ADR-0016](../adr/0016-public-mcp-federation-hub.md) — Federation Hub 設計・Extensibility-First 原則
- [ADR-0017](../adr/0017-dynamic-tool-surface.md) — tool_modes の設計
- [ADR-0018](../adr/0018-cache-strategy.md) — cache_ttl_seconds の設計
- [ADR-0019](../adr/0019-approval-and-compliance-policy.md) — required_approval / compliance_check の設計
- [ADR-0020](../adr/0020-llm-router-fallback.md) — routing_keywords の重要性（LLM フォールバック）
- [ADR-0022](../adr/0022-gateway-expansion-packs.md) — Gateway 拡張パックと mode の一般化
