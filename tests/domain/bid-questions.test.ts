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
});
