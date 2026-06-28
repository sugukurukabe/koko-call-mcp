/**
 * Anthropic Connectors Directory 審査向けテスト
 * Tests targeting Anthropic Connectors Directory review requirements
 * Tes yang menargetkan persyaratan ulasan Anthropic Connectors Directory
 *
 * Each test corresponds to a specific rejection criterion from:
 * https://claude.com/docs/connectors/building/review-criteria
 */

import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { KkjClient } from "../src/api/kkj-client.js";
import { createJpBidsServer } from "../src/mcp.js";
import { createHttpApp } from "../src/transports/http.js";

// ツール名と期待するアノテーションのマップ
// Map of tool names to expected annotations
// Peta nama alat ke anotasi yang diharapkan
const EXPECTED_TOOL_ANNOTATIONS: Record<
  string,
  { readOnlyHint: boolean; destructiveHint: boolean }
> = {
  search_bids: { readOnlyHint: true, destructiveHint: false },
  search_bids_app: { readOnlyHint: true, destructiveHint: false },
  rank_bids: { readOnlyHint: true, destructiveHint: false },
  list_recent_bids: { readOnlyHint: true, destructiveHint: false },
  get_bid_detail: { readOnlyHint: true, destructiveHint: false },
  explain_bid_fit: { readOnlyHint: true, destructiveHint: false },
  assess_bid_qualification: { readOnlyHint: true, destructiveHint: false },
  extract_bid_requirements: { readOnlyHint: true, destructiveHint: false },
  export_bid_shortlist: { readOnlyHint: true, destructiveHint: false },
  create_bid_calendar: { readOnlyHint: true, destructiveHint: false },
  create_bid_review_packet: { readOnlyHint: true, destructiveHint: false },
  draft_bid_questions: { readOnlyHint: true, destructiveHint: false },
  analyze_past_awards: { readOnlyHint: true, destructiveHint: false },
  summarize_bids_by_org: { readOnlyHint: true, destructiveHint: false },
  // in-memory state mutations
  save_search: { readOnlyHint: false, destructiveHint: false },
  check_saved_search: { readOnlyHint: false, destructiveHint: false },
  list_saved_searches: { readOnlyHint: true, destructiveHint: false },
};

const FREE_TIER_TOOLS = ["search_bids", "rank_bids", "list_recent_bids", "get_bid_detail"];
const EXPECTED_PRO_PROMPTS = [
  "morning_bid_briefing",
  "bid_discovery_workspace",
  "competitor_radar",
  "bid_review_packet_workflow",
  "qualification_and_question_draft",
  "bid_due_alert",
];

interface ServerCardTool {
  name: string;
  title?: string;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
  };
}

interface ServerCard {
  tools: ServerCardTool[];
}

