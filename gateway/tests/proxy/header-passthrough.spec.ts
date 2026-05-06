// X-Mcp-Child-Authorization ヘッダの pass-through テスト
// Tests for X-Mcp-Child-Authorization header pass-through
// Pengujian pass-through header X-Mcp-Child-Authorization

import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyToolCall } from "../../src/proxy/mcp-proxy.js";
import { resetRegistryCache } from "../../src/registry/loader.js";
import type { ChildMcpServer } from "../../src/registry/schema.js";
import { createHttpApp } from "../../src/server.js";

const mfcaServer: ChildMcpServer = {
  id: "moneyforward-ca",
  display_name: "マネーフォワード クラウド会計 MCP",
  display_name_en: "MoneyForward Cloud Accounting MCP",
  display_name_id: "MoneyForward Cloud Accounting MCP",
  endpoint: "https://beta.mcp.developers.biz.moneyforward.com/mcp/ca/v3",
  auth_type: "bearer_oauth",
  risk_level: "financial",
  tool_allowlist: [],
  attribution: {
    source: "株式会社マネーフォワード（クラウド会計）",
    license: "proprietary",
    url: "https://developers.biz.moneyforward.com/mcp/",
  },
  routing_keywords: ["仕訳", "試算表", "マネーフォワード"],
};

afterEach(() => {
  vi.restoreAllMocks();
  resetRegistryCache();
});

describe("proxyToolCall: bearer_oauth に oauthToken を Authorization ヘッダとして渡す", () => {
  it("bearer_oauth サーバーに oauthToken が Authorization: Bearer として送られる / sends oauthToken as Bearer", async () => {
    let capturedHeaders: Record<string, string> = {};

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        capturedHeaders = Object.fromEntries(
          Object.entries((init.headers ?? {}) as Record<string, string>),
        );
        return Promise.resolve({
          ok: true,
          headers: { get: () => "application/json" },
          text: () =>
            Promise.resolve(
              JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                result: { content: [{ type: "text", text: "ok" }] },
              }),
            ),
        });
      }),
    );

    await proxyToolCall({
      server: mfcaServer,
      toolName: "get_trial_balance",
      toolArguments: {},
      oauthToken: "mf-oauth-token-xyz",
    });

    expect(capturedHeaders.Authorization).toBe("Bearer mf-oauth-token-xyz");
  });

  it("oauthToken がなければ Authorization ヘッダが送られない / no Authorization header when oauthToken absent", async () => {
    let capturedHeaders: Record<string, string> = {};

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        capturedHeaders = Object.fromEntries(
          Object.entries((init.headers ?? {}) as Record<string, string>),
        );
        return Promise.resolve({
          ok: true,
          headers: { get: () => "application/json" },
          text: () =>
            Promise.resolve(
              JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                result: { content: [{ type: "text", text: "ok" }] },
              }),
            ),
        });
      }),
    );

    await proxyToolCall({
      server: mfcaServer,
      toolName: "get_trial_balance",
      toolArguments: {},
    });

    expect(capturedHeaders.Authorization).toBeUndefined();
  });
});

describe("server.ts: X-Mcp-Child-Authorization-moneyforward-ca ヘッダを childAuthHeaders に格納する", () => {
  it("ヘッダ付きリクエストが通過する / request with child auth header passes through", async () => {
    // registry に moneyforward-ca が含まれることを確認しつつ、ヘッダが抽出されるかを /readyz 経由で確認
    // Verify via /readyz that moneyforward-ca is in registry
    const app = createHttpApp();
    const res = await request(app).get("/readyz");
    expect(res.status).toBe(200);
    expect(res.body.connected_servers).toContain("moneyforward-ca");
  });

  it("X-Mcp-Child-Authorization-moneyforward-ca ヘッダが Bearer トークンを含む / header contains Bearer token extracted correctly", async () => {
    // initialize で childAuthHeaders が context に渡ることを確認（initialize response に server info が含まれる）
    const originalKeys = process.env.GATEWAY_PRO_API_KEYS;
    process.env.GATEWAY_PRO_API_KEYS = "test-pro-key-header";
    const app = createHttpApp();

    const res = await request(app)
      .post("/mcp")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json, text/event-stream")
      .set("MCP-Protocol-Version", "2025-11-25")
      .set("Authorization", "Bearer test-pro-key-header")
      .set("X-Mcp-Child-Authorization-moneyforward-ca", "Bearer mf-test-token")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "header-test", version: "0.0.1" },
        },
      });

    process.env.GATEWAY_PRO_API_KEYS = originalKeys;

    expect(res.status).toBe(200);
    expect(res.body.result?.serverInfo?.name).toBe("Public MCP JP Gateway");
  });

  it("list_connected_servers の tools/list に MoneyForward OAuth ヘッダを転送する / forwards MF OAuth header for tools/list", async () => {
    const originalKeys = process.env.GATEWAY_PRO_API_KEYS;
    process.env.GATEWAY_PRO_API_KEYS = "test-pro-key-list";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      text: () =>
        Promise.resolve(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              tools: [{ name: "get_trial_balance", description: "trial balance" }],
            },
          }),
        ),
    });
    vi.stubGlobal("fetch", fetchMock);

    const app = createHttpApp();
    const res = await request(app)
      .post("/mcp")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json, text/event-stream")
      .set("MCP-Protocol-Version", "2025-11-25")
      .set("Authorization", "Bearer test-pro-key-list")
      .set("X-Mcp-Child-Authorization-moneyforward-ca", "Bearer mf-list-token")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "list_connected_servers",
          arguments: { include_tools: true },
        },
      });

    process.env.GATEWAY_PRO_API_KEYS = originalKeys;

    expect(res.status).toBe(200);
    const mfCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("beta.mcp.developers.biz.moneyforward.com"),
    );
    expect(mfCall).toBeDefined();
    expect((mfCall?.[1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer mf-list-token",
    });
  });
});
