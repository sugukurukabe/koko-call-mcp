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
});
