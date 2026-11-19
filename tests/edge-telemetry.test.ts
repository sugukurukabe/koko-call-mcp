import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import {
  classifyMcpResponseTelemetry,
  EDGE_AUTH_HEADER,
  EDGE_CLIENT_IP_HASH_HEADER,
  extractMcpRequestTelemetry,
  isVerifiedEdgeAuth,
  resolveOAuthRateLimitKey,
  TELEMETRY_MODE_HEADER,
  TELEMETRY_OUTCOME_HEADER,
  TELEMETRY_RPC_METHOD_HEADER,
  TELEMETRY_TARGET_NAME_HEADER,
} from "../src/lib/edge-telemetry.js";
import { createHttpApp } from "../src/transports/http.js";

function makeMockReq(headers: Record<string, string | undefined>, ip = "203.0.113.10") {
  const lower = new Map<string, string>();
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) lower.set(key.toLowerCase(), value);
  }
  return {
    ip,
    header(name: string): string | undefined {
      return lower.get(name.toLowerCase());
    },
  };
}

describe("edge-telemetry helpers", () => {
  const origEdgeSecret = process.env.JP_BIDS_EDGE_AUTH_SECRET;
  const origProKeys = process.env.JP_BIDS_PRO_API_KEYS;

  afterEach(() => {
    if (origEdgeSecret === undefined) delete process.env.JP_BIDS_EDGE_AUTH_SECRET;
    else process.env.JP_BIDS_EDGE_AUTH_SECRET = origEdgeSecret;
    if (origProKeys === undefined) delete process.env.JP_BIDS_PRO_API_KEYS;
    else process.env.JP_BIDS_PRO_API_KEYS = origProKeys;
  });

  it("verifies edge auth secret using constant-time digest comparison", () => {
    expect(isVerifiedEdgeAuth("secret-123", "secret-123")).toBe(true);
    expect(isVerifiedEdgeAuth("wrong-secret", "secret-123")).toBe(false);
    expect(isVerifiedEdgeAuth("secret-123", undefined)).toBe(false);
    expect(isVerifiedEdgeAuth(undefined, "secret-123")).toBe(false);
    expect(isVerifiedEdgeAuth("secret-123", "   ")).toBe(false);
  });

  it("isolates OAuth rate-limit buckets by client IP hash for verified edge requests", () => {
    const validHash = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
    const verifiedReq = makeMockReq(
      {
        [EDGE_AUTH_HEADER]: "edge-secret-xyz",
        [EDGE_CLIENT_IP_HASH_HEADER]: validHash.toUpperCase(),
      },
      "172.70.1.1",
    );
    expect(resolveOAuthRateLimitKey(verifiedReq, "edge-secret-xyz")).toBe(
      `oauth:edge:${validHash}`,
    );

    const spoofedReq = makeMockReq(
      {
        [EDGE_AUTH_HEADER]: "wrong-secret",
        [EDGE_CLIENT_IP_HASH_HEADER]: validHash,
      },
      "172.70.1.1",
    );
    expect(resolveOAuthRateLimitKey(spoofedReq, "edge-secret-xyz")).toBe("oauth:172.70.1.1");

    const invalidHashReq = makeMockReq(
      {
        [EDGE_AUTH_HEADER]: "edge-secret-xyz",
        [EDGE_CLIENT_IP_HASH_HEADER]: "not-a-hex-hash!",
      },
      "172.70.1.1",
    );
    expect(resolveOAuthRateLimitKey(invalidHashReq, "edge-secret-xyz")).toBe("oauth:172.70.1.1");
  });

  it("extracts non-PII MCP request telemetry across methods and execution modes", () => {
    expect(
      extractMcpRequestTelemetry({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "search_bids", arguments: { query: "secret user query" } },
      }),
    ).toEqual({
      rpcMethod: "tools/call",
      targetName: "search_bids",
      executionMode: "search",
    });

    expect(
      extractMcpRequestTelemetry({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "export_bid_shortlist", arguments: { bid_refs: ["ref1", "ref2"] } },
      }),
    ).toEqual({
      rpcMethod: "tools/call",
      targetName: "export_bid_shortlist",
      executionMode: "selection_bid_refs",
    });

    expect(
      extractMcpRequestTelemetry({
        jsonrpc: "2.0",
        id: 3,
        method: "resources/read",
        params: { uri: "ui://jp-bids/search-results.html" },
      }),
    ).toEqual({
      rpcMethod: "resources/read",
      targetName: "ui://jp-bids/search-results.html",
      executionMode: "n/a",
    });
  });

  it("classifies MCP response outcomes across ok, zero_hits, and error classes", () => {
    expect(
      classifyMcpResponseTelemetry({
        jsonrpc: "2.0",
        id: 1,
        result: { structuredContent: { bids: [{ key: "1" }, { key: "2" }] } },
      }),
    ).toEqual({ outcome: "ok", returnedCount: 2 });

    expect(
      classifyMcpResponseTelemetry({
        jsonrpc: "2.0",
        id: 2,
        result: { structuredContent: { bids: [] } },
      }),
    ).toEqual({ outcome: "zero_hits", returnedCount: 0 });

    expect(
      classifyMcpResponseTelemetry({
        jsonrpc: "2.0",
        id: 3,
        result: {
          isError: true,
          content: [{ type: "text", text: "The KKJ portal is responding slowly." }],
        },
      }),
    ).toEqual({ outcome: "upstream_kkj_error", returnedCount: 0 });

    expect(
      classifyMcpResponseTelemetry({
        jsonrpc: "2.0",
        id: 4,
        result: { isError: true, content: [{ type: "text", text: "Invalid prefecture" }] },
      }),
    ).toEqual({ outcome: "user_input_error", returnedCount: 0 });

    expect(
      classifyMcpResponseTelemetry({
        jsonrpc: "2.0",
        id: 5,
        error: { code: -32601, message: "Method not found" },
      }),
    ).toEqual({ outcome: "protocol_error", returnedCount: null });
  });

  it("emits X-Jpbids-* headers on POST /mcp only when edge auth is verified", async () => {
    process.env.JP_BIDS_EDGE_AUTH_SECRET = "test-edge-shared-secret";
    process.env.JP_BIDS_PRO_API_KEYS = "test-service-key-001";
    const app = createHttpApp();
    const body = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };

    const directRes = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", "Bearer test-service-key-001")
      .set("MCP-Protocol-Version", "2025-11-25")
      .send(body);

    expect(directRes.status).toBe(200);
    expect(directRes.headers[TELEMETRY_RPC_METHOD_HEADER.toLowerCase()]).toBeUndefined();
    expect(directRes.headers[TELEMETRY_OUTCOME_HEADER.toLowerCase()]).toBeUndefined();

    const edgeRes = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", "Bearer test-service-key-001")
      .set("MCP-Protocol-Version", "2025-11-25")
      .set(EDGE_AUTH_HEADER, "test-edge-shared-secret")
      .send(body);

    expect(edgeRes.status).toBe(200);
    expect(edgeRes.headers[TELEMETRY_RPC_METHOD_HEADER.toLowerCase()]).toBe("tools/list");
    expect(edgeRes.headers[TELEMETRY_TARGET_NAME_HEADER.toLowerCase()]).toBe("none");
    expect(edgeRes.headers[TELEMETRY_MODE_HEADER.toLowerCase()]).toBe("n/a");
    expect(edgeRes.headers[TELEMETRY_OUTCOME_HEADER.toLowerCase()]).toBe("ok");
  });
});
