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

  it("uses extracted PDF eligibility when search metadata has no certification", () => {
    const attribution = createAttribution();
    const assessment = assessBidQualification(
      {
        resultId: 1,
        key: "KKJ-003",
        projectName: "マーカーレスモーションキャプチャーシステム",
        prefectureName: "鹿児島県",
        category: "物品",
      },
      {
        qualifiedPrefectures: ["鹿児島県"],
        qualifiedCategories: ["物品"],
        certifications: ["A", "物品の販売"],
        serviceKeywords: ["モーションキャプチャー"],
      },
      attribution,
      {
        bid: {
          resultId: 1,
          key: "KKJ-003",
          projectName: "マーカーレスモーションキャプチャーシステム",
        },
        knownRequirements: {},
        documentTargets: [],
        missingRequirements: [],
        extractionPlan: [],
        safetyNotes: [],
        extractedFromDocuments: [
          {
            sourceUri: "https://example.test/notice.pdf",
            finalUri: "https://example.test/notice.pdf",
            sha256: "a".repeat(64),
            sizeBytes: 100,
            mimeType: "application/pdf",
            extractedAt: "2026-05-03T00:00:00.000Z",
            mode: "vertex_ai",
          },
        ],
        extractionWarnings: [],
        attribution,
        extractedRequirements: {
          eligibility: ["全省庁統一資格 物品の販売 A、B又はC等級"],
          requiredDocuments: ["入札書", "納入できることを証明する書類"],
          questionDeadline: null,
          tenderSubmissionDeadline: "2026-06-22 17:00",
          openingDate: "2026-07-03 14:00",
          briefingDate: null,
          deliveryDeadline: "2026-10-30",
          contractPeriod: null,
          contactPoint: "契約係",
          disqualification: [],
          estimatedBudget: null,
          evaluationCriteria: [],
          ambiguousPoints: [],
          rawNotes: [],
        },
      },
    );

    expect(assessment.status).toBe("eligible");
    expect(assessment.matches).toEqual(
      expect.arrayContaining([
        "資格条件に一致候補: A",
        "PDF抽出で入札書提出期限を確認: 2026-06-22 17:00",
      ]),
    );
    expect(assessment.requirementsUsed).toMatchObject({
      documentExtractionMode: "vertex_ai",
      tenderSubmissionDeadline: "2026-06-22 17:00",
    });
  });
});
