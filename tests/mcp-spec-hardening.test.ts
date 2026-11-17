import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { JSONRPCErrorResponseSchema } from "@modelcontextprotocol/sdk/types.js";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KkjClient } from "../src/api/kkj-client.js";
import { createJpBidsServer } from "../src/mcp.js";
import { signJwt, verifyJwt } from "../src/oauth/jwt.js";
import { createHttpApp } from "../src/transports/http.js";

const BASE_URL = "https://mcp.test";
const REDIRECT_URI = "http://localhost/callback";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function requestMeta(version: string) {
  return {
    "io.modelcontextprotocol/protocolVersion": version,
    "io.modelcontextprotocol/clientInfo": { name: "hardening-suite", version: "1.0.0" },
    "io.modelcontextprotocol/clientCapabilities": {},
  };
}

describe("MCP v0.10.1 specification, protocol adapter & security hardening", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      JP_BIDS_BASE_URL: BASE_URL,
      JP_BIDS_OAUTH_SECRET: "test-oauth-secret-with-at-least-32-bytes",
      JP_BIDS_OAUTH_STORE: "memory",
      JP_BIDS_PRO_API_KEYS: "jp-bids.test.key",
      JP_BIDS_OAUTH_RATE_LIMIT_MAX: "100",
      JP_BIDS_PROFILE: "public_mvp",
      JP_BIDS_DOCUMENT_EXTRACTION: "off",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("sets Cache-Control: no-store and Pragma: no-cache on /oauth/token responses", async () => {
    const app = createHttpApp();
    const regResponse = await request(app)
      .post("/oauth/register")
      .send({ client_name: "Hardening Client", redirect_uris: [REDIRECT_URI] })
      .expect(201);
    const clientId = (regResponse.body as { client_id: string }).client_id;
    const verifier = "pkce-verifier-for-cache-control-test-12345";

    const authPost = await request(app)
      .post("/oauth/authorize")
      .type("form")
      .send({
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        state: "st1",
        scope: "mcp:read",
        code_challenge: challengeFor(verifier),
        code_challenge_method: "S256",
        action: "allow",
        resource: `${BASE_URL}/mcp`,
      })
      .expect(302);

    const redirectLocation = authPost.headers.location ?? "";
    const code = new URL(redirectLocation).searchParams.get("code") ?? "";
    expect(code.length).toBeGreaterThan(10);

    const tokenRes = await request(app)
      .post("/oauth/token")
      .type("form")
      .send({
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
      })
      .expect(200);

    expect(tokenRes.headers["cache-control"]).toBe("no-store");
    expect(tokenRes.headers.pragma).toBe("no-cache");

    const refreshToken = (tokenRes.body as { refresh_token: string }).refresh_token;
    const refreshRes = await request(app)
      .post("/oauth/token")
      .type("form")
      .send({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      })
      .expect(200);

    expect(refreshRes.headers["cache-control"]).toBe("no-store");
    expect(refreshRes.headers.pragma).toBe("no-cache");
  });

  it("supports authenticated MCP 2026-07-28 positive controls (P01 tools/list, P02 resources/read via params.uri, prompts/list, prompts/get, tools/call)", async () => {
    const app = createHttpApp();
    const secret = process.env.JP_BIDS_OAUTH_SECRET ?? "";
    const token = signJwt(
      {
        sub: "hardening-user",
        iss: BASE_URL,
        aud: `${BASE_URL}/mcp`,
        scope: "mcp:read",
        type: "access_token",
      },
      secret,
      300,
    );

    // P01: 2026-07-28 tools/list positive control -> 200 with 7 public_mvp tools
    const p01 = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", `Bearer ${token}`)
      .set("MCP-Protocol-Version", "2026-07-28")
      .set("Mcp-Method", "tools/list")
      .send({
        jsonrpc: "2.0",
        id: "P01",
        method: "tools/list",
        params: { _meta: requestMeta("2026-07-28") },
      })
      .expect(200);
    expect(p01.headers["mcp-protocol-version"]).toBe("2026-07-28");
    const p01Tools = (p01.body as { result?: { tools?: Array<{ name: string }> } }).result?.tools;
    expect(p01Tools?.length).toBe(7);

    // P02: 2026-07-28 resources/read with Mcp-Name === params.uri -> 200 with 1 content item
    const p02 = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", `Bearer ${token}`)
      .set("MCP-Protocol-Version", "2026-07-28")
      .set("Mcp-Method", "resources/read")
      .set("Mcp-Name", "ui://jp-bids/search-results.html")
      .send({
        jsonrpc: "2.0",
        id: "P02",
        method: "resources/read",
        params: {
          uri: "ui://jp-bids/search-results.html",
          _meta: requestMeta("2026-07-28"),
        },
      })
      .expect(200);
    expect(p02.headers["mcp-protocol-version"]).toBe("2026-07-28");
    const p02Contents = (p02.body as { result?: { contents?: unknown[] } }).result?.contents;
    expect(p02Contents?.length).toBe(1);

    // A07: Base64 sentinel Mcp-Name on resources/read -> 200
    const b64Sentinel = `=?base64?${Buffer.from("ui://jp-bids/search-results.html", "utf8").toString("base64")}?=`;
    const a07 = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", `Bearer ${token}`)
      .set("MCP-Protocol-Version", "2026-07-28")
      .set("Mcp-Method", "resources/read")
      .set("Mcp-Name", b64Sentinel)
      .send({
        jsonrpc: "2.0",
        id: "A07",
        method: "resources/read",
        params: {
          uri: "ui://jp-bids/search-results.html",
          _meta: requestMeta("2026-07-28"),
        },
      })
      .expect(200);
    expect((a07.body as { result?: { contents?: unknown[] } }).result?.contents?.length).toBe(1);

    // 2026-07-28 prompts/get with Mcp-Name === params.name -> 200
    const promptRes = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", `Bearer ${token}`)
      .set("MCP-Protocol-Version", "2026-07-28")
      .set("Mcp-Method", "prompts/get")
      .set("Mcp-Name", "morning_bid_briefing")
      .send({
        jsonrpc: "2.0",
        id: "P-PROMPT",
        method: "prompts/get",
        params: {
          name: "morning_bid_briefing",
          arguments: { prefecture: "東京都" },
          _meta: requestMeta("2026-07-28"),
        },
      })
      .expect(200);
    expect(
      (promptRes.body as { result?: { messages?: unknown[] } }).result?.messages?.length,
    ).toBeGreaterThanOrEqual(1);

    // 2026-07-28 tools/call (offline UserInputError validation path, 0 KKJ calls) with Mcp-Name === params.name -> 200
    const toolCallRes = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", `Bearer ${token}`)
      .set("MCP-Protocol-Version", "2026-07-28")
      .set("Mcp-Method", "tools/call")
      .set("Mcp-Name", "search_bids")
      .send({
        jsonrpc: "2.0",
        id: "P-TOOL",
        method: "tools/call",
        params: {
          name: "search_bids",
          arguments: {},
          _meta: requestMeta("2026-07-28"),
        },
      })
      .expect(200);
    expect((toolCallRes.body as { result?: { isError?: boolean } }).result?.isError).toBe(true);
  });

  it("enforces distinct MCP 2026-07-28 negative controls (P03, P04, P05, metadata, stateless, batch, version, auth)", async () => {
    const app = createHttpApp();
    const secret = process.env.JP_BIDS_OAUTH_SECRET ?? "";
    const token = signJwt(
      {
        sub: "hardening-user",
        iss: BASE_URL,
        aud: `${BASE_URL}/mcp`,
        scope: "mcp:read",
        type: "access_token",
      },
      secret,
      300,
    );

    // P03: missing Mcp-Name on resources/read -> 400 JSON-RPC -32020 (MissingRequiredHeader)
    const p03 = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", `Bearer ${token}`)
      .set("MCP-Protocol-Version", "2026-07-28")
      .set("Mcp-Method", "resources/read")
      .send({
        jsonrpc: "2.0",
        id: "P03",
        method: "resources/read",
        params: {
          uri: "ui://jp-bids/search-results.html",
          _meta: requestMeta("2026-07-28"),
        },
      })
      .expect(400);
    expect(JSONRPCErrorResponseSchema.parse(p03.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "P03",
      error: {
        code: -32020,
        data: {
          reason: "MissingRequiredHeader",
          required_header: "Mcp-Name",
          expected_source: "params.uri",
        },
      },
    });

    // A04 / P04: header 2026-07-28 vs _meta 2025-11-25 -> 400 JSON-RPC -32020 (HeaderMismatch)
    const p04 = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", `Bearer ${token}`)
      .set("MCP-Protocol-Version", "2026-07-28")
      .set("Mcp-Method", "tools/list")
      .send({
        jsonrpc: "2.0",
        id: "A04",
        method: "tools/list",
        params: { _meta: requestMeta("2025-11-25") },
      })
      .expect(400);
    expect(JSONRPCErrorResponseSchema.parse(p04.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "A04",
      error: {
        code: -32020,
        data: {
          reason: "HeaderMismatch",
          header_protocol_version: "2026-07-28",
          meta_protocol_version: "2025-11-25",
        },
      },
    });

    // A05 / P05: missing Mcp-Method on 2026-07-28 -> 400 JSON-RPC -32020 (MissingRequiredHeader)
    const p05 = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", `Bearer ${token}`)
      .set("MCP-Protocol-Version", "2026-07-28")
      .send({
        jsonrpc: "2.0",
        id: "A05",
        method: "tools/list",
        params: { _meta: requestMeta("2026-07-28") },
      })
      .expect(400);
    expect(JSONRPCErrorResponseSchema.parse(p05.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "A05",
      error: {
        code: -32020,
        data: {
          reason: "MissingRequiredHeader",
          required_header: "Mcp-Method",
        },
      },
    });

    // A06: unknown RPC method -> HTTP 404 + valid JSON-RPC -32601
    const a06 = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", `Bearer ${token}`)
      .set("MCP-Protocol-Version", "2026-07-28")
      .set("Mcp-Method", "nonexistent/method")
      .send({
        jsonrpc: "2.0",
        id: "A06",
        method: "nonexistent/method",
        params: { _meta: requestMeta("2026-07-28") },
      })
      .expect(404);
    expect(JSONRPCErrorResponseSchema.parse(a06.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "A06",
      error: {
        code: -32601,
      },
    });

    // Malformed Base64 sentinel -> 400 JSON-RPC -32020 (HeaderMismatch)
    const badSentinel = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", `Bearer ${token}`)
      .set("MCP-Protocol-Version", "2026-07-28")
      .set("Mcp-Method", "resources/read")
      .set("Mcp-Name", "=?base64?not-valid-base64!!!?=")
      .send({
        jsonrpc: "2.0",
        id: "A07-BAD",
        method: "resources/read",
        params: {
          uri: "ui://jp-bids/search-results.html",
          _meta: requestMeta("2026-07-28"),
        },
      })
      .expect(400);
    expect(JSONRPCErrorResponseSchema.parse(badSentinel.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "A07-BAD",
      error: { code: -32020, data: { reason: "HeaderMismatch" } },
    });

    // Missing _meta protocolVersion -> 400 JSON-RPC -32020 (MissingProtocolMetadata)
    const missingMeta = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", `Bearer ${token}`)
      .set("MCP-Protocol-Version", "2026-07-28")
      .set("Mcp-Method", "tools/list")
      .send({ jsonrpc: "2.0", id: "P08", method: "tools/list", params: {} })
      .expect(400);
    expect(JSONRPCErrorResponseSchema.parse(missingMeta.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "P08",
      error: { code: -32020, data: { reason: "MissingProtocolMetadata" } },
    });

    // Removed initialize handshake on 2026-07-28 -> 400 JSON-RPC -32020 (StatelessProtocolViolation)
    const init2026 = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", `Bearer ${token}`)
      .set("MCP-Protocol-Version", "2026-07-28")
      .set("Mcp-Method", "initialize")
      .send({
        jsonrpc: "2.0",
        id: "P-INIT",
        method: "initialize",
        params: { _meta: requestMeta("2026-07-28") },
      })
      .expect(400);
    expect(JSONRPCErrorResponseSchema.parse(init2026.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "P-INIT",
      error: { code: -32020, data: { reason: "StatelessProtocolViolation" } },
    });

    // Unsupported version -> 400 JSON-RPC -32020 (UnsupportedProtocolVersion)
    const badVer = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", `Bearer ${token}`)
      .set("MCP-Protocol-Version", "1999-01-01")
      .send({ jsonrpc: "2.0", id: "P09", method: "tools/list", params: {} })
      .expect(400);
    expect(JSONRPCErrorResponseSchema.parse(badVer.body)).toMatchObject({
      jsonrpc: "2.0",
      id: "P09",
      error: { code: -32020, data: { reason: "UnsupportedProtocolVersion" } },
    });

    // Invalid auth on valid 2026-07-28 request -> 401 invalid_token
    const badAuth = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", "Bearer forged-invalid-token")
      .set("MCP-Protocol-Version", "2026-07-28")
      .set("Mcp-Method", "tools/list")
      .send({
        jsonrpc: "2.0",
        id: "P10",
        method: "tools/list",
        params: { _meta: requestMeta("2026-07-28") },
      })
      .expect(401);
    expect(badAuth.body).toMatchObject({ error: "invalid_token" });
  });

  it("preserves 2025-11-25 legacy compatibility (L01, L02, L03 with Mcp-Name === params.uri) and rejects header/body mismatches", async () => {
    const app = createHttpApp();

    // L01: 2025-11-25 tools/list without Mcp-Method
    const l01 = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", "Bearer jp-bids.test.key")
      .set("MCP-Protocol-Version", "2025-11-25")
      .send({ jsonrpc: "2.0", id: "L01", method: "tools/list", params: {} })
      .expect(200);
    expect((l01.body as { result?: { tools?: unknown[] } }).result?.tools?.length).toBe(7);

    // L02: 2025-11-25 resources/read without Mcp-Method/Mcp-Name
    const l02 = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", "Bearer jp-bids.test.key")
      .set("MCP-Protocol-Version", "2025-11-25")
      .send({
        jsonrpc: "2.0",
        id: "L02",
        method: "resources/read",
        params: { uri: "ui://jp-bids/search-results.html" },
      })
      .expect(200);
    expect((l02.body as { result?: { contents?: unknown[] } }).result?.contents?.length).toBe(1);

    // L03: 2025-11-25 resources/read WITH optional Mcp-Method and Mcp-Name === params.uri -> 200
    const l03 = await request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Authorization", "Bearer jp-bids.test.key")
      .set("MCP-Protocol-Version", "2025-11-25")
      .set("Mcp-Method", "resources/read")
      .set("Mcp-Name", "ui://jp-bids/search-results.html")
      .send({
        jsonrpc: "2.0",
        id: "L03",
        method: "resources/read",
        params: { uri: "ui://jp-bids/search-results.html" },
      })
      .expect(200);
    expect((l03.body as { result?: { contents?: unknown[] } }).result?.contents?.length).toBe(1);

    // Batch array with Mcp-Method -> 400 JSON-RPC -32020 (HeaderMismatch)
    const batchRes = await request(app)
      .post("/mcp")
      .set("Mcp-Method", "tools/list")
      .send([{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_bids" } }])
      .expect(400);
    expect(JSONRPCErrorResponseSchema.parse(batchRes.body)).toMatchObject({
      jsonrpc: "2.0",
      error: {
        code: -32020,
        message: "Mcp-Method header does not match JSON-RPC method",
        data: {
          reason: "HeaderMismatch",
          header_method: "tools/list",
          body_method: null,
        },
      },
    });

    // Unnamed method with Mcp-Name -> 400 JSON-RPC -32020 (HeaderMismatch)
    const unnamedWithName = await request(app)
      .post("/mcp")
      .set("Mcp-Method", "tools/list")
      .set("Mcp-Name", "search_bids")
      .send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })
      .expect(400);
    expect(JSONRPCErrorResponseSchema.parse(unnamedWithName.body)).toMatchObject({
      jsonrpc: "2.0",
      id: 2,
      error: {
        code: -32020,
        data: {
          reason: "HeaderMismatch",
          header_name: "search_bids",
          body_name: null,
        },
      },
    });
  });

  it("returns 405 Method Not Allowed on DELETE /mcp for stateless Streamable HTTP", async () => {
    const app = createHttpApp();
    const res = await request(app).delete("/mcp").expect(405);
    expect(res.body).toEqual({
      error: "Session termination is not enabled for this stateless server",
    });
  });

  it("enforces localhost Host header validation in local mode to prevent DNS rebinding", async () => {
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.JP_BIDS_BASE_URL;
    const app = createHttpApp();

    await request(app).get("/health").set("Host", "localhost:8080").expect(200);
    await request(app).get("/health").set("Host", "127.0.0.1:8080").expect(200);
    await request(app).get("/health").set("Host", "[::1]:8080").expect(200);

    const rebindRes = await request(app)
      .post("/mcp")
      .set("Host", "evil.rebind.attacker.example:8080")
      .send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })
      .expect(403);
    expect(rebindRes.body).toEqual({ error: "Host header is not allowed" });
  });

  it("suppresses legacy JP_BIDS_PRO_API_KEYS warning when profile is public_mvp", () => {
    delete process.env.JP_BIDS_PRO_API_KEYS;
    process.env.JP_BIDS_PROFILE = "public_mvp";
    process.env.K_SERVICE = "jp-bids-mcp";
    process.env.ALLOWED_ORIGINS = "https://claude.ai";
    process.env.JP_BIDS_PDF_ALLOWED_HOSTS = "www.kkj.go.jp";
    process.env.JP_BIDS_OAUTH_STORE = "firestore";

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    createHttpApp();

    const proKeyWarnings = errorSpy.mock.calls.filter((call) =>
      String(call[0]).includes("JP_BIDS_PRO_API_KEYS is unset"),
    );
    expect(proKeyWarnings).toEqual([]);
  });

  it("uses UserInputError in analyze_past_awards when filters are missing without logging to stderr", async () => {
    const kkjClient = new KkjClient({
      rateLimitPerSecond: 1000,
      fetchImpl: async () => new Response("<Results><SearchResults /></Results>", { status: 200 }),
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ kkjClient, profile: "full_local" });
    const client = new Client({ name: "hardening-test", version: "0.10.1" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await client.callTool({
      name: "analyze_past_awards",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();

    await client.close();
    await server.close();
  });

  it("derives a domain-separated HMAC subkey for save_search and watch_listed_awards state tokens", async () => {
    delete process.env.JP_BIDS_STATE_TOKEN_SECRET;
    const rawOAuthSecret = "shared-oauth-secret-for-subkey-derivation-test";
    process.env.JP_BIDS_OAUTH_SECRET = rawOAuthSecret;
    const expectedSubkey = createHmac("sha256", rawOAuthSecret)
      .update("jp-bids-state-token-v1")
      .digest("hex");

    const xml = [
      "<Results><SearchResults><SearchHits>1</SearchHits><SearchResult>",
      "<ResultId>1</ResultId><Key>KKJ-WATCH-001</Key><ProjectName>富士通クラウド構築</ProjectName>",
      "</SearchResult></SearchResults></Results>",
    ].join("");
    const kkjClient = new KkjClient({
      rateLimitPerSecond: 1000,
      fetchImpl: async () => new Response(xml, { status: 200 }),
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ kkjClient, profile: "full_local" });
    const client = new Client({ name: "subkey-test", version: "0.10.1" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const saveRes = await client.callTool({
      name: "save_search",
      arguments: { name: "CloudCheck", query: "クラウド" },
    });
    const savedSc = saveRes.structuredContent as { stateToken: string };
    expect(verifyJwt(savedSc.stateToken, rawOAuthSecret)).toBeNull();
    expect(verifyJwt(savedSc.stateToken, expectedSubkey)?.type).toBe("saved_search_state");

    const checkRes = await client.callTool({
      name: "check_saved_search",
      arguments: { name: "CloudCheck", state_token: savedSc.stateToken },
    });
    expect(checkRes.isError).not.toBe(true);

    const watchSave = await client.callTool({
      name: "watch_listed_awards",
      arguments: { action: "save", name: "FujitsuWatch", query: "6702" },
    });
    const watchSc = watchSave.structuredContent as { stateToken: string };
    expect(verifyJwt(watchSc.stateToken, rawOAuthSecret)).toBeNull();
    expect(verifyJwt(watchSc.stateToken, expectedSubkey)?.type).toBe("listed_award_watch");

    const watchCheck = await client.callTool({
      name: "watch_listed_awards",
      arguments: { action: "check", name: "FujitsuWatch", state_token: watchSc.stateToken },
    });
    expect(watchCheck.isError).not.toBe(true);

    await client.close();
    await server.close();
  });

  it("nests custom interoperability metadata under _meta in server.json at version 0.10.1", async () => {
    const serverJson = JSON.parse(
      await readFile(path.join(REPO_ROOT, "server.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(serverJson.version).toBe("0.10.1");
    expect("interoperability" in serverJson).toBe(false);
    const meta = serverJson._meta as Record<string, unknown> | undefined;
    const ns = meta?.["io.github.sugukurukabe/jp-bids"] as Record<string, unknown> | undefined;
    expect(ns?.interoperability).toBeDefined();
  });
});
