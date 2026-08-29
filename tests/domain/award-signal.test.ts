import { describe, expect, it } from "vitest";
import { createAttribution } from "../../src/domain/attribution.js";
import { summarizeListedAwards } from "../../src/domain/award-signal.js";
import type { Bid } from "../../src/domain/bid.js";
import { findListedCompany } from "../../src/domain/listed-company.js";

function bid(overrides: Partial<Bid> & Pick<Bid, "key" | "projectName">): Bid {
  return {
    resultId: 1,
    prefectureName: "鹿児島県",
    category: "役務",
    cftIssueDate: "2026-04-10",
    ...overrides,
  };
}

describe("summarizeListedAwards", () => {
  it("aggregates notice counts without advisory language", () => {
    const fujitsu = findListedCompany("富士通");
    const toyota = findListedCompany("トヨタ自動車");
    if (!fujitsu || !toyota) {
      throw new Error("bundled catalog missing expected names");
    }
    const summary = summarizeListedAwards(
      [
        {
          bid: bid({ key: "A", projectName: "富士通保守A", cftIssueDate: "2026-04-10" }),
          matches: [fujitsu],
        },
        {
          bid: bid({ key: "B", projectName: "富士通保守B", cftIssueDate: "2026-05-01" }),
          matches: [fujitsu],
        },
        {
          bid: bid({
            key: "C",
            projectName: "トヨタ関連",
            prefectureName: "愛知県",
            category: "物品",
            cftIssueDate: "2026-03-01",
          }),
          matches: [toyota],
        },
      ],
      2,
      createAttribution(),
    );

    expect(summary.mappedCount).toBe(3);
    expect(summary.unmappedCount).toBe(2);
    expect(summary.companies[0]).toMatchObject({
      company: { code: "6702" },
      noticeCount: 2,
      latestNoticeKey: "B",
      latestNoticeDate: "2026-05-01",
    });
    expect(summary.investmentDisclaimer).toContain("投資助言ではありません");
    expect(summary.caveats.join(" ")).not.toMatch(/買い|売り|bullish|bearish/i);
  });
});
