# ADR-0021: マネーフォワード クラウド会計 MCP の Gateway 連邦統合
# ADR-0021: MoneyForward Cloud Accounting MCP Integration into the Gateway Federation
# ADR-0021: Integrasi MoneyForward Cloud Accounting MCP ke dalam Federasi Gateway

## Status / Status / Status

Accepted / Accepted / Diterima

## Context / 背景 / Konteks

2026年3月26日、株式会社マネーフォワードが「マネーフォワード クラウド会計 MCP」を全プランで公開した。
リモートMCPサーバーとして提供され、接続設定のみで利用可能（環境構築不要）。

これにより Public MCP JP Gateway は Jグランツ（補助金）・GMOあおぞらネット銀行（振込）に続く第4の子MCPとして
クラウド会計を統合できる状況になった。

派遣業の月次フローとして:

1. JP Bids で受注見込み案件を取得
2. Jグランツで使える補助金を確認
3. GMO で残高・入金確認 → 振込実行
4. **MoneyForward で対応仕訳を自動作成 → 残高試算表で月次反映を確認**

という End-to-End フローが Gateway 上で完結する。

---

On March 26, 2026, MoneyForward released the "MoneyForward Cloud Accounting MCP" for all subscription plans.
It is provided as a remote MCP server that requires only connection configuration—no environment setup needed.

This enables the Public MCP JP Gateway to integrate cloud accounting as its 4th child MCP,
following J-Grants (subsidies) and GMO Aozora Net Bank (transfers).

The monthly dispatch business flow can now complete end-to-end on the Gateway:

1. JP Bids: Find promising procurement opportunities
2. J-Grants: Check available subsidies
3. GMO: Confirm balance/deposits → Execute transfer
4. **MoneyForward: Auto-create journal entries → Verify monthly close via trial balance**

---

Pada 26 Maret 2026, MoneyForward merilis "MoneyForward Cloud Accounting MCP" untuk semua paket langganan.
Disediakan sebagai server MCP remote yang hanya memerlukan konfigurasi koneksi—tanpa perlu pengaturan lingkungan.

Ini memungkinkan Public MCP JP Gateway untuk mengintegrasikan akuntansi cloud sebagai MCP anak ke-4,
mengikuti J-Grants (subsidi) dan GMO Aozora Net Bank (transfer).

Alur bisnis bulanan dispatch kini dapat diselesaikan secara end-to-end di Gateway.

## Decision / 決定 / Keputusan

### 1. Endpoint: beta を採用 / Use beta endpoint / Gunakan endpoint beta

```
https://beta.mcp.developers.biz.moneyforward.com/mcp/ca/v3
```

alpha (`https://alpha.mcp.developers.biz.moneyforward.com/mcp/ca/v3`) は1時間ごとの再認証が必要。
beta は認証時間延長＋自動再認証に対応しており、エージェント連続処理に適する。

The beta endpoint supports extended authentication time and automatic re-authentication,
making it suitable for continuous agent processing. The alpha endpoint requires re-authentication
every hour.

### 2. 認証: ヘッダ pass-through / Auth: Header pass-through / Auth: Penerusan header

Gateway は MoneyForward の OAuth トークンを持たない。MCPクライアント（Cursor / Claude / Gemini CLI）が
MoneyForward アプリポータルで OAuth 認可を完了し、取得した access token を Gateway への
リクエストヘッダに含めて送信する。Gateway はそのトークンをそのまま子MCPへ転送する。

```
X-Mcp-Child-Authorization-moneyforward-ca: Bearer <mf_access_token>
```

Gateway はこの pass-through トークンを **監査ログに保存しない**（`actor_hash` とは別物）。
保存するのは SHA-256 ハッシュ化済みの Gateway Pro API キーのみ。

MCP clients (Cursor / Claude / Gemini CLI) complete OAuth authorization via MoneyForward App Portal
and include the obtained access token in request headers to the Gateway.
The Gateway forwards the token as-is to the child MCP without storing it in audit logs.

### 3. auth_type: `bearer_oauth` を流用 / Reuse `bearer_oauth` / Gunakan kembali `bearer_oauth`

既存の `bearer_oauth` auth_type（freee で利用中）をそのまま使う。
`ToolContext` に追加した `childAuthHeaders: Record<string, string>` により、
server-id ごとに独立したトークンを保持できる。freee と MoneyForward のトークンは競合しない。

The existing `bearer_oauth` auth_type (already used for freee) is reused as-is.
The newly added `childAuthHeaders: Record<string, string>` in `ToolContext` holds
independent tokens per server-id, so freee and MoneyForward tokens do not conflict.

### 4. tool_allowlist: 初期空（発見ベース） / Initial empty allowlist (discovery-based)

公式ドキュメントに実際のツール名が未公開のため、初期値は空（全ツール許可）とする。
`gateway/scripts/discover-mf-tools.ts` を実行してツール一覧を取得後、
`tool_allowlist` / `tool_modes` / `tool_policies` を確定する（Phase 4）。

