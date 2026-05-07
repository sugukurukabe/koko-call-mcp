---
title: "他人のOAuthを預からないMCP Gatewayを設計する — X-Mcp-Child-Authorization-{server-id} という選択"
emoji: "🔑"
type: "tech"
topics: ["mcp", "typescript", "oauth", "security", "gateway"]
published: true
---

## ヘッダに書かれた1行

`X-Mcp-Child-Authorization-moneyforward-ca: Bearer eyJhbG...`

この1行は、Gateway のリクエストヘッダの中に静かに並んでいます。Gateway 自身の `Authorization` ヘッダではありません。Gateway の鍵でもありません。ユーザーが MoneyForward のアプリポータルで取得した OAuth アクセストークンが、Gateway を「通過する」ためだけに書かれた1行です。

Public MCP JP Gateway は、JP Bids（入札）・Jグランツ（補助金）・AgriOps（農業統計）・不動産インテル（地価・投資分析）・法人番号・freee・MoneyForward Cloud Accounting の 7 本の child MCP を 1 つのエンドポイントに束ねる Federation Gateway です。この記事では、その Gateway が「他人の OAuth を預からない」と決めた設計判断について書きます。

---

## Federation Gateway の構造的な罠 — サーバーの鍵で全員の財務に触れる

MCP Gateway（Model Context Protocol Gateway）は、複数の child MCP サーバーを 1 つの接続先にまとめる中継サーバーです。Gateway が child MCP に代わって tool を呼ぶとき、最も自然な実装は「Gateway がすべての child MCP の認証情報を持つ」という形になります。

freee MCP は単体で約 270 ツールを持ちます。MoneyForward Cloud Accounting MCP は仕訳作成・試算表照会を含みます。これらの OAuth トークンを Gateway のサーバー環境変数に 1 つ置けば、全ユーザーのリクエストがその 1 つのトークンで実行されます。

問題は、ここにあります。

| 構成 | Gateway がトークンを持つ | ユーザーがトークンを持つ |
|---|---|---|
| 認可の主体 | Gateway 運営者 | 各ユーザー |
| トークン漏洩時の影響範囲 | 全ユーザーの財務データ | そのユーザーだけ |
| 監査ログの actor 特定 | 不可能（全員が同一トークン） | actor_hash で区別可能 |
| OAuth スコープの細分化 | Gateway に全スコープが集中 | ユーザーが許可した範囲のみ |

Gateway に credential を集約する構成は、コードを短くする代わりに、セキュリティの責任を Gateway 運営者に集中させます。中小企業向けの public Gateway でこの責任を引き受けるのは、技術的にも運用的にも正しくありません。

---

## 決定 — 鍵を持たず、預からず、ログにも残さない

