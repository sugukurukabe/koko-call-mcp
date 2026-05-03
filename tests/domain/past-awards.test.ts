import { describe, expect, it } from "vitest";
import { createAttribution } from "../../src/domain/attribution.js";
import type { BidSearchResult } from "../../src/domain/bid.js";
import { summarizePastAwards } from "../../src/domain/past-awards.js";

describe("summarizePastAwards", () => {
  it("aggregates organizations, categories, procedures, and monthly volume", () => {
    const result: BidSearchResult = {
      searchHits: 4,
      returnedCount: 4,
      query: { Query: "システム" },
      attribution: createAttribution(),
      bids: [
        {
          resultId: 1,
          key: "A",
          projectName: "保守A",
          organizationName: "鹿児島市",
          category: "役務",
          procedureType: "一般競争入札",
          cftIssueDate: "2026-04-10",
        },
        {
          resultId: 2,
          key: "B",
          projectName: "保守B",
          organizationName: "鹿児島市",
          category: "役務",
          procedureType: "一般競争入札",
          cftIssueDate: "2026-04-25",
        },
        {
          resultId: 3,
          key: "C",
          projectName: "工事C",
          organizationName: "鹿児島県",
          category: "工事",
          procedureType: "指名競争入札",
          cftIssueDate: "2026-03-20",
        },
        {
          resultId: 4,
          key: "D",
          projectName: "保守D",
          organizationName: "鹿児島県",
          category: "役務",
          procedureType: "一般競争入札",
          cftIssueDate: "2026-03-15",
        },
      ],
    };

    const summary = summarizePastAwards(result, { windowDays: 90 }, result.attribution);

    expect(summary.windowDays).toBe(90);
    expect(summary.topOrganizations[0]).toMatchObject({
      organizationName: "鹿児島市",
      bidCount: 2,
      recentBidKey: "B",
      recentBidDate: "2026-04-25",
    });
    expect(summary.categoryBreakdown).toEqual({ 役務: 3, 工事: 1 });
    expect(summary.procedureBreakdown).toEqual({ 一般競争入札: 3, 指名競争入札: 1 });
    expect(summary.monthlyVolume).toEqual([
      { month: "2026-03", count: 2 },
      { month: "2026-04", count: 2 },
    ]);
    expect(summary.insights.join(" ")).toContain("公告数トップ");
    expect(summary.caveats[0]).toContain("公告データに基づく");
  });

  it("returns hint when there are no bids", () => {
    const summary = summarizePastAwards(
      {
        searchHits: 0,
        returnedCount: 0,
        bids: [],
        query: {},
        attribution: createAttribution(),
      },
      { windowDays: 365 },
      createAttribution(),
    );
    expect(summary.insights[0]).toContain("件数が少なく");
  });
});