Since official tool names are not published in documentation, the initial allowlist is empty
(all tools allowed). After running `gateway/scripts/discover-mf-tools.ts`, update
`tool_allowlist`, `tool_modes`, and `tool_policies` accordingly.

### 5. tool_policies: write 系ツールに required_approval を適用 / Apply required_approval to write tools

仕訳作成・更新・入出金明細作成などの書き込み系ツールには:

```json
{
  "required_approval": true,
  "compliance_check": ["accounting_period_open"]
}
```

を適用する。エージェントが `issue_approval_token` で HMAC トークンを取得し、
`compliance_context: { accounting_period_open: true }` を宣言することで実行可能になる。

Write tools (journal entry creation/update, cash flow entry creation) require:
- `required_approval: true`: agent must obtain HMAC-signed token via `issue_approval_token`
- `compliance_check: ["accounting_period_open"]`: agent must declare that accounting period is open

### 6. 対象範囲: クラウド会計のみ / Scope: Cloud Accounting only

2026年5月時点で MoneyForward の公式リモートMCPが提供するのはクラウド会計のみ。
給与計算（クラウド給与）・HR・請求書の公式リモートMCPは未提供。
これらは別途公式提供を待って統合する（別ADRで判断）。

As of May 2026, MoneyForward's official remote MCP covers Cloud Accounting only.
Cloud Payroll, HR, and Invoice MCPs are not yet officially provided as remote MCPs.
These will be integrated separately when officially available (separate ADR).

## Implementation / 実装 / Implementasi

```
gateway/config/registry.json
└── moneyforward-ca  ← beta endpoint、bearer_oauth、financial、routing_keywords設定

gateway/src/
├── proxy/mcp-proxy.ts        ← freeeeOAuthToken → oauthToken（タイポ修正＋汎用化）
├── tools/register-tools.ts   ← ToolContext に childAuthHeaders を追加
├── server.ts                 ← X-Mcp-Child-Authorization-{server-id} ヘッダを抽出
└── tools/call-registered-mcp.ts ← OAuth token 解決優先順を実装

gateway/scripts/
└── discover-mf-tools.ts      ← MoneyForward tools/list を取得するスクリプト

gateway/tests/
├── router/smart-router.spec.ts
├── proxy/header-passthrough.spec.ts
├── policy/policy-engine.spec.ts  ← MoneyForward 用テストを追加
└── smoke/gateway.smoke.ts        ← moneyforward-ca の存在確認を追加
```

## Consequences / 影響 / Konsekuensi

### 良い影響 / Positive / Positif

- JP Bids + Jグランツ + GMO + MoneyForward で派遣業の月次会計クローズまで貫通する
- Gateway の `bearer_oauth` / `financial` / `required_approval` インフラを追加実装なしで利用できる
- beta endpoint により認証切れの心配が軽減される
- `X-Mcp-Child-Authorization-{server-id}` ヘッダパターンは他の OAuth 系子MCPにも横展開できる

Completing the end-to-end monthly accounting close flow for dispatch businesses.
Reusing existing `bearer_oauth` / `financial` / `required_approval` infrastructure without new code.
The `X-Mcp-Child-Authorization-{server-id}` header pattern generalizes to other OAuth child MCPs.

### 制約 / Constraints / Batasan

- 給与計算ツールは提供されていないため、「給与計算 → 振込」フローは不可
  （現実的なフローは「GMO振込実行 → MoneyForward で仕訳自動作成」）
- tool_allowlist が初期空のため、Phase 4（ツール発見）完了までは全ツール露出
- MoneyForward のトークンはユーザーが手動でアプリポータルから取得・設定する必要がある

Payroll tools are not available; "payroll → transfer" flow is not possible.
Tool allowlist starts empty until Phase 4 (discovery) is complete.
Users must manually obtain and configure MoneyForward OAuth tokens.

## Related ADRs / 関連 ADR / ADR Terkait

- ADR-0016: Federation Hub 設計 — 子MCP登録基本方針
- ADR-0017: Dynamic Tool Surface — `tool_allowlist` / `tool_modes` による tool 絞り込み
- ADR-0019: Approval Token + Compliance Check — write 系ツールの二重ロック
- ADR-0020: LLM Router Fallback — キーワードスコアリングの補完

## References / 参考 / Referensi

- [マネーフォワード クラウド会計 MCP 案内](https://biz.moneyforward.com/support/account/guide/others/ot10.html)
- [MoneyForward 開発者サイト MCP ページ](https://developers.biz.moneyforward.com/mcp/)
- [プレスリリース（2026-03-26）](https://corp.moneyforward.com/news/release/service/20260326-mf-press-1/)
- [アプリポータル](https://app-portal.moneyforward.com/)
- [gateway/config/registry.json](../../gateway/config/registry.json)
- [gateway/scripts/discover-mf-tools.ts](../../gateway/scripts/discover-mf-tools.ts)
