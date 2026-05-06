// LLM フォールバックルーターのユニットテスト
// Unit tests for LLM fallback router
// Pengujian unit untuk router fallback LLM

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildMcpServer } from "../../src/registry/schema.js";
import { routeViaLlm } from "../../src/router/llm-fallback.js";

const mockServers: ChildMcpServer[] = [
  {
    id: "jp-bids",
    display_name: "JP Bids MCP",
    display_name_en: "JP Bids MCP",
    display_name_id: "JP Bids MCP",
    endpoint: "https://mcp.bid-jp.com/mcp",
    auth_type: "bearer_apikey",
    risk_level: "read_only",
    tool_allowlist: [],
    attribution: { source: "KKJ", license: "gov", url: "https://kkj.go.jp" },
    routing_keywords: ["入札", "bid", "procurement"],
  },
  {
    id: "gmo-bank",
    display_name: "GMO Banking",
    display_name_en: "GMO Banking",
    display_name_id: "GMO Banking",
    endpoint: "http://localhost:8090",
    auth_type: "bearer_apikey",
    risk_level: "financial",
    tool_allowlist: [],
    attribution: { source: "GMO", license: "proprietary", url: "https://gmo-aozora.com" },
    routing_keywords: ["振込", "残高", "銀行"],
  },
];

beforeEach(() => {
  process.env.GATEWAY_ROUTER_LLM_FALLBACK = "true";
  process.env.ANTHROPIC_API_KEY = "test-key";
});

afterEach(() => {
  delete process.env.GATEWAY_ROUTER_LLM_FALLBACK;
  delete process.env.ANTHROPIC_API_KEY;
  vi.restoreAllMocks();
});

describe("routeViaLlm", () => {
  it("GATEWAY_ROUTER_LLM_FALLBACK が false なら null を返す / returns null when disabled", async () => {
    process.env.GATEWAY_ROUTER_LLM_FALLBACK = "false";
    const result = await routeViaLlm("口座残高を確認したい", mockServers);
    expect(result).toBeNull();
  });

  it("ANTHROPIC_API_KEY が未設定なら null を返す / returns null when API key missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await routeViaLlm("口座残高を確認したい", mockServers);
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("ANTHROPIC_API_KEY"));
  });

  it("Anthropic が有効なサーバー ID を返せばルーティング結果になる / routes when Anthropic returns valid server ID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: '"gmo-bank"' }],
        }),
      }),
    );

    const result = await routeViaLlm("今月の口座残高は？", mockServers);
    expect(result).not.toBeNull();
    expect(result?.serverId).toBe("gmo-bank");
    expect(result?.reason).toContain("llm-fallback");
  });

  it('Anthropic が "null" を返せば null になる / returns null when Anthropic returns "null"', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "null" }],
        }),
      }),
    );

    const result = await routeViaLlm("全く関係ないクエリ xyz", mockServers);
    expect(result).toBeNull();
  });

  it("2 回目の同じクエリはキャッシュヒットする（fetch 呼ばれない）/ caches result for same query", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: '"jp-bids"' }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const uniqueQuery = `cached-query-${Date.now()}`;
    await routeViaLlm(uniqueQuery, mockServers);
    await routeViaLlm(uniqueQuery, mockServers);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("Anthropic API エラーなら null を返す / returns null on Anthropic API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await routeViaLlm("なんでも", mockServers);
    expect(result).toBeNull();
  });
});
