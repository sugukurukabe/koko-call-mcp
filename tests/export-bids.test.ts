import { describe, expect, it } from "vitest";
import type { KkjClient } from "../src/api/kkj-client.js";
import { createAttribution } from "../src/domain/attribution.js";
import { exportBids, parseExportBidsConfig, toCsv } from "../src/jobs/export-bids.js";

describe("export bids", () => {
  it("parses CLI arguments", () => {
    const config = parseExportBidsConfig(
      [
        "--prefecture",
        "鹿児島県,宮崎県",
        "--category",
        "役務",
        "--query",
        "システム,保守",
        "--days",
        "14",
        "--limit",
        "20",
        "--format",
        "json",
      ],
      {},
    );

    expect(config).toMatchObject({
      prefectures: ["鹿児島県", "宮崎県"],
      category: "役務",
      queryTerms: ["システム", "保守"],
      days: 14,
      limit: 20,
      format: "json",
    });
  });

  it("escapes CSV fields", () => {
    const csv = toCsv([
      {
        resultId: 1,
        key: "A",
        projectName: '庁舎, "ネットワーク" 保守',
      },
    ]);

    expect(csv).toContain('"庁舎, ""ネットワーク"" 保守"');
  });

  it("exports search results as CSV", async () => {
    const client = {
      search: async () => ({
        searchHits: 1,
        returnedCount: 1,
        query: { Query: "システム" },
        attribution: createAttribution(),
        bids: [
          {
            resultId: 1,
            key: "A",
            projectName: "システム保守",
            organizationName: "鹿児島市",
            prefectureName: "鹿児島県",
          },
        ],
      }),
    } as Pick<KkjClient, "search"> as KkjClient;

    const exported = await exportBids(client, {
      prefectures: ["鹿児島県"],
      queryTerms: ["システム"],
      days: 7,
      limit: 10,
      format: "csv",
    });

    expect(exported.output).toContain("project_name");
    expect(exported.output).toContain("システム保守");
  });
});
