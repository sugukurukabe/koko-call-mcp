import { describe, expect, it } from "vitest";
import { createAttribution } from "../../src/domain/attribution.js";
import { assessBidQualification } from "../../src/domain/bid-qualification.js";

describe("bid qualification assessment", () => {
  it("marks a matching bid as eligible", () => {
    const assessment = assessBidQualification(
      {
        resultId: 1,
        key: "KKJ-001",
        projectName: "クラウドシステム保守",
        prefectureName: "鹿児島県",
        category: "役務",
        certification: "A B",
        projectDescription: "システム保守の公告です。",
      },
      {
        qualifiedPrefectures: ["鹿児島県"],
        qualifiedCategories: ["役務"],
        certifications: ["A"],
        serviceKeywords: ["システム", "保守"],
      },
      createAttribution(),
    );

    expect(assessment.status).toBe("eligible");
    expect(assessment.matches).toEqual(
      expect.arrayContaining(["対応地域に一致: 鹿児島県", "対応カテゴリに一致: 役務"]),
    );
  });

  it("marks region and category gaps as not eligible", () => {
    const assessment = assessBidQualification(
      {
        resultId: 1,
        key: "KKJ-002",
        projectName: "庁舎工事",
        prefectureName: "北海道",
        category: "工事",
      },
      {
        qualifiedPrefectures: ["鹿児島県"],
        qualifiedCategories: ["役務"],
      },
      createAttribution(),
    );

    expect(assessment.status).toBe("not_eligible");
    expect(assessment.gaps.length).toBeGreaterThanOrEqual(2);
  });
});
