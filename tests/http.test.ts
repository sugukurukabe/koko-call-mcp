import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHttpApp } from "../src/transports/http.js";

describe("HTTP transport app", () => {
  it("serves health checks", async () => {
    const response = await request(createHttpApp()).get("/healthz").expect(200);
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
});
