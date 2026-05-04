import { readFile } from "node:fs/promises";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { KkjClient, parseKkjXml } from "../src/api/kkj-client.js";

describe("parseKkjXml", () => {
  it("normalizes KKJ XML into typed structured content with attribution", async () => {
    const xml = await readFile("tests/fixtures/kkj-search.xml", "utf8");
    const result = parseKkjXml(xml, { Query: "システム", Count: 1 });
    expect(result.searchHits).toBe(1);
    expect(result.bids[0]?.key).toBe("KKJ-TEST-001");
    expect(result.bids[0]?.attachments?.[0]?.name).toBe("仕様書.pdf");
    expect(result.attribution.dataSource).toBe("中小企業庁 官公需情報ポータルサイト");
  });

  it("handles empty search results", async () => {
    const xml = await readFile("tests/fixtures/kkj-empty.xml", "utf8");
    const result = parseKkjXml(xml, { Query: "not-found", Count: 10 });
    expect(result.searchHits).toBe(0);
    expect(result.returnedCount).toBe(0);
    expect(result.bids).toEqual([]);
  });

  it("keeps optional missing fields undefined", async () => {
    const xml = await readFile("tests/fixtures/kkj-missing-fields.xml", "utf8");
    const result = parseKkjXml(xml, { Query: "missing", Count: 1 });
    expect(result.bids[0]).toMatchObject({
      key: "KKJ-MISSING-001",
      projectName: "添付なし・地域欠損テスト案件",
    });
    expect(result.bids[0]?.prefectureName).toBeUndefined();
    expect(result.bids[0]?.attachments).toBeUndefined();
  });

  it("normalizes multiple SearchResult entries", async () => {
    const xml = await readFile("tests/fixtures/kkj-multiple.xml", "utf8");
    const result = parseKkjXml(xml, { Query: "鹿児島", Count: 2 });
    expect(result.searchHits).toBe(2);
    expect(result.bids.map((bid) => bid.key)).toEqual(["KKJ-MULTI-001", "KKJ-MULTI-002"]);
  });

  it("turns KKJ API errors into user input errors", async () => {
    const xml = await readFile("tests/fixtures/kkj-error.xml", "utf8");
    expect(() => parseKkjXml(xml, {})).toThrow(/KKJ API error/);
  });

  it("normalizes generated optional XML fields without throwing", () => {
    fc.assert(
      fc.property(
        fc.record({
          key: fc
            .string({ minLength: 1, maxLength: 24 })
            .filter((value) => value.trim().length > 0),
          projectName: fc
            .string({ minLength: 1, maxLength: 80 })
            .filter((value) => value.trim().length > 0),
          organizationName: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: "" }),
        }),
        ({ key, projectName, organizationName }) => {
          const xml = [
            "<Results><SearchResults><SearchHits>1</SearchHits><SearchResult>",
            `<ResultId>1</ResultId><Key>${escapeXml(key)}</Key><ProjectName>${escapeXml(projectName)}</ProjectName>`,
            organizationName
              ? `<OrganizationName>${escapeXml(organizationName)}</OrganizationName>`
              : "",
            "</SearchResult></SearchResults></Results>",
          ].join("");
          const result = parseKkjXml(xml, { Query: "property", Count: 1 });
          expect(result.bids[0]?.key).toBe(key.trim());
        },
      ),
    );
  });
});

describe("KkjClient", () => {
  it("sends User-Agent and parses upstream XML", async () => {
    const xml = await readFile("tests/fixtures/kkj-search.xml", "utf8");
    const requests: Request[] = [];
    const client = new KkjClient({
      rateLimitPerSecond: 1000,
      fetchImpl: async (input, init) => {
        requests.push(new Request(input, init));
        return new Response(xml, { status: 200 });
      },
    });
    const result = await client.search({ Query: "システム", Count: 1 });
    expect(result.returnedCount).toBe(1);
    expect(requests[0]?.headers.get("User-Agent")).toMatch(/^JP Bids MCP\/\d+\.\d+\.\d+$/);
  });
});

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
