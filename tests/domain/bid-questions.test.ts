import { describe, expect, it } from "vitest";
import { createAttribution } from "../../src/domain/attribution.js";
import { draftBidQuestions } from "../../src/domain/bid-questions.js";

describe("bid question draft", () => {
  it("drafts questions from missing requirements", () => {
    const draft = draftBidQuestions(
      {
        resultId: 1,
        key: "KKJ-001",
        projectName: "システム保守",
        organizationName: "鹿児島市",
        externalDocumentUri: "https://example.test/notice",
      },
      createAttribution(),
    );

    expect(draft.title).toBe("質問書ドラフト: システム保守");
    expect(draft.questions.map((question) => question.topic)).toEqual(
      expect.arrayContaining(["質問期限", "提出書類一覧"]),
    );
    expect(draft.markdown).toContain("## 質問案");
    expect(draft.reviewNotes).toEqual(
      expect.arrayContaining(["発注機関の指定様式、質問期限、提出方法を必ず確認してください。"]),
    );
  });

  it("uses extracted PDF requirements to reduce already answered questions", () => {
    const attribution = createAttribution();
    const bid = {
      resultId: 1,
      key: "KKJ-001",
      projectName: "システム保守",
      organizationName: "鹿児島市",
      externalDocumentUri: "https://example.test/notice.pdf",
    };
    const draft = draftBidQuestions(bid, attribution, {
      bid,
      knownRequirements: { organizationName: "鹿児島市" },
      documentTargets: [],
      missingRequirements: ["参加資格・等級・営業品目", "提出書類一覧", "質問期限"],
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
        briefingDate: null,
        deliveryDeadline: null,
        contractPeriod: null,
        contactPoint: "契約係",
        disqualification: [],
        estimatedBudget: null,
        evaluationCriteria: [],
        ambiguousPoints: ["質問様式が指定されているか不明"],
        rawNotes: [],
      },
    });

    const topics = draft.questions.map((question) => question.topic);
    expect(topics).not.toContain("参加資格・等級・営業品目");
    expect(topics).not.toContain("提出書類一覧");
    expect(topics).toEqual(
      expect.arrayContaining(["質問期限", "曖昧点: 質問様式が指定されているか不明"]),
    );
  });
});
