export type RetryClass = "class_a_cacheable" | "class_b_idempotent" | "class_c_no_retry";

export type ClientFamily =
  | "claude"
  | "chatgpt"
  | "cursor"
  | "mcp-inspector"
  | "cli"
  | "browser"
  | "other";

export interface TelemetrySnapshot {
  rpcMethod: string;
  targetName: string;
  executionMode: string;
  outcome: string;
  returnedCount: number;
}

const CACHEABLE_EXACT_PATHS = new Set([
  "/",
  "/health",
  "/llms.txt",
  "/llms-full.txt",
  "/privacy",
  "/terms",
  "/ogp.png",
  "/favicon.ico",
  "/favicon.png",
  "/robots.txt",
]);

const IDEMPOTENT_LOCAL_MCP_METHODS = new Set([
  "initialize",
  "notifications/initialized",
  "ping",
  "tools/list",
  "resources/list",
  "resources/templates/list",
  "prompts/list",
  "resources/read",
  "completion/complete",
]);

const INTERNAL_TELEMETRY_HEADERS = [
  "x-jpbids-rpc-method",
  "x-jpbids-target-name",
  "x-jpbids-mode",
  "x-jpbids-outcome",
  "x-jpbids-returned-count",
] as const;

export function classifyRequestPolicy(
  method: string,
  pathname: string,
  rpcMethod?: string,
): RetryClass {
  const upperMethod = method.toUpperCase();

  // OAuth endpoints MUST NEVER be retried at the edge to prevent refresh-token reuse revocation.
  if (pathname.startsWith("/oauth/")) {
    return "class_c_no_retry";
  }

  if (upperMethod === "GET" || upperMethod === "HEAD") {
    if (pathname.startsWith("/.well-known/") || CACHEABLE_EXACT_PATHS.has(pathname)) {
      return "class_a_cacheable";
    }
    if (pathname === "/readyz") {
      return "class_b_idempotent";
    }
    return "class_c_no_retry";
  }

  if (upperMethod === "POST" && pathname === "/mcp") {
    if (rpcMethod && IDEMPOTENT_LOCAL_MCP_METHODS.has(rpcMethod)) {
      return "class_b_idempotent";
    }
    // tools/call and prompts/get may invoke upstream KKJ API (retried safely inside KkjClient).
    return "class_c_no_retry";
  }

  return "class_c_no_retry";
}

export function detectClientFamily(userAgent: string | null): ClientFamily {
  if (!userAgent) return "other";
  const ua = userAgent.toLowerCase();
  if (ua.includes("claude")) return "claude";
  if (ua.includes("chatgpt") || ua.includes("openai")) return "chatgpt";
  if (ua.includes("cursor")) return "cursor";
  if (ua.includes("inspector")) return "mcp-inspector";
  if (
    ua.includes("curl") ||
    ua.includes("node") ||
    ua.includes("undici") ||
    ua.includes("python")
  ) {
    return "cli";
  }
  if (ua.includes("mozilla/") || ua.includes("chrome/") || ua.includes("safari/")) {
    return "browser";
  }
  return "other";
}

export function sanitizeFeedbackText(input: string): string {
  return input
    .trim()
    .slice(0, 1000)
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[REDACTED_TOKEN]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{8,}=*/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/\b(?:sk_live|sk_test|ghp|gho|AIza)[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_KEY]")
    .replace(/\bjp-bids\.[A-Za-z0-9._-]{8,}\b/g, "[REDACTED_KEY]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[REDACTED_EMAIL]")
    .replace(/(?:\+?81[-\s]?|0)\d{1,4}[-\s]?\d{2,4}[-\s]?\d{3,4}/g, "[REDACTED_PHONE]");
}

