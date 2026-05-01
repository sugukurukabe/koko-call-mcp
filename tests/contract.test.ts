import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { KkjClient } from "../src/api/kkj-client.js";
import { createJpBidsServer } from "../src/mcp.js";

describe("MCP contract", () => {
  it("exposes tools, prompts, resources, templates, and completion", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer();
    const client = new Client({ name: "contract-test", version: "0.1.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "search_bids",
        "list_recent_bids",
        "get_bid_detail",
        "summarize_bids_by_org",
      ]),
    );

    const prompts = await client.listPrompts();
    expect(prompts.prompts.map((prompt) => prompt.name)).toEqual(
      expect.arrayContaining(["morning_bid_briefing", "competitor_radar", "bid_due_alert"]),
    );

    const resources = await client.listResources();
    expect(resources.resources.map((resource) => resource.uri)).toEqual(
      expect.arrayContaining(["attribution://kkj", "docs://api-reference", "codes://prefectures"]),
    );

    const templates = await client.listResourceTemplates();
    expect(templates.resourceTemplates.map((template) => template.uriTemplate)).toEqual(
      expect.arrayContaining(["bid://{bid_key}", "prefecture://{lg_code}"]),
    );

    const completion = await client.complete({
      ref: { type: "ref/resource", uri: "prefecture://{lg_code}" },
      argument: { name: "lg_code", value: "4" },
    });
    expect(completion.completion.values).toEqual(expect.arrayContaining(["46"]));

    await client.close();
    await server.close();
  });

  it("reads cached bid resources through bid URI template", async () => {
    const kkjClient = new KkjClient({
      rateLimitPerSecond: 1000,
      fetchImpl: async () =>
        new Response(
          [
            "<Results><SearchResults><SearchHits>1</SearchHits><SearchResult>",
            "<ResultId>1</ResultId><Key>KKJ-CACHED-001</Key><ProjectName>Cached Project</ProjectName>",
            "</SearchResult></SearchResults></Results>",
          ].join(""),
          { status: 200 },
        ),
    });
    await kkjClient.search({ Query: "cached", Count: 1 });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ kkjClient });
    const client = new Client({ name: "resource-cache-test", version: "0.1.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const resource = await client.readResource({ uri: "bid://KKJ-CACHED-001" });
    expect(resource.contents[0]).toMatchObject({
      mimeType: "application/json",
    });
    expect(JSON.parse(resource.contents[0]?.text ?? "{}")).toMatchObject({
      bid: { key: "KKJ-CACHED-001" },
    });

    await client.close();
    await server.close();
  });
});