describe("Anthropic review: tool annotations", () => {
  it("all tools have a title (required by Anthropic review)", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer();
    const client = new Client({ name: "annotation-test", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    const missing = tools.filter((t) => !t.title || t.title.trim().length === 0);
    expect(missing.map((t) => t.name)).toEqual([]);

    await client.close();
    await server.close();
  });

  it("all tools have the required readOnlyHint or destructiveHint", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer();
    const client = new Client({ name: "annotation-test", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    for (const tool of tools) {
      const ann = tool.annotations ?? {};
      const hasAnnotation = "readOnlyHint" in ann || "destructiveHint" in ann;
      expect(
        { tool: tool.name, hasAnnotation },
        `${tool.name} must have readOnlyHint or destructiveHint`,
      ).toMatchObject({ hasAnnotation: true });
    }

    await client.close();
    await server.close();
  });

  it("runtime readOnlyHint matches the expected annotation table", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer();
    const client = new Client({ name: "annotation-parity-test", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    for (const tool of tools) {
      const expected = EXPECTED_TOOL_ANNOTATIONS[tool.name];
      if (!expected) continue;
      expect(
        { name: tool.name, readOnlyHint: tool.annotations?.readOnlyHint },
        `${tool.name} readOnlyHint mismatch`,
      ).toMatchObject({ readOnlyHint: expected.readOnlyHint });
    }

    await client.close();
    await server.close();
  });

  it("runtime destructiveHint matches the expected annotation table", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer();
    const client = new Client({ name: "destructive-annotation-test", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    for (const tool of tools) {
      const expected = EXPECTED_TOOL_ANNOTATIONS[tool.name];
      if (!expected) continue;
      expect(
        { name: tool.name, destructiveHint: tool.annotations?.destructiveHint },
        `${tool.name} destructiveHint mismatch`,
      ).toMatchObject({ destructiveHint: expected.destructiveHint });
    }

    await client.close();
    await server.close();
  });

  it("public server-card titles and safety annotations match runtime", async () => {
    const serverCard = JSON.parse(
      await readFile("public/.well-known/mcp/server-card.json", "utf8"),
    ) as ServerCard;
    const cardTools = new Map(serverCard.tools.map((tool) => [tool.name, tool]));

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer();
    const client = new Client({ name: "server-card-parity-test", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    for (const tool of tools) {
      const cardTool = cardTools.get(tool.name);
      expect(cardTool, `${tool.name} missing from server-card.json`).toBeDefined();
      expect(cardTool?.title, `${tool.name} title mismatch`).toBe(tool.title);
      expect(cardTool?.annotations?.readOnlyHint, `${tool.name} readOnlyHint mismatch`).toBe(
        tool.annotations?.readOnlyHint,
      );
      expect(cardTool?.annotations?.destructiveHint, `${tool.name} destructiveHint mismatch`).toBe(
        tool.annotations?.destructiveHint,
      );
    }

    await client.close();
    await server.close();
  });

  it("all tool names are 64 characters or fewer", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer();
    const client = new Client({ name: "name-length-test", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    const tooLong = tools.filter((t) => t.name.length > 64);
    expect(tooLong.map((t) => t.name)).toEqual([]);

    await client.close();
    await server.close();
  });
});

describe("Anthropic review: Free vs Pro tier surface", () => {
  it("Free tier exposes exactly the 4 documented Free tools (no Pro tools)", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ tier: "free" });
    const client = new Client({ name: "free-tier-test", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([...FREE_TIER_TOOLS].sort());

    await client.close();
    await server.close();
  });

  it("Pro tier exposes all 17 tools", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ tier: "pro" });
    const client = new Client({ name: "pro-tier-test", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    expect(tools.length).toBe(17);

    await client.close();
    await server.close();
  });
});

describe("Anthropic review: prompts quality", () => {
  it("Pro tier exposes workflow prompts for discovery, review, qualification, and deadlines", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ tier: "pro" });
    const client = new Client({ name: "prompt-quality-test", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { prompts } = await client.listPrompts();
    expect(prompts.map((prompt) => prompt.name)).toEqual(
      expect.arrayContaining(EXPECTED_PRO_PROMPTS),
    );
    for (const prompt of prompts) {
      expect(prompt.title, `${prompt.name} must have title`).toBeTruthy();
      expect(prompt.description, `${prompt.name} must have description`).toBeTruthy();
    }

    await client.close();
    await server.close();
  });

  it("bid_review_packet_workflow prompt guides safe official-document verification", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ tier: "pro" });
    const client = new Client({ name: "prompt-content-test", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const prompt = await client.getPrompt({
      name: "bid_review_packet_workflow",
      arguments: { bid_key: "KKJ-TEST-001" },
    });
    const text = prompt.messages[0]?.content.type === "text" ? prompt.messages[0].content.text : "";
    expect(text).toContain("get_bid_detail");
    expect(text).toContain("extract_bid_requirements");
    expect(text).toContain("create_bid_review_packet");
    expect(text).toContain("公式公告");

    await client.close();
    await server.close();
  });
});

describe("Anthropic review: HTTP MCP session", () => {
  it("accepts MCP-Protocol-Version 2025-11-25 header (does not return 400)", async () => {
    const app = createHttpApp();
    const response = await request(app)
      .post("/mcp")
      .set("MCP-Protocol-Version", "2025-11-25")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "review-test", version: "0.1.0" },
        },
      });
    expect(response.status).not.toBe(400);
  });

  it("returns 401 with WWW-Authenticate header when Authorization is absent (OAuth challenge)", async () => {
    const app = createHttpApp();
    const response = await request(app)
      .post("/mcp")
      .set("MCP-Protocol-Version", "2025-11-25")
      .send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(response.status).toBe(401);
    expect(response.headers["www-authenticate"]).toBeDefined();
    expect(response.headers["www-authenticate"]).toContain("Bearer");
  });

  it("full MCP session via InMemoryTransport: initialize → tools/list returns 17 Pro tools", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ tier: "pro" });
    const client = new Client({ name: "session-test", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    expect(tools.length).toBe(17);
    expect(tools.map((t) => t.name)).toContain("search_bids");
    expect(tools.map((t) => t.name)).toContain("extract_bid_requirements");

    await client.close();
    await server.close();
  });
});

