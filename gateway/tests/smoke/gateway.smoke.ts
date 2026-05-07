// Gateway smoke test — MCP Inspector 相当の基本動作確認
// Gateway smoke test — Basic operation check equivalent to MCP Inspector
// Uji asap Gateway — Pemeriksaan operasi dasar setara MCP Inspector

import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHttpApp } from "../../src/server.js";

describe("Gateway smoke test", () => {
  it("GET /health returns 200 with ok: true", async () => {
    const app = createHttpApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, service: "Public MCP JP Gateway" });
  });

  it("GET /readyz returns 200 with connected_servers", async () => {
    const app = createHttpApp();
    const res = await request(app).get("/readyz");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.connected_servers)).toBe(true);
    expect(res.body.connected_servers).toContain("jp-bids");
    expect(res.body.connected_servers).toContain("jgrants");
    expect(res.body.connected_servers).toContain("agriops");
    expect(res.body.connected_servers).toContain("freee");
    expect(res.body.connected_servers).toContain("moneyforward-ca");
    expect(res.body.connected_servers).toContain("houjin-bangou");
    expect(res.body.connected_servers).not.toContain("gmo-bank");
  });

  it("GET /mcp returns 405", async () => {
    const app = createHttpApp();
    const res = await request(app).get("/mcp");
    expect(res.status).toBe(405);
  });

  it("POST /mcp with initialize returns server info", async () => {
    const app = createHttpApp();
    const res = await request(app)
      .post("/mcp")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json, text/event-stream")
      .set("MCP-Protocol-Version", "2025-11-25")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "smoke-test", version: "0.0.1" },
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
    expect(res.body.result.serverInfo.name).toBe("Public MCP JP Gateway");
  });

  it("POST /mcp tools/list without auth returns only free gateway tools", async () => {
    const app = createHttpApp();

    const toolsRes = await request(app)
      .post("/mcp")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json, text/event-stream")
      .set("MCP-Protocol-Version", "2025-11-25")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      });
    expect(toolsRes.status).toBe(200);
    const toolNames = (toolsRes.body.result?.tools ?? []).map((t: { name: string }) => t.name);
    expect(toolNames).toContain("get_gateway_demo");
    expect(toolNames).toContain("list_connected_servers");
    expect(toolNames).toContain("search_public_opportunities");
    expect(toolNames).toContain("suggest_next_actions");
    expect(toolNames).not.toContain("analyze_funding_fit");
    expect(toolNames).not.toContain("call_registered_mcp");
    expect(toolNames).not.toContain("get_audit_events");
  });

  it("POST /mcp tools/list with Pro auth returns all gateway tools", async () => {
    const originalKeys = process.env.GATEWAY_PRO_API_KEYS;
    process.env.GATEWAY_PRO_API_KEYS = "test-pro-key";
    const app = createHttpApp();

    const toolsRes = await request(app)
      .post("/mcp")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json, text/event-stream")
      .set("MCP-Protocol-Version", "2025-11-25")
      .set("Authorization", "Bearer test-pro-key")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      });
    process.env.GATEWAY_PRO_API_KEYS = originalKeys;

    expect(toolsRes.status).toBe(200);
    const toolNames = (toolsRes.body.result?.tools ?? []).map((t: { name: string }) => t.name);
    expect(toolNames).toContain("get_gateway_demo");
    expect(toolNames).toContain("list_connected_servers");
    expect(toolNames).toContain("search_public_opportunities");
    expect(toolNames).toContain("analyze_funding_fit");
    expect(toolNames).toContain("call_registered_mcp");
    expect(toolNames).toContain("get_audit_events");
    expect(toolNames).toContain("issue_approval_token");
  });

  it("POST /mcp tools/list with Pro auth includes issue_approval_token", async () => {
    const originalKeys = process.env.GATEWAY_PRO_API_KEYS;
    process.env.GATEWAY_PRO_API_KEYS = "test-pro-key";
    const app = createHttpApp();

    const toolsRes = await request(app)
      .post("/mcp")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json, text/event-stream")
      .set("MCP-Protocol-Version", "2025-11-25")
      .set("Authorization", "Bearer test-pro-key")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      });
    process.env.GATEWAY_PRO_API_KEYS = originalKeys;

    expect(toolsRes.status).toBe(200);
    const toolNames = (toolsRes.body.result?.tools ?? []).map((t: { name: string }) => t.name);
    expect(toolNames).toContain("issue_approval_token");
    expect(toolNames).not.toContain("gmo_bank_transfer");
  });

  it("POST /mcp get_gateway_demo returns guided monthly close flow", async () => {
    const app = createHttpApp();

    const res = await request(app)
      .post("/mcp")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json, text/event-stream")
      .set("MCP-Protocol-Version", "2025-11-25")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "get_gateway_demo",
          arguments: { scenario: "monthly_close" },
        },
      });

    expect(res.status).toBe(200);
    const text = res.body.result?.content?.[0]?.text;
    expect(text).toContain("MoneyForward Cloud Accounting");
    expect(text).toContain("search_public_opportunities");
    expect(text).toContain("issue_approval_token");
  });
});
