import { describe, expect, it } from "vitest";
import {
  classifyRequestPolicy,
  detectClientFamily,
  renderFeedbackPageHtml,
  sanitizeFeedbackText,
  stripInternalTelemetryHeaders,
} from "../workers/jp-bids-edge-gateway/src/core.js";

describe("Cloudflare jp-bids-edge-gateway core logic", () => {
  it("enforces strict 3-class retry safety (never retries /oauth/* or tools/call)", () => {
    // Class A: cacheable discovery & static metadata
    expect(classifyRequestPolicy("GET", "/.well-known/mcp/server-card.json")).toBe(
      "class_a_cacheable",
    );
    expect(classifyRequestPolicy("GET", "/.well-known/oauth-authorization-server")).toBe(
      "class_a_cacheable",
    );
    expect(classifyRequestPolicy("GET", "/health")).toBe("class_a_cacheable");
    expect(classifyRequestPolicy("GET", "/privacy")).toBe("class_a_cacheable");

    // Class B: idempotent local MCP metadata methods & readyz
    expect(classifyRequestPolicy("GET", "/readyz")).toBe("class_b_idempotent");
    expect(classifyRequestPolicy("POST", "/mcp", "initialize")).toBe("class_b_idempotent");
    expect(classifyRequestPolicy("POST", "/mcp", "tools/list")).toBe("class_b_idempotent");
    expect(classifyRequestPolicy("POST", "/mcp", "resources/read")).toBe("class_b_idempotent");

    // Class C: MUST NEVER retry at edge (OAuth single-use token revocation & KKJ rate limit)
    expect(classifyRequestPolicy("POST", "/oauth/token")).toBe("class_c_no_retry");
    expect(classifyRequestPolicy("POST", "/oauth/authorize")).toBe("class_c_no_retry");
    expect(classifyRequestPolicy("POST", "/oauth/register")).toBe("class_c_no_retry");
    expect(classifyRequestPolicy("POST", "/mcp", "tools/call")).toBe("class_c_no_retry");
    expect(classifyRequestPolicy("POST", "/mcp", "prompts/get")).toBe("class_c_no_retry");
  });

  it("sanitizes JWTs, Bearer tokens, API keys, emails, and phone numbers", () => {
    const fakeJwt = `eyJhbGciOiJIUzI1NiJ9.${"a".repeat(20)}.${"b".repeat(20)}`;
    const fakeKey = `jp-bids.${"c".repeat(16)}`;
    const raw = `Contact user@example.com or 090-1234-5678 Bearer ${fakeJwt} key ${fakeKey}`;
    const sanitized = sanitizeFeedbackText(raw);

    expect(sanitized).not.toContain("user@example.com");
    expect(sanitized).not.toContain("090-1234-5678");
    expect(sanitized).not.toContain(fakeJwt);
    expect(sanitized).not.toContain(fakeKey);
    expect(sanitized).toContain("[REDACTED_EMAIL]");
    expect(sanitized).toContain("[REDACTED_PHONE]");
    expect(sanitized).toContain("[REDACTED_TOKEN]");
    expect(sanitized).toContain("[REDACTED_KEY]");
  });

  it("detects MCP client families from User-Agent", () => {
    expect(detectClientFamily("Claude-User/1.0")).toBe("claude");
    expect(detectClientFamily("ChatGPT-User/1.0")).toBe("chatgpt");
    expect(detectClientFamily("Cursor/0.50")).toBe("cursor");
    expect(detectClientFamily("curl/8.7.1")).toBe("cli");
    expect(detectClientFamily("Mozilla/5.0 Chrome/131.0")).toBe("browser");
    expect(detectClientFamily(null)).toBe("other");
  });

  it("extracts and strips all internal X-Jpbids-* headers before returning to client", () => {
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Jpbids-Rpc-Method": "tools/call",
      "X-Jpbids-Target-Name": "search_bids",
      "X-Jpbids-Mode": "search",
      "X-Jpbids-Outcome": "zero_hits",
      "X-Jpbids-Returned-Count": "0",
    });

    const snapshot = stripInternalTelemetryHeaders(headers, "POST", 200);
    expect(snapshot).toEqual({
      rpcMethod: "tools/call",
      targetName: "search_bids",
      executionMode: "search",
      outcome: "zero_hits",
      returnedCount: 0,
    });
    expect(headers.get("x-jpbids-rpc-method")).toBeNull();
    expect(headers.get("x-jpbids-target-name")).toBeNull();
    expect(headers.get("x-jpbids-mode")).toBeNull();
    expect(headers.get("x-jpbids-outcome")).toBeNull();
    expect(headers.get("x-jpbids-returned-count")).toBeNull();
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("escapes query parameters in bilingual feedback page HTML", () => {
    const html = renderFeedbackPageHtml({
      tool: 'search_bids"><script>alert(1)</script>',
      context: "workspace",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("JP Bids — フィードバック / Feedback");
  });
});
