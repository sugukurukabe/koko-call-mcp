import { describe, expect, it } from "vitest";
import {
  isAllowedOfficialLink,
  sparklinePath,
  toInvestorWorkspaceViewModel,
} from "../../src/apps/investor-radar-view-model.js";
import { createAttribution } from "../../src/domain/attribution.js";
import type { AwardMappingResult } from "../../src/domain/investor.js";
import { INVESTMENT_DISCLAIMER } from "../../src/domain/listed-company.js";

describe("investor radar view model", () => {
  it("maps structured results into cards without advisory labels", () => {
    const result: AwardMappingResult = {
      searchHits: 1,
      returnedCount: 1,
      mappedCount: 1,
      unmappedCount: 0,
      mapped: [
        {
          bid: {
            resultId: 1,
            key: "KKJ-1",
            projectName: "富士通 システム保守",
            organizationName: "鹿児島市",
            prefectureName: "鹿児島県",
            cftIssueDate: "2026-04-10",
            externalDocumentUri: "https://www.kkj.go.jp/doc.pdf",
          },
          matches: [
            {
              company: { code: "6702", name: "富士通", aliases: [], sector: "電気機器" },
              confidence: "contains",
              matchedText: "富士通",
            },
          ],
        },
      ],
      companies: [
        {
          company: { code: "6702", name: "富士通", aliases: [], sector: "電気機器" },
          noticeCount: 1,
          latestNoticeDate: "2026-04-10",
          latestNoticeKey: "KKJ-1",
          prefectureBreakdown: { 鹿児島県: 1 },
          categoryBreakdown: {},
          noticeKeys: ["KKJ-1"],
        },
      ],
      catalogSource: "bundled",
      caveats: ["KKJ検索結果は入札公告であり、公式の落札者・落札金額を含まない。"],
      investmentDisclaimer: INVESTMENT_DISCLAIMER,
      attribution: createAttribution(),
    };
    const workspace = toInvestorWorkspaceViewModel(result);
    expect(workspace.cards[0]).toMatchObject({ ticker: "6702", companyName: "富士通" });
    expect(workspace.disclaimer).toContain("投資助言ではありません");
  });

  it("builds an SVG path and allows only official origins", () => {
    expect(
      sparklinePath([
        { date: "a", close: 1 },
        { date: "b", close: 2 },
      ]),
    ).toContain("M");
    expect(isAllowedOfficialLink("https://www.kkj.go.jp/x")).toBe(true);
    expect(isAllowedOfficialLink("https://disclosure.edinet-fsa.go.jp/x")).toBe(true);
    expect(isAllowedOfficialLink("https://evil.example/x")).toBe(false);
  });
});
