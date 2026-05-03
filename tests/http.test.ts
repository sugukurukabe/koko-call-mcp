import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHttpApp } from "../src/transports/http.js";

describe("HTTP transport app", () => {
  it("serves health checks", async () => {
    const response = await request(createHttpApp()).get("/health").expect(200);
    expect(response.body).toEqual({ ok: true, service: "JP Bids MCP" });
  });

  it("serves readiness checks on a custom-domain friendly path", async () => {
    const response = await request(createHttpApp()).get("/readyz").expect(200);
    expect(response.body).toEqual({ ok: true, service: "JP Bids MCP" });
  });

  it("rejects unsupported standalone SSE GET on /mcp", async () => {
    const response = await request(createHttpApp()).get("/mcp").expect(405);
    expect(response.body.error).toContain("SSE GET");
  });

  it("rejects unsupported MCP protocol versions", async () => {
    const response = await request(createHttpApp())
      .post("/mcp")
      .set("MCP-Protocol-Version", "1900-01-01")
      .send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })
      .expect(400);
    expect(response.body).toMatchObject({
      error: "Unsupported MCP protocol version",
      supported: ["2025-11-25"],
    });
  });

  it("serves usage stats on /stats", async () => {
    const response = await request(createHttpApp()).get("/stats").expect(200);
    expect(response.body).toMatchObject({
      service: "JP Bids MCP",
      mcpRequestCount: expect.any(Number),
      uptimeSeconds: expect.any(Number),
      nodeVersion: expect.any(String),
    });
    expect(response.body.startedAt).toBeDefined();
  });

  it("serves landing page on /", async () => {
    const response = await request(createHttpApp()).get("/").expect(200);
    expect(response.headers["content-type"]).toMatch(/html/);
  });
});