[ADR-0021](https://github.com/sugukurukabe/koko-call-mcp/blob/main/docs/adr/0021-moneyforward-accounting-mcp-integration.md) §2 で、以下の方針を決定しました。

> Gateway は MoneyForward の OAuth トークンを持たない。MCPクライアント（Cursor / Claude / Gemini CLI）が MoneyForward アプリポータルで OAuth 認可を完了し、取得した access token を Gateway へのリクエストヘッダに含めて送信する。Gateway はそのトークンをそのまま子MCPへ転送する。

この pass-through（パススルー）方式では、Gateway はトークンの中身を解析しません。復号しません。保存しません。監査ログにも書きません。

なぜこの判断に至ったかを、ADR-0021 §3 の auth_type 選択と合わせて整理します。

| 選択肢 | 判断 | 理由 |
|---|---|---|
| Gateway がサーバートークンを保持 | 棄却 | 全ユーザーの認可が 1 トークンに集約される |
| Gateway が OAuth proxy として動作 | 棄却 | OAuth consent 画面を Gateway が出す必要がある。MCP クライアント側が対応済みなので二重実装になる |
| `Authorization` ヘッダを上書き | 棄却 | Gateway 自身の Pro API キー認証と衝突する |
| 独自 MCP フィールドで渡す | 棄却 | MCP 仕様外の拡張になり、クライアント側の対応が必要になる |
| **ヘッダ pass-through** | **採用** | HTTP の標準的な仕組みだけで完結する。Gateway コードの変更は 1 ループだけ |

---

## 抽出は 1 ループだけ — server.ts の 18 行

ヘッダの抽出は [`gateway/src/server.ts`](https://github.com/sugukurukabe/koko-call-mcp/blob/main/gateway/src/server.ts) の L101-L118 で完結しています。

```typescript
// X-Mcp-Child-Authorization-{server-id} ヘッダを抽出して子MCPのOAuthトークンを取得する
// Extract X-Mcp-Child-Authorization-{server-id} headers for child MCP OAuth tokens
// Ekstrak header X-Mcp-Child-Authorization-{server-id} untuk token OAuth MCP anak
const childAuthHeaders: Record<string, string> = {};
const prefix = "x-mcp-child-authorization-";
for (const [headerName, headerValue] of Object.entries(req.headers)) {
  if (typeof headerName === "string" && headerName.toLowerCase().startsWith(prefix)) {
    const serverId = headerName.toLowerCase().slice(prefix.length);
    const childToken = extractBearerToken(
      Array.isArray(headerValue) ? headerValue[0] : headerValue,
    );
    if (serverId && childToken) {
      childAuthHeaders[serverId] = childToken;
    }
  }
}

const context = { tier, isOAuthAuthenticated, actorHash, childAuthHeaders };
```

`x-mcp-child-authorization-` という prefix の後に server-id が続きます。`moneyforward-ca` なら `X-Mcp-Child-Authorization-moneyforward-ca`。`freee` なら `X-Mcp-Child-Authorization-freee`。prefix を slice した残りが server-id になります。

抽出した結果は `Record<string, string>` に入ります。この型が重要です。server-id をキーとする辞書なので、freee のトークンと MoneyForward のトークンは namespace で完全に分離されます。同じリクエストに両方のヘッダがあっても衝突しません。

---

## トークン解決の優先順 — ヘッダ > 引数 > 環境変数

抽出されたトークンは [`gateway/src/tools/call-registered-mcp.ts`](https://github.com/sugukurukabe/koko-call-mcp/blob/main/gateway/src/tools/call-registered-mcp.ts) の L137-L144 で解決されます。

```typescript
// OAuth トークンの解決優先順: ヘッダ > 引数 > 環境変数
// OAuth token resolution priority: header > argument > environment variable
// Prioritas resolusi token OAuth: header > argumen > variabel lingkungan
const effectiveOAuthToken =
  context.childAuthHeaders[server_id] ??
  freee_oauth_token ??
  process.env[`GATEWAY_CHILD_TOKEN_${server_id.toUpperCase().replace(/-/g, "_")}_OAUTH`] ??
  (server_id === "freee" ? process.env.GATEWAY_CHILD_TOKEN_FREEE : undefined);
```

nullish coalescing（`??`）で 4 段階のフォールバックを組んでいます。

1. `context.childAuthHeaders[server_id]` — ユーザーがヘッダで渡したトークン（最優先）
2. `freee_oauth_token` — tool 引数で直接渡されたトークン（後方互換）
3. `process.env[...]_OAUTH` — サーバー運営者が環境変数で設定した固定トークン（サーバー固定運用向け）
4. `process.env.GATEWAY_CHILD_TOKEN_FREEE` — freee 固有の環境変数（初期実装互換）

ユーザーのヘッダが最優先であることが、この設計の核心です。環境変数はサーバー運営者のフォールバックであり、ユーザーの credential ではありません。

---

## credential と監査の物理的分離 — AuditEvent には何が残るか

Gateway の監査ログは [`gateway/src/audit/audit-logger.ts`](https://github.com/sugukurukabe/koko-call-mcp/blob/main/gateway/src/audit/audit-logger.ts) の `AuditEvent` interface で定義されています。

```typescript
export interface AuditEvent {
  request_id: string;
  timestamp: string;
  // SHA-256 の先頭16文字のみ保存（元の値は不可逆）
  // Only first 16 chars of SHA-256 (irreversible)
  // Hanya 16 karakter pertama SHA-256 (tidak dapat dibalik)
  actor_hash: string;
  selected_server: string;
  tool_name: string;
  decision: PolicyDecision;
  reason?: string | undefined;
  attribution_url?: string | undefined;
  latency_ms: number;
}
```

ここに `token` や `authorization` というフィールドはありません。`actor_hash` は Gateway の Pro API キーから生成される SHA-256 の先頭 16 文字であり、MoneyForward や freee の OAuth トークンとは完全に別物です。

[`gateway/src/lib/auth.ts`](https://github.com/sugukurukabe/koko-call-mcp/blob/main/gateway/src/lib/auth.ts) L51-L53 で生成しています。

```typescript
export function hashActor(rawActor: string): string {
  return createHash("sha256").update(rawActor).digest("hex").slice(0, 16);
}
```

16 文字に切り詰めているのは、衝突確率よりも「元のトークンを復元できないこと」を優先したためです。監査ログの目的は「誰が何をしたか」のメタデータであり、「どの credential で認可されたか」の記録ではありません。

つまり、以下の 3 つは物理的に分離されています。

| 情報 | 保存場所 | Gateway に残るか |
|---|---|---|
| Gateway Pro API キー | `Authorization: Bearer <key>` → `actor_hash` | SHA-256 先頭 16 文字のみ |
| child MCP の OAuth トークン | `X-Mcp-Child-Authorization-{server-id}` → 子 MCP へ転送 | 残らない |
| tool 呼び出しの結果 | 子 MCP が返す | 残らない（入力全文・財務データは保存しない） |

---

## テストで境界を縛る — Authorization: Bearer として下流に届く実測

設計上の分離は、テストで縛らなければ信用できません。[`gateway/tests/proxy/header-passthrough.spec.ts`](https://github.com/sugukurukabe/koko-call-mcp/blob/main/gateway/tests/proxy/header-passthrough.spec.ts) では 3 つの境界を検証しています。

1 つ目は、`proxyToolCall` に `oauthToken` を渡すと、下流の child MCP へ `Authorization: Bearer` として送られることです。

```typescript
await proxyToolCall({
  server: mfcaServer,
  toolName: "get_trial_balance",
  toolArguments: {},
  oauthToken: "mf-oauth-token-xyz",
});

expect(capturedHeaders.Authorization).toBe("Bearer mf-oauth-token-xyz");
```

2 つ目は、`oauthToken` がなければ `Authorization` ヘッダ自体が送られないことです。

```typescript
await proxyToolCall({
  server: mfcaServer,
  toolName: "get_trial_balance",
  toolArguments: {},
});

expect(capturedHeaders.Authorization).toBeUndefined();
```

3 つ目は、HTTP レベルで `X-Mcp-Child-Authorization-moneyforward-ca` ヘッダを付けたリクエストが、下流の fetch 呼び出しで `Authorization: Bearer mf-list-token` として到達することです。

```typescript
const res = await request(app)
  .post("/mcp")
  .set("X-Mcp-Child-Authorization-moneyforward-ca", "Bearer mf-list-token")
  .send({ /* tools/call */ });

const mfCall = fetchMock.mock.calls.find(([url]) =>
  String(url).includes("beta.mcp.developers.biz.moneyforward.com"),
);
expect((mfCall?.[1] as RequestInit).headers).toMatchObject({
  Authorization: "Bearer mf-list-token",
});
```

テストは 56 本すべて通過しています。pass-through の挙動は仕様ではなくテストで保証されています。

---

## freee と MoneyForward が同居できる理由

Cursor の `.cursor/mcp.json` から Gateway に接続する設定は、以下のようになります。

```json
{
  "mcpServers": {
    "public-mcp-jp-gateway": {
      "url": "http://127.0.0.1:8090/mcp",
      "headers": {
        "X-Mcp-Child-Authorization-moneyforward-ca": "Bearer <MF_TOKEN>",
        "X-Mcp-Child-Authorization-freee": "Bearer <FREEE_TOKEN>"
      }
    }
  }
}
```

2 つの OAuth トークンが同じリクエストに乗ります。Gateway 側では `childAuthHeaders["moneyforward-ca"]` と `childAuthHeaders["freee"]` に分かれて格納されます。`call_registered_mcp` で `server_id: "moneyforward-ca"` を呼ぶときは前者が、`server_id: "freee"` を呼ぶときは後者が使われます。

これは `Record<string, string>` という型が server-id namespace を自然に切ってくれるためです。型の選択が、2 社の SaaS OAuth を衝突なく通す設計を支えています。

GMO 銀行系 API は現時点の public Gateway では提供していません。利用許諾と API 取得が完了した後、private connector として追加する方針です（[private connector policy](https://github.com/sugukurukabe/koko-call-mcp/blob/main/docs/public-mcp-hub/gmo-banking-private-connector.md)）。

---

## 中継器は封を破らない配達員です

MCP Gateway の credential 設計で最も重要なのは、「何をしないか」を決めることでした。

Gateway はトークンを復号しません。保存しません。ログに書きません。有効期限も検証しません。子 MCP が `401` を返したら、それをそのままユーザーに返します。

これは怠慢ではありません。責任の境界を明確にするための判断です。Gateway が credential を検証した瞬間、Gateway は認可の責任を引き受けます。中小企業向けの public Federation Gateway が、7 本の child MCP すべての認可を引き受ける設計は、最初のインシデントで破綻します。

ヘッダの抽出は 1 ループ、解決は 4 段の nullish coalescing、監査ログには SHA-256 の 16 文字だけ。pass-through の実装は小さく見えます。しかしその小ささが、Gateway が「財務データを中継するが、財務データに触らない」ことを可能にしています。

封を破らないことが、配達員の信用です。

---

## References

- 全景記事（Zenn）: [日本の公的データと業務SaaSを束ねるPublic MCP Gatewayを作りました](https://zenn.dev/sugukuru_labs/articles/public-mcp-jp-gateway)
- ADR-0021: [MoneyForward Cloud Accounting MCP Integration](https://github.com/sugukurukabe/koko-call-mcp/blob/main/docs/adr/0021-moneyforward-accounting-mcp-integration.md)
- ADR-0019: [Approval and Compliance Policy](https://github.com/sugukurukabe/koko-call-mcp/blob/main/docs/adr/0019-approval-and-compliance-policy.md)
- GMO Banking private connector policy: [docs/public-mcp-hub/gmo-banking-private-connector.md](https://github.com/sugukurukabe/koko-call-mcp/blob/main/docs/public-mcp-hub/gmo-banking-private-connector.md)
- gateway/src/server.ts: [ヘッダ抽出ロジック（L101-L118）](https://github.com/sugukurukabe/koko-call-mcp/blob/main/gateway/src/server.ts#L101-L118)
- gateway/src/tools/call-registered-mcp.ts: [トークン解決優先順（L137-L144）](https://github.com/sugukurukabe/koko-call-mcp/blob/main/gateway/src/tools/call-registered-mcp.ts#L137-L144)
- gateway/src/audit/audit-logger.ts: [AuditEvent interface](https://github.com/sugukurukabe/koko-call-mcp/blob/main/gateway/src/audit/audit-logger.ts)
- gateway/tests/proxy/header-passthrough.spec.ts: [pass-through テスト](https://github.com/sugukurukabe/koko-call-mcp/blob/main/gateway/tests/proxy/header-passthrough.spec.ts)
- Model Context Protocol: [https://modelcontextprotocol.io](https://modelcontextprotocol.io)
- MoneyForward Cloud Accounting MCP: [https://developers.biz.moneyforward.com/mcp/](https://developers.biz.moneyforward.com/mcp/)
