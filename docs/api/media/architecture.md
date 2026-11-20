# Architecture

## 日本語

JP Bids MCP は、MCPのプリミティブを薄く保ち、KKJ API固有の処理を `api` と `domain` に閉じ込めます。

```mermaid
flowchart TD
  client[ClaudeCursorChatGPT] --> edge[CloudflareEdgeGateway]
  edge --> transport[CloudRunStreamableHttp]
  client -. stdio .-> transport
  transport --> mcp[McpServerFactory]
  mcp --> tools[Tools]
  mcp --> prompts[Prompts]
  mcp --> resources[ResourcesAndTemplates]
  mcp --> completion[Completion]
  tools --> domain[DomainSchemas]
  resources --> domain
  completion --> domain
  domain --> api[KkjClient]
  api --> upstream[KkjApi]
```

依存方向は `server -> mcp -> primitives -> api/domain -> lib` です。逆方向の依存は作りません。

本番環境（`https://mcp.bid-jp.com`）では、Cloud Run の前段に Cloudflare Workers エッジゲートウェイ（`workers/jp-bids-edge-gateway`）を配置し、3区分自己修復・KKJ サーキットブレーカー・非 PII の Workers Analytics Engine テレメトリ・日次ソルト付きクライアント IP ハッシュによる OAuth レート制限分離・Turnstile + D1 による `/feedback` 窓口を運用しています（詳細: [`cloudflare-edge-mcp-playbook.md`](./cloudflare-edge-mcp-playbook.md)）。

`org://{organization_name}` や `bid://{bid_key}` のような動的Resource Templateは、LLMに巨大な検索結果を渡すのではなく、必要なコンテキストだけを読み取り専用で提供するために使います。現行の remote 版では OAuth 2.0 を提供し、Tasks と server-side Sampling は長時間処理やサーバー側 LLM 呼び出しの実需要が出た時点で検討します。

## English

JP Bids MCP keeps MCP primitives thin and isolates KKJ-specific logic in `api` and `domain`.

The dependency direction is `server -> mcp -> primitives -> api/domain -> lib`. Reverse dependencies are not allowed.

In production (`https://mcp.bid-jp.com`), a Cloudflare Workers edge gateway (`workers/jp-bids-edge-gateway`) fronts Cloud Run to provide 3-class self-healing, a KKJ circuit breaker, non-PII Workers Analytics Engine telemetry, daily-salted client IP-hash OAuth rate-limit isolation, and the Turnstile + D1 `/feedback` endpoint (see [`cloudflare-edge-mcp-playbook.md`](./cloudflare-edge-mcp-playbook.md)).

Dynamic Resource Templates such as `org://{organization_name}` and `bid://{bid_key}` provide only the context the model needs, instead of dumping large result sets into the context window. The current remote server provides OAuth 2.0; Tasks and server-side Sampling remain deferred until long-running workflows or server-side LLM calls justify them.

## Bahasa Indonesia

JP Bids MCP menjaga primitive MCP tetap tipis dan mengisolasi logika khusus KKJ di `api` dan `domain`.

Arah dependensi adalah `server -> mcp -> primitives -> api/domain -> lib`. Dependensi terbalik tidak diperbolehkan.

Di produksi (`https://mcp.bid-jp.com`), Cloudflare Workers edge gateway (`workers/jp-bids-edge-gateway`) berada di depan Cloud Run untuk menyediakan self-healing 3 kelas, pemutus sirkuit KKJ, telemetri non-PII Workers Analytics Engine, isolasi rate-limit OAuth berbasis hash IP harian, serta formulir `/feedback` dengan Turnstile + D1 (lihat [`cloudflare-edge-mcp-playbook.md`](./cloudflare-edge-mcp-playbook.md)).

Resource Template dinamis seperti `org://{organization_name}` dan `bid://{bid_key}` menyediakan hanya konteks yang dibutuhkan model, bukan seluruh hasil pencarian besar. Server remote saat ini menyediakan OAuth 2.0; Tasks dan Sampling sisi server tetap ditunda sampai ada kebutuhan proses panjang atau pemanggilan LLM sisi server.
