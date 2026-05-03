import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { KkjClient } from "../src/api/kkj-client.js";
import { createJpBidsServer } from "../src/mcp.js";

describe("MCP tool execution", () => {
  it("executes search_bids and returns structured attribution", async () => {
    const xml = await readFile("tests/fixtures/kkj-search.xml", "utf8");
    const kkjClient = new KkjClient({
      rateLimitPerSecond: 1000,
      fetchImpl: async () => new Response(xml, { status: 200 }),
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ kkjClient });
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

  it("executes search_bids_app with the same structured fallback content", async () => {
    const xml = await readFile("tests/fixtures/kkj-search.xml", "utf8");
    const kkjClient = new KkjClient({
      rateLimitPerSecond: 1000,
      fetchImpl: async () => new Response(xml, { status: 200 }),
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ kkjClient });
    const client = new Client({ name: "app-tool-execution-test", version: "0.1.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "search_bids_app",
      arguments: {
        query: "システム",
        prefecture: "鹿児島県",
        category: "役務",
        limit: 1,
      },
    });

    expect(result.isError).not.toBe(true);
    expect(result.content[0]).toMatchObject({ type: "text" });
    expect(result.structuredContent).toMatchObject({
      searchHits: 1,
      returnedCount: 1,
      bids: [{ key: "KKJ-TEST-001" }],
      attribution: {
        dataSource: "中小企業庁 官公需情報ポータルサイト",
      },
    });

    await client.close();
    await server.close();
  });

  it("executes rank_bids and returns prioritized bid candidates", async () => {
    const xml = await readFile("tests/fixtures/kkj-search.xml", "utf8");
    const kkjClient = new KkjClient({
      rateLimitPerSecond: 1000,
      fetchImpl: async () => new Response(xml, { status: 200 }),
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ kkjClient });
    const client = new Client({ name: "rank-tool-execution-test", version: "0.1.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "rank_bids",
      arguments: {
        query: "システム",
        prefecture: "鹿児島県",
        category: "役務",
        preferred_keywords: ["システム"],
        limit: 1,
      },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      rankedCount: 1,
      rankedBids: [{ bid: { key: "KKJ-TEST-001" } }],
      scoringPolicy: { version: "ai-bid-radar-0.1" },
      attribution: {
        dataSource: "中小企業庁 官公需情報ポータルサイト",
      },
    });

    await client.close();
    await server.close();
  });

  it("explains bid fit from the recent bid cache", async () => {
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
    const server = createJpBidsServer({ kkjClient });
    const client = new Client({ name: "fit-tool-execution-test", version: "0.1.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    await client.callTool({
      name: "rank_bids",
      arguments: { query: "システム", preferred_keywords: ["システム"], limit: 1 },
    });
    const result = await client.callTool({
      name: "explain_bid_fit",
      arguments: { bid_key: "KKJ-TEST-001", preferred_keywords: ["システム"] },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      rankedBid: {
        bid: { key: "KKJ-TEST-001" },
      },
      scoringPolicy: { version: "ai-bid-radar-0.1" },
      attribution: {
        dataSource: "中小企業庁 官公需情報ポータルサイト",
      },
    });
    expect(fetchCount).toBe(1);

    await client.close();
    await server.close();
  });

  it("assesses bid qualification from cached bid metadata", async () => {
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
    const server = createJpBidsServer({ kkjClient });
    const client = new Client({ name: "qualification-tool-execution-test", version: "0.1.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    await client.callTool({
      name: "search_bids",
      arguments: { query: "システム", limit: 1 },
    });
    const result = await client.callTool({
      name: "assess_bid_qualification",
      arguments: {
        bid_key: "KKJ-TEST-001",
        qualified_prefectures: ["鹿児島県"],
        qualified_categories: ["役務"],
        certifications: ["A"],
        service_keywords: ["システム", "保守"],
      },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      bid: { key: "KKJ-TEST-001" },
      status: "eligible",
      profile: {
        qualifiedPrefectures: ["鹿児島県"],
        qualifiedCategories: ["役務"],
      },
      attribution: {
        dataSource: "中小企業庁 官公需情報ポータルサイト",
      },
    });
    expect(fetchCount).toBe(1);

    await client.close();
    await server.close();
  });

  it("exports ranked bid shortlist as CSV", async () => {
    const xml = await readFile("tests/fixtures/kkj-search.xml", "utf8");
    const kkjClient = new KkjClient({
      rateLimitPerSecond: 1000,
      fetchImpl: async () => new Response(xml, { status: 200 }),
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ kkjClient });
    const client = new Client({ name: "shortlist-tool-execution-test", version: "0.1.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "export_bid_shortlist",
      arguments: {
        query: "システム",
        prefecture: "鹿児島県",
        category: "役務",
        preferred_keywords: ["システム"],
        limit: 1,
      },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      format: "csv",
      filename: "jp-bids-shortlist.csv",
      rankedCount: 1,
      columns: expect.arrayContaining(["priority", "score", "fit_reasons"]),
    });
    expect(String(result.structuredContent?.csv)).toContain("鹿児島市システム保守業務委託");

    await client.close();
    await server.close();
  });

  it("extracts bid requirements from cached bid metadata", async () => {
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
    const server = createJpBidsServer({ kkjClient });
    const client = new Client({ name: "requirements-tool-execution-test", version: "0.1.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    await client.callTool({
      name: "search_bids",
      arguments: { query: "システム", limit: 1 },
    });
    const result = await client.callTool({
      name: "extract_bid_requirements",
      arguments: { bid_key: "KKJ-TEST-001" },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      bid: { key: "KKJ-TEST-001" },
      knownRequirements: {
        organizationName: "鹿児島市",
        tenderSubmissionDeadline: "2026-05-15",
      },
      documentTargets: expect.arrayContaining([
        expect.objectContaining({
          label: "仕様書.pdf",
          recommendedProcessor: "gemini_document_understanding",
        }),
      ]),
      safetyNotes: expect.arrayContaining([
        "PDF/HTML本文は必要時のみ一時取得し、サーバーに保存しない",
      ]),
    });
    expect(fetchCount).toBe(1);

    await client.close();
    await server.close();
  });

  it("creates bid calendar ICS from cached bid metadata", async () => {
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
    const server = createJpBidsServer({ kkjClient });
    const client = new Client({ name: "calendar-tool-execution-test", version: "0.1.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    await client.callTool({
      name: "search_bids",
      arguments: { query: "システム", limit: 1 },
    });
    const result = await client.callTool({
      name: "create_bid_calendar",
      arguments: { bid_key: "KKJ-TEST-001" },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      format: "ics",
      filename: "jp-bids-KKJ-TEST-001.ics",
      eventCount: 4,
      events: expect.arrayContaining([
        expect.objectContaining({ kind: "submission_deadline", date: "2026-05-15" }),
        expect.objectContaining({ kind: "opening", date: "2026-05-20" }),
      ]),
      missingDates: expect.arrayContaining(["質問期限"]),
    });
    expect(String(result.structuredContent?.ics)).toContain("BEGIN:VCALENDAR");
    expect(fetchCount).toBe(1);

    await client.close();
    await server.close();
  });

  it("creates bid review packet markdown from cached bid metadata", async () => {
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
    const server = createJpBidsServer({ kkjClient });
    const client = new Client({ name: "review-packet-tool-execution-test", version: "0.1.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    await client.callTool({
      name: "search_bids",
      arguments: { query: "システム", limit: 1 },
    });
    const result = await client.callTool({
      name: "create_bid_review_packet",
      arguments: { bid_key: "KKJ-TEST-001", preferred_keywords: ["システム"] },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      bid: { key: "KKJ-TEST-001" },
      title: "入札検討メモ: 鹿児島市システム保守業務委託",
      rankedBid: { bid: { key: "KKJ-TEST-001" } },
      requirements: { bid: { key: "KKJ-TEST-001" } },
      calendar: { format: "ics" },
    });
    expect(String(result.structuredContent?.markdown)).toContain("## 判断サマリー");
    expect(fetchCount).toBe(1);

    await client.close();
    await server.close();
  });

  it("drafts bid questions from cached bid metadata", async () => {
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
    const server = createJpBidsServer({ kkjClient });
    const client = new Client({ name: "question-draft-tool-execution-test", version: "0.1.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    await client.callTool({
      name: "search_bids",
      arguments: { query: "システム", limit: 1 },
    });
    const result = await client.callTool({
      name: "draft_bid_questions",
      arguments: { bid_key: "KKJ-TEST-001" },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      bid: { key: "KKJ-TEST-001" },
      title: "質問書ドラフト: 鹿児島市システム保守業務委託",
      questions: expect.arrayContaining([
        expect.objectContaining({ topic: "質問期限" }),
        expect.objectContaining({ topic: "提出書類一覧" }),
      ]),
    });
    expect(String(result.structuredContent?.markdown)).toContain("## 質問案");
    expect(fetchCount).toBe(1);

    await client.close();
    await server.close();
  });

  it("analyzes past awards and returns aggregated organizations", async () => {
    const xml = await readFile("tests/fixtures/kkj-search.xml", "utf8");
    const kkjClient = new KkjClient({
      rateLimitPerSecond: 1000,
      fetchImpl: async () => new Response(xml, { status: 200 }),
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ kkjClient });
    const client = new Client({ name: "past-awards-tool-execution-test", version: "0.1.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "analyze_past_awards",
      arguments: {
        query: "システム",
        prefecture: "鹿児島県",
        window_days: 365,
        limit: 20,
      },
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      windowDays: 365,
      topOrganizations: expect.arrayContaining([
        expect.objectContaining({ organizationName: "鹿児島市", bidCount: 1 }),
      ]),
      categoryBreakdown: { 役務: 1 },
      procedureBreakdown: { 一般競争入札: 1 },
      attribution: { dataSource: "中小企業庁 官公需情報ポータルサイト" },
    });
    expect((result.structuredContent as { caveats: string[] }).caveats[0]).toContain(
      "公告データに基づく",
    );

    await client.close();
    await server.close();
  });

  it("rejects analyze_past_awards when no filters are provided", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer();
    const client = new Client({ name: "past-awards-error-test", version: "0.1.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "analyze_past_awards",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.type).toBe("text");

    await client.close();
    await server.close();
  });

  it("returns tool execution errors for missing required search conditions", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer();
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

  it("list_recent_bids without prefecture queries all 47 prefectures via comma-joined LG_Code", async () => {
    const xml = await readFile("tests/fixtures/kkj-search.xml", "utf8");
    let capturedUrl: string | undefined;
    const kkjClient = new KkjClient({
      rateLimitPerSecond: 1000,
      fetchImpl: async (input) => {
        capturedUrl = typeof input === "string" ? input : input.toString();
        return new Response(xml, { status: 200 });
      },
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createJpBidsServer({ kkjClient });
    const client = new Client({ name: "list-recent-nationwide-test", version: "0.1.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "list_recent_bids",
      arguments: { days: 3, limit: 5 },
    });

    expect(result.isError).not.toBe(true);
    expect(capturedUrl).toBeDefined();
    const url = new URL(capturedUrl as string);
    const lgCode = url.searchParams.get("LG_Code");
    expect(lgCode).toBeTruthy();
    const codes = (lgCode as string).split(",");
    expect(codes).toHaveLength(47);
    expect(codes).toContain("01");
    expect(codes).toContain("13");
    expect(codes).toContain("47");

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
    const server = createJpBidsServer({ kkjClient });
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
