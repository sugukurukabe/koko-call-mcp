import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHttpApp } from "../src/transports/http.js";

describe("HTTP transport app", () => {
  it("serves health checks", async () => {
    const response = await request(createHttpApp()).get("/healthz").expect(200);
    expect(response.body).toEqual({ ok: true, service: "KokoCallMCP" });
  });

  it("rejects unsupported standalone SSE GET on /mcp", async () => {
    const response = await request(createHttpApp()).get("/mcp").expect(405);
    expect(response.body.error).toContain("SSE GET");
  });
});
