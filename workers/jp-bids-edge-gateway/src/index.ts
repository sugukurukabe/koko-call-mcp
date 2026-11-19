import {
  classifyRequestPolicy,
  detectClientFamily,
  renderFeedbackPageHtml,
  sanitizeFeedbackText,
  stripInternalTelemetryHeaders,
} from "./core.js";
import type { CloudflareRequest, ExecutionContext, GatewayEnv, ScheduledEvent } from "./types.js";

const RETRY_DELAY_MS = 250;
const STALE_CACHE_PREFIX = "stale_cache:";
const CIRCUIT_OPEN_KEY = "kkj_circuit_open_until";
const CIRCUIT_ERR_COUNT_KEY = "kkj_upstream_err_count";
const PROBE_FAIL_COUNT_KEY = "probe_consecutive_failures";

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractRpcMethodFromText(rawBody: string): { rpcMethod?: string; id: unknown } {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    return {
      rpcMethod: typeof parsed.method === "string" ? parsed.method : undefined,
      id: parsed.id ?? null,
    };
  } catch {
    return { id: null };
  }
}

async function verifyTurnstileToken(
  token: string,
  secret: string,
  remoteIp: string | null,
): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

async function postSlackBotMessage(env: GatewayEnv, text: string): Promise<void> {
  if (!env.SLACK_BOT_TOKEN || !env.SLACK_CHANNEL_ID) return;
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: env.SLACK_CHANNEL_ID,
      text,
    }),
  });
}

async function recordSelfHealingEvent(
  env: GatewayEnv,
  eventType: string,
  severity: "info" | "warn" | "critical",
  target: string,
  detail: Record<string, unknown>,
): Promise<void> {
  if (!env.FEEDBACK_DB) return;
  await env.FEEDBACK_DB.prepare(
    "INSERT INTO self_healing_events (id, created_at, event_type, severity, target, detail_json) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(
      crypto.randomUUID(),
      new Date().toISOString(),
      eventType,
      severity,
      target,
      JSON.stringify(detail),
    )
    .run();
}