export function stripInternalTelemetryHeaders(
  headers: Headers,
  fallbackMethod: string,
  httpStatus: number,
): TelemetrySnapshot {
  const rpcMethod = headers.get("x-jpbids-rpc-method") ?? fallbackMethod;
  const targetName = headers.get("x-jpbids-target-name") ?? "none";
  const executionMode = headers.get("x-jpbids-mode") ?? "n/a";
  const defaultOutcome =
    httpStatus === 401
      ? "oauth_401"
      : httpStatus >= 500
        ? "server_5xx"
        : httpStatus >= 400
          ? "client_4xx"
          : "ok";
  const outcome = headers.get("x-jpbids-outcome") ?? defaultOutcome;
  const rawCount = headers.get("x-jpbids-returned-count");
  const parsedCount = rawCount !== null ? Number.parseInt(rawCount, 10) : -1;
  const returnedCount = Number.isFinite(parsedCount) && parsedCount >= 0 ? parsedCount : -1;

  for (const name of INTERNAL_TELEMETRY_HEADERS) {
    headers.delete(name);
  }

  return {
    rpcMethod,
    targetName,
    executionMode,
    outcome,
    returnedCount,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderFeedbackPageHtml(params: {
  tool: string;
  context: string;
  turnstileSiteKey?: string;
}): string {
  const safeTool = escapeHtml(params.tool.slice(0, 64));
  const safeCtx = escapeHtml(params.context.slice(0, 64));
  const turnstileScript = params.turnstileSiteKey
    ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>'
    : "";
  const turnstileWidget = params.turnstileSiteKey
    ? `<div class="cf-turnstile" data-sitekey="${escapeHtml(params.turnstileSiteKey)}"></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>JP Bids MCP — ご意見・フィードバック / Feedback</title>
${turnstileScript}
<style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:2.5rem auto;padding:0 1.25rem;color:#111827;line-height:1.6}
h1{font-size:1.4rem;margin:0 0 .25rem}
.sub{color:#4b5563;font-size:.9rem;margin:0 0 1.5rem}
label{display:block;font-weight:600;margin:1rem 0 .35rem;font-size:.9rem}
select,textarea,button{width:100%;font:inherit;border-radius:8px;box-sizing:border-box}
select,textarea{padding:.65rem .75rem;border:1px solid #d1d5db}
textarea{min-height:110px;resize:vertical}
button{margin-top:1.25rem;padding:.75rem;background:#2563eb;color:#fff;border:none;font-weight:600;cursor:pointer}
button:hover{background:#1d4ed8}
.note{margin-top:1rem;font-size:.8rem;color:#6b7280}
#status{margin-top:1rem;font-size:.9rem;font-weight:600}
</style>
</head>
<body>
<h1>JP Bids — フィードバック / Feedback</h1>
<p class="sub">改善・機能要望・検索結果に関するご意見をお寄せください。<br>Share your experience, feature requests, or bug reports.</p>
<form id="fb-form">
  <input type="hidden" name="tool" value="${safeTool}">
  <input type="hidden" name="context" value="${safeCtx}">
  <label for="category">種別 / Category</label>
  <select id="category" name="category">
    <option value="helpful">役に立った / Helpful</option>
    <option value="zero_hits">0件・検索しにくい / Hard to find notices</option>
    <option value="feature">機能要望 / Feature request</option>
    <option value="bug">不具合報告 / Bug report</option>
  </select>
  <label for="rating">満足度 / Rating (1-5)</label>
  <select id="rating" name="rating">
    <option value="5">5 - とても良い / Great</option>
    <option value="4">4 - 良い / Good</option>
    <option value="3">3 - 普通 / Okay</option>
    <option value="2">2 - 改善が必要 / Needs work</option>
    <option value="1">1 - 使いにくい / Poor</option>
  </select>
  <label for="message">詳細（任意・個人情報やトークンは記入しないでください） / Details (Optional, no PII or tokens)</label>
  <textarea id="message" name="message" maxlength="1000" placeholder="例: ○○県のIT案件を探したが件名がヒットしなかった / e.g. Wanted to filter by prefecture..."></textarea>
  ${turnstileWidget}
  <button type="submit">送信する / Submit</button>
</form>
<div id="status" role="status"></div>
<p class="note">※ 送信内容は自動的にトークン・連絡先等のマスク処理を行ったうえで製品改善のみに利用します。<br>Submitted text is automatically sanitized for tokens/PII and used solely to improve JP Bids MCP.</p>
<script>
document.getElementById("fb-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById("status");
  statusEl.textContent = "送信中... / Submitting...";
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  try {
    const res = await fetch("/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      statusEl.textContent = "ありがとうございました！受け付けました。 / Thank you! Feedback recorded.";
      e.target.reset();
    } else {
      statusEl.textContent = "送信に失敗しました。時間をおいてお試しください。 / Submission failed.";
    }
  } catch {
    statusEl.textContent = "通信エラーが発生しました。 / Network error.";
  }
});
</script>
</body>
</html>`;
}
