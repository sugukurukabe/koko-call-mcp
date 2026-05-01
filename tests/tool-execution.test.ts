import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { KkjClient } from "../src/api/kkj-client.js";
import { createKokoCallServer } from "../src/mcp.js";

describe("MCP tool execution", () => {
  it("executes search_bids and returns structured attribution", async () => {
    const xml = await readFile("tests/fixtures/kkj-search.xml", "utf8");
    const kkjClient = new KkjClient({
      rateLimitPerSecond: 1000,
      fetchImpl: async () => new Response(xml, { status: 200 }),
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createKokoCallServer({ kkjClient });
    const client = new Client({ name: "tool-execution-test", version: "0.1.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "search_bids",
      arguments: {
        query: "システム",
        prefecture: "鹿児島県",
        category: "役務",
        limit: 1,
      },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      searchHits: 1,
      returnedCount: 1,
      attribution: {
        dataSource: "中小企業庁 官公需情報ポータルサイト",
      },
    });

    await client.close();
    await server.close();
  });

  it("returns tool execution errors for missing required search conditions", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createKokoCallServer();
    const client = new Client({ name: "tool-error-test", version: "0.1.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "search_bids",
      arguments: { limit: 1 },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.type).toBe("text");

    await client.close();
    await server.close();
  });

  it("uses recent search cache for get_bid_detail", async () => {
    const xml = await readFile("tests/fixtures/kkj-search.xml", "utf8");
    let fetchCount = 0;
    const kkjClient = new KkjClient({
      rateLimitPerSecond: 1000,
      fetchImpl: async () => {
        fetchCount += 1;
        return new Response(xml, { status: 200 });
      },
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createKokoCallServer({ kkjClient });
    const client = new Client({ name: "detail-cache-test", version: "0.1.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    await client.callTool({
      name: "search_bids",
      arguments: { query: "システム", limit: 1 },
    });
    const detail = await client.callTool({
      name: "get_bid_detail",
      arguments: { bid_key: "KKJ-TEST-001" },
    });

    expect(detail.isError).not.toBe(true);
    expect(detail.structuredContent).toMatchObject({
      returnedCount: 1,
      bids: [{ key: "KKJ-TEST-001" }],
    });
    expect(fetchCount).toBe(1);

    await client.close();
    await server.close();
  });
});