async function handleFeedbackRequest(
  request: CloudflareRequest,
  env: GatewayEnv,
  url: URL,
): Promise<Response> {
  if (request.method === "GET") {
    const html = renderFeedbackPageHtml({
      tool: url.searchParams.get("tool") ?? "general",
      context: url.searchParams.get("ctx") ?? "web",
      ...(env.TURNSTILE_SITE_KEY ? { turnstileSiteKey: env.TURNSTILE_SITE_KEY } : {}),
    });
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  if (env.TURNSTILE_SECRET_KEY) {
    const token =
      typeof body["cf-turnstile-response"] === "string" ? body["cf-turnstile-response"] : "";
    const ok = await verifyTurnstileToken(
      token,
      env.TURNSTILE_SECRET_KEY,
      request.headers.get("CF-Connecting-IP"),
    );
    if (!ok) {
      return new Response(JSON.stringify({ error: "turnstile_failed" }), {
        status: 403,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
  }

  const allowedCategories = new Set(["helpful", "zero_hits", "feature", "bug"]);
  const rawCategory = typeof body.category === "string" ? body.category : "helpful";
  const category = allowedCategories.has(rawCategory) ? rawCategory : "helpful";
  const rawRating = Number.parseInt(String(body.rating ?? "5"), 10);
  const rating = Number.isFinite(rawRating) ? Math.min(5, Math.max(1, rawRating)) : 5;
  const toolName =
    typeof body.tool === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(body.tool)
      ? body.tool
      : "general";
  const context =
    typeof body.context === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(body.context)
      ? body.context
      : "web";
  const lang = request.headers.get("Accept-Language")?.slice(0, 16) ?? "unknown";
  const messageSanitized = sanitizeFeedbackText(
    typeof body.message === "string" ? body.message : "",
  );
  const country = request.cf?.country ?? "XX";
  const clientFamily = detectClientFamily(request.headers.get("User-Agent"));

  if (env.FEEDBACK_DB) {
    await env.FEEDBACK_DB.prepare(
      "INSERT INTO user_feedback (id, created_at, category, rating, tool_name, context, lang, message_sanitized, country, client_family) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        crypto.randomUUID(),
        new Date().toISOString(),
        category,
        rating,
        toolName,
        context,
        lang,
        messageSanitized,
        country,
        clientFamily,
      )
      .run();
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 201,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function runSyntheticProbe(env: GatewayEnv): Promise<void> {
  const originBase = env.PUBLIC_BASE_URL.replace(/\/$/, "");
  let healthy = false;
  let statusSummary = "unknown";
  try {
    const [readyRes, cardRes] = await Promise.all([
      fetch(`${originBase}/readyz`, { headers: { "User-Agent": "jp-bids-edge-probe/1.0" } }),
      fetch(`${originBase}/.well-known/mcp/server-card.json`, {
        headers: { "User-Agent": "jp-bids-edge-probe/1.0" },
      }),
    ]);
    healthy = readyRes.ok && cardRes.ok;
    statusSummary = `readyz=${readyRes.status}, server_card=${cardRes.status}`;
  } catch (error) {
    statusSummary = error instanceof Error ? error.message : String(error);
  }

  if (!env.STATE_KV) return;
  if (healthy) {
    await env.STATE_KV.delete(PROBE_FAIL_COUNT_KEY);
    return;
  }

  const prev = Number.parseInt((await env.STATE_KV.get(PROBE_FAIL_COUNT_KEY)) ?? "0", 10);
  const nextCount = (Number.isFinite(prev) ? prev : 0) + 1;
  await env.STATE_KV.put(PROBE_FAIL_COUNT_KEY, String(nextCount), { expirationTtl: 3600 });
  await recordSelfHealingEvent(
    env,
    "synthetic_probe_failed",
    nextCount >= 3 ? "critical" : "warn",
    originBase,
    {
      consecutiveFailures: nextCount,
      statusSummary,
    },
  );
  if (nextCount >= 3) {
    await postSlackBotMessage(
      env,
      `:rotating_light: *JP Bids MCP Health Alert* (${nextCount} consecutive failures)\nEndpoint: ${originBase}\nDetail: ${statusSummary}\nVerify Cloud Run revision & consider rollback to last known good revision.`,
    );
  }
}

async function runWeeklyDigest(env: GatewayEnv): Promise<void> {
  if (!env.FEEDBACK_DB) return;
  const sinceIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const feedbackRows = await env.FEEDBACK_DB.prepare(
    "SELECT category, COUNT(*) AS cnt, ROUND(AVG(rating), 2) AS avg_rating FROM user_feedback WHERE created_at >= ? GROUP BY category",
  )
    .bind(sinceIso)
    .all<{ category: string; cnt: number; avg_rating: number }>();

  const healingRows = await env.FEEDBACK_DB.prepare(
    "SELECT event_type, COUNT(*) AS cnt FROM self_healing_events WHERE created_at >= ? GROUP BY event_type",
  )
    .bind(sinceIso)
    .all<{ event_type: string; cnt: number }>();

  const feedbackSummary =
    feedbackRows.results.length > 0
      ? feedbackRows.results
          .map((r) => `- ${r.category}: ${r.cnt}件 (avg ${r.avg_rating}/5)`)
          .join("\n")
      : "- 新着フィードバック 0件";

  const healingSummary =
    healingRows.results.length > 0
      ? healingRows.results.map((r) => `- ${r.event_type}: ${r.cnt}回`).join("\n")
      : "- 異常・自己修繕イベント 0件";

  await postSlackBotMessage(
    env,
    `:bar_chart: *JP Bids MCP 週次レポート / Weekly Digest*\n*Feedback (past 7d)*\n${feedbackSummary}\n\n*Self-Healing Events (past 7d)*\n${healingSummary}`,
  );
}

export default {
  async fetch(
    request: CloudflareRequest,
    env: GatewayEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const startMs = Date.now();
    const url = new URL(request.url);

    if (url.pathname === "/feedback") {
      return handleFeedbackRequest(request, env, url);
    }

    const rawBody =
      request.method === "POST" && url.pathname === "/mcp" ? await request.text() : undefined;
    const parsedRpc = rawBody
      ? extractRpcMethodFromText(rawBody)
      : { rpcMethod: undefined, id: null };
    const rpcMethod = request.headers.get("Mcp-Method") ?? parsedRpc.rpcMethod;
    const retryClass = classifyRequestPolicy(request.method, url.pathname, rpcMethod);

    // Tier 1 Self-Healing: KKJ Circuit Breaker on tools/call when upstream 5xx spiked
    if (url.pathname === "/mcp" && rpcMethod === "tools/call" && env.STATE_KV) {
      const openUntilRaw = await env.STATE_KV.get(CIRCUIT_OPEN_KEY);
      const openUntil = openUntilRaw ? Number.parseInt(openUntilRaw, 10) : 0;
      if (Number.isFinite(openUntil) && openUntil > Date.now()) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: parsedRpc.id,
            result: {
              isError: true,
              content: [
                {
                  type: "text",
                  text: "官公需情報ポータル（kkj.go.jp）側の一時的な高負荷を検知したため保護モード中です。30秒ほど待ってから同じ条件で再実行してください。 Upstream KKJ instability detected; edge circuit breaker active. Wait 30 seconds and retry.",
                },
              ],
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          },
        );
      }
    }

    const originUrl = new URL(url.pathname + url.search, env.ORIGIN_URL);
    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.set("Host", originUrl.host);
    forwardHeaders.set("X-Forwarded-Host", url.host);
    forwardHeaders.set("X-Forwarded-Proto", "https");

    if (env.EDGE_AUTH_SECRET) {
      forwardHeaders.set("X-Jpbids-Edge-Auth", env.EDGE_AUTH_SECRET);
      const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const dayUtc = new Date().toISOString().slice(0, 10);
      const salt = env.IP_HASH_SALT ?? env.EDGE_AUTH_SECRET;
      const ipHash = await sha256Hex(`${clientIp}:${salt}:${dayUtc}`);
      forwardHeaders.set("X-Jpbids-Client-Ip-Hash", ipHash);
    }

    const doOriginFetch = () => {
      const forwardBody =
        rawBody !== undefined
          ? rawBody
          : request.method === "GET" || request.method === "HEAD"
            ? undefined
            : request.body;
      return fetch(originUrl.toString(), {
        method: request.method,
        headers: forwardHeaders,
        body: forwardBody,
        redirect: "manual",
      });
    };

    let originRes: Response;
    try {
      originRes = await doOriginFetch();
      if (
        (retryClass === "class_a_cacheable" || retryClass === "class_b_idempotent") &&
        (originRes.status === 502 || originRes.status === 503 || originRes.status === 504)
      ) {
        await sleep(RETRY_DELAY_MS);
        originRes = await doOriginFetch();
      }
    } catch {
      if (retryClass === "class_a_cacheable" && env.STATE_KV) {
        const cached = await env.STATE_KV.get(`${STALE_CACHE_PREFIX}${url.pathname}`);
        if (cached) {
          return new Response(cached, {
            status: 200,
            headers: {
              "Content-Type": url.pathname.endsWith(".json")
                ? "application/json; charset=utf-8"
                : "text/plain; charset=utf-8",
              "X-Jpbids-Edge-Fallback": "stale-if-error",
            },
          });
        }
      }
      return new Response(JSON.stringify({ error: "origin_unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const responseHeaders = new Headers(originRes.headers);
    const telemetry = stripInternalTelemetryHeaders(
      responseHeaders,
      rpcMethod ?? request.method,
      originRes.status,
    );

    const responseBody = await originRes.arrayBuffer();

    // Refresh stale-if-error KV snapshot for Class A public metadata/health endpoints
    if (retryClass === "class_a_cacheable" && originRes.status === 200 && env.STATE_KV) {
      const textSnapshot = new TextDecoder().decode(responseBody);
      ctx.waitUntil(
        env.STATE_KV.put(`${STALE_CACHE_PREFIX}${url.pathname}`, textSnapshot, {
          expirationTtl: 86400,
        }),
      );
    }

    // Track upstream KKJ failures for circuit breaker protection
    if (telemetry.outcome === "upstream_kkj_error" && env.STATE_KV) {
      const threshold = parseIntEnv(env.CIRCUIT_BREAKER_THRESHOLD, 5);
      const windowSec = parseIntEnv(env.CIRCUIT_BREAKER_WINDOW_SEC, 60);
      const openSec = parseIntEnv(env.CIRCUIT_BREAKER_OPEN_SEC, 30);
      ctx.waitUntil(
        (async () => {
          const prev = Number.parseInt((await env.STATE_KV?.get(CIRCUIT_ERR_COUNT_KEY)) ?? "0", 10);
          const next = (Number.isFinite(prev) ? prev : 0) + 1;
          await env.STATE_KV?.put(CIRCUIT_ERR_COUNT_KEY, String(next), {
            expirationTtl: windowSec,
          });
          if (next >= threshold) {
            await env.STATE_KV?.put(CIRCUIT_OPEN_KEY, String(Date.now() + openSec * 1000), {
              expirationTtl: openSec + 10,
            });
            await recordSelfHealingEvent(env, "kkj_circuit_opened", "warn", url.pathname, {
              errorCount: next,
              openSeconds: openSec,
            });
          }
        })(),
      );
    }

    // Zero-latency telemetry write to Cloudflare Workers Analytics Engine
    if (env.TELEMETRY) {
      const latencyMs = Date.now() - startMs;
      const clientFamily = detectClientFamily(request.headers.get("User-Agent"));
      const protocolVersion = request.headers.get("MCP-Protocol-Version") ?? "none";
      const country = request.cf?.country ?? "XX";
      ctx.waitUntil(
        Promise.resolve().then(() => {
          env.TELEMETRY?.writeDataPoint({
            blobs: [
              telemetry.rpcMethod,
              telemetry.targetName,
              telemetry.executionMode,
              clientFamily,
              protocolVersion,
              telemetry.outcome,
              country,
            ],
            doubles: [latencyMs, originRes.status, telemetry.returnedCount],
            indexes: [telemetry.targetName],
          });
        }),
      );
    }

    return new Response(responseBody, {
      status: originRes.status,
      statusText: originRes.statusText,
      headers: responseHeaders,
    });
  },

  async scheduled(event: ScheduledEvent, env: GatewayEnv, ctx: ExecutionContext): Promise<void> {
    if (event.cron === "0 0 * * MON" || event.cron === "0 0 * * 2") {
      ctx.waitUntil(runWeeklyDigest(env));
      return;
    }
    ctx.waitUntil(runSyntheticProbe(env));
  },
};