describe("Anthropic review: get_bid_detail returns resource_link", () => {
  it("returns resource_link content blocks when bid has externalDocumentUri", async () => {
    const kkjClient = new KkjClient({
      rateLimitPerSecond: 1000,
      fetchImpl: async () =>
        new Response(
          [
            "<Results><SearchResults><SearchHits>1</SearchHits><SearchResult>",
            "<ResultId>1</ResultId><Key>KKJ-LINK-001</Key>",
            "<ProjectName>テスト案件</ProjectName>",
            "<ExternalDocumentURI>https://www.kkj.go.jp/bid/KKJ-LINK-001</ExternalDocumentURI>",
            "</SearchResult></SearchResults></Results>",
          ].join(""),
          { status: 200 },
        ),
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ kkjClient });
    const client = new Client({ name: "resource-link-test", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    await kkjClient.search({ Query: "テスト", Count: 1 });

    const result = await client.callTool({
      name: "get_bid_detail",
      arguments: { bid_key: "KKJ-LINK-001" },
    });

    expect(result.isError).not.toBe(true);
    const resourceLinks = result.content.filter((c) => c.type === "resource_link");
    expect(resourceLinks.length).toBeGreaterThanOrEqual(1);
    expect(resourceLinks[0]).toMatchObject({
      type: "resource_link",
      uri: "https://www.kkj.go.jp/bid/KKJ-LINK-001",
    });

    await client.close();
    await server.close();
  });
});

describe("Anthropic review: response size controls", () => {
  it("search_bids caps structuredContent.bids at 100 even with limit=1000", async () => {
    const bids = Array.from({ length: 150 }, (_, i) =>
      [
        `<ResultId>${i + 1}</ResultId>`,
        `<Key>KKJ-CAP-${String(i + 1).padStart(3, "0")}</Key>`,
        `<ProjectName>案件${i + 1}</ProjectName>`,
      ].join(""),
    )
      .map((inner) => `<SearchResult>${inner}</SearchResult>`)
      .join("");
    const xml = `<Results><SearchResults><SearchHits>150</SearchHits>${bids}</SearchResults></Results>`;

    const kkjClient = new KkjClient({
      rateLimitPerSecond: 1000,
      fetchImpl: async () => new Response(xml, { status: 200 }),
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ kkjClient });
    const client = new Client({ name: "cap-test", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "search_bids",
      arguments: { query: "テスト", limit: 1000 },
    });

    expect(result.isError).not.toBe(true);
    const sc = result.structuredContent as { bids?: unknown[] };
    expect(sc.bids?.length).toBeLessThanOrEqual(100);

    await client.close();
    await server.close();
  });
});

describe("Anthropic review: MCP Apps UI metadata", () => {
  it("search_bids_app tool has _meta.ui.resourceUri annotation", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ tier: "pro" });
    const client = new Client({ name: "apps-meta-test", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    const appTool = tools.find((t) => t.name === "search_bids_app");
    expect(appTool).toBeDefined();
    expect(appTool?._meta?.ui?.resourceUri).toBe("ui://jp-bids/search-results.html");

    await client.close();
    await server.close();
  });

  it("ui://jp-bids/search-results.html resource has correct MIME type", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ tier: "pro" });
    const client = new Client({ name: "apps-mime-test", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const resource = await client.readResource({ uri: "ui://jp-bids/search-results.html" });
    expect(resource.contents[0]?.mimeType).toBe("text/html;profile=mcp-app");

    await client.close();
    await server.close();
  });

  it("Apps UI has a text fallback in tool response (non-Apps clients)", async () => {
    const xml = "<Results><SearchResults><SearchHits>0</SearchHits></SearchResults></Results>";
    const kkjClient = new KkjClient({
      rateLimitPerSecond: 1000,
      fetchImpl: async () => new Response(xml, { status: 200 }),
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ kkjClient });
    const client = new Client({ name: "apps-fallback-test", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "search_bids_app",
      arguments: { query: "テスト" },
    });

    const textContent = result.content.find((c) => c.type === "text");
    expect(textContent).toBeDefined();

    await client.close();
    await server.close();
  });
});
