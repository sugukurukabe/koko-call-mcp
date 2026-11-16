import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KkjClient } from "../src/api/kkj-client.js";
import { createJpBidsServer } from "../src/mcp.js";
import { verifyJwt } from "../src/oauth/jwt.js";
import { createHttpApp } from "../src/transports/http.js";

const BASE_URL = "https://mcp.test";
const REDIRECT_URI = "http://localhost/callback";

function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

describe("MCP v0.10.0 specification & security hardening", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      JP_BIDS_BASE_URL: BASE_URL,
      JP_BIDS_OAUTH_SECRET: "test-oauth-secret-with-at-least-32-bytes",
      JP_BIDS_OAUTH_STORE: "memory",
      JP_BIDS_PRO_API_KEYS: "jp-bids.test.key",
      JP_BIDS_OAUTH_RATE_LIMIT_MAX: "100",
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

  it("rejects Mcp-Method and Mcp-Name headers when JSON-RPC body omits method/name or is a batch array", async () => {
    const app = createHttpApp();

    const batchRes = await request(app)
      .post("/mcp")
      .set("Mcp-Method", "tools/list")
      .send([{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_bids" } }])
      .expect(400);
    expect(batchRes.body).toMatchObject({
      error: "Mcp-Method header does not match JSON-RPC method",
      header_method: "tools/list",
      body_method: null,
    });

    const missingNameRes = await request(app)
      .post("/mcp")
      .set("Mcp-Method", "tools/list")
      .set("Mcp-Name", "search_bids")
      .send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })
      .expect(400);
    expect(missingNameRes.body).toMatchObject({
      error: "Mcp-Name header does not match JSON-RPC params.name",
      header_name: "search_bids",
      body_name: null,
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
    const client = new Client({ name: "hardening-test", version: "0.10.0" });
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
    const client = new Client({ name: "subkey-test", version: "0.10.0" });
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

  it("nests custom interoperability metadata under _meta in server.json at version 0.10.0", async () => {
    const serverJson = JSON.parse(await readFile("server.json", "utf8")) as Record<string, unknown>;
    expect(serverJson.version).toBe("0.10.0");
    expect("interoperability" in serverJson).toBe(false);
    const meta = serverJson._meta as Record<string, unknown> | undefined;
    const ns = meta?.["io.github.sugukurukabe/jp-bids"] as Record<string, unknown> | undefined;
    expect(ns?.interoperability).toBeDefined();
  });
});
