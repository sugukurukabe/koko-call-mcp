import { describe, expect, it } from "vitest";
import { createAttribution } from "../../src/domain/attribution.js";
import { createBidReviewPacket } from "../../src/domain/bid-review-packet.js";

describe("bid review packet", () => {
  it("combines ranking, requirements, and calendar into markdown", () => {
    const packet = createBidReviewPacket(
      {
        resultId: 1,
        key: "KKJ-001",
        projectName: "システム保守",
        organizationName: "鹿児島市",
        prefectureName: "鹿児島県",
        tenderSubmissionDeadline: "2026-05-15",
        openingTendersEvent: "2026-05-20",
        externalDocumentUri: "https://example.test/notice",
      },
      createAttribution(),
      { preferredKeywords: ["システム"] },
    );

    expect(packet.markdown).toContain("# 入札検討メモ: システム保守");
    expect(packet.markdown).toContain("## 判断サマリー");
    expect(packet.markdown).toContain("## 既知の期限");
    expect(packet.rankedBid.reasons).toEqual(
      expect.arrayContaining(["重要キーワードに一致: システム"]),
    );
    expect(packet.requirements.documentTargets[0]).toMatchObject({
      kind: "official_page",
    });
    expect(packet.calendar.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "submission_deadline" })]),
    );
  });

  it("includes extracted PDF requirements when provided", () => {
    const attribution = createAttribution();
    const bid = {
      resultId: 1,
      key: "KKJ-001",
      projectName: "システム保守",
      organizationName: "鹿児島市",
      prefectureName: "鹿児島県",
      externalDocumentUri: "https://example.test/notice.pdf",
    };
    const packet = createBidReviewPacket(
      bid,
      attribution,
      {},
      {
        bid,
        knownRequirements: { organizationName: "鹿児島市" },
        documentTargets: [
          {
            label: "公式公告ページ",
            uri: "https://example.test/notice.pdf",
            kind: "official_page",
            recommendedProcessor: "manual_review",
          },
        ],
        missingRequirements: ["質問期限"],
        extractionPlan: [],
        safetyNotes: [],
        extractedFromDocuments: [],
        extractionWarnings: [],
        attribution,
        extractedRequirements: {
          eligibility: ["役務A等級"],
          requiredDocuments: ["入札書"],
          questionDeadline: null,
          tenderSubmissionDeadline: "2026-06-22 17:00",
          openingDate: "2026-07-03 14:00",
          briefingDate: "2026-05-11 14:00",
          deliveryDeadline: "2026-10-30",
          contractPeriod: null,
          contactPoint: "契約係",
          disqualification: ["期限後提出は無効"],
          estimatedBudget: null,
          evaluationCriteria: ["最低価格"],
          ambiguousPoints: ["質問様式が不明"],
          rawNotes: [],
        },
      },
    );

    expect(packet.markdown).toContain("## PDF抽出された主要要件");
    expect(packet.markdown).toContain("入札書提出期限: 2026-06-22 17:00");
    expect(packet.markdown).toContain("連絡先: 契約係");
  });
});
