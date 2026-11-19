# JP Bids Edge Gateway (Cloudflare Worker)

Cloudflare（`bid-jp.com` / `mcp.bid-jp.com`）上で稼働する自己修繕・利用データ分析・ユーザー反応収集ゲートウェイです。
Self-healing edge gateway, zero-latency usage analytics (Workers Analytics Engine), and sanitized user feedback collection (D1 + Turnstile) for `https://mcp.bid-jp.com`.

> 詳細な設計理由・本番カットオーバー記録・9つの落とし穴と解決策・他案件横展開ガイド・運用 SQL クエリ集は [docs/cloudflare-edge-mcp-playbook.md](../../docs/cloudflare-edge-mcp-playbook.md) を参照してください。

## Architecture Safeguards

1. **OAuth Rate Limit Isolation**: Attaches verified `X-Jpbids-Edge-Auth` + daily-salted `X-Jpbids-Client-Ip-Hash` (`SHA-256(CF-Connecting-IP + salt + YYYY-MM-DD)`) so Cloud Run (`src/oauth/router.ts`) enforces per-client OAuth rate limits without ever storing raw IP addresses or sharing a single Cloudflare PoP bucket.
2. **Strict 3-Class Retry Policy**:
   - **Class A (`stale-if-error` KV fallback + 1x retry)**: `GET /.well-known/*`, `/health`, `/llms*.txt`, `/privacy`, `/terms`, `/`.
   - **Class B (1x 250ms retry on 502/503/504)**: `GET /readyz` and non-KKJ local MCP metadata methods (`initialize`, `ping`, `tools/list`, `resources/list`, `resources/read`, `prompts/list`).
   - **Class C (NO edge retry)**: All `/oauth/*` endpoints (prevents refresh-token reuse revocation) and `POST /mcp` (`tools/call`, `prompts/get` — KKJ retries remain centralized inside Cloud Run `KkjClient` under `1 req/sec`).
3. **Zero-PII Telemetry & Feedback**:
   - Cloud Run emits `X-Jpbids-*` headers only when `X-Jpbids-Edge-Auth` matches `JP_BIDS_EDGE_AUTH_SECRET`.
   - The Worker records non-PII counters into Workers Analytics Engine via `ctx.waitUntil()` and strips all `X-Jpbids-*` headers before returning the response to clients.
   - `POST /feedback` sanitizes JWTs, API keys, emails, and phone numbers before writing to Cloudflare D1.

## Deployment Steps

```bash
cd workers/jp-bids-edge-gateway

# 1. Create D1 database and KV namespace (replace IDs in wrangler.toml)
npx wrangler d1 create jp-bids-feedback
npx wrangler kv namespace create STATE_KV

# 2. Apply D1 schema migration
npx wrangler d1 migrations apply jp-bids-feedback --remote

# 3. Configure secrets (generate a strong random EDGE_AUTH_SECRET and set the same value as JP_BIDS_EDGE_AUTH_SECRET in Cloud Run Secret Manager)
npx wrangler secret put EDGE_AUTH_SECRET
npx wrangler secret put IP_HASH_SALT
npx wrangler secret put SLACK_BOT_TOKEN
npx wrangler secret put SLACK_CHANNEL_ID
# Optional: Turnstile bot protection for POST /feedback
npx wrangler secret put TURNSTILE_SECRET_KEY

# 4. Deploy Worker to mcp.bid-jp.com/*
npx wrangler deploy
```
