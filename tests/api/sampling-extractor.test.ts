import { describe, expect, it } from "vitest";
import type { FetchedDocument } from "../../src/api/pdf-fetcher.js";
import { extractRequirementsWithSampling } from "../../src/api/sampling-extractor.js";
import type { Bid } from "../../src/domain/bid.js";

const bid: Bid = {
  resultId: 1,
  key: "KKJ-TEST-001",
  projectName: "庁舎システム保守業務",
};

const htmlDocument: FetchedDocument = {
  sourceUri: "https://example.com/spec.html",
  finalUri: "https://example.com/spec.html",
  mimeType: "text/html",
  bytes: new TextEncoder().encode("<html>参加資格: 役務A等級</html>"),
  sizeBytes: 33,
  sha256: "a".repeat(64),
};

describe("extractRequirementsWithSampling", () => {
  it("calls MCP sampling and parses structured JSON", async () => {
    const result = await extractRequirementsWithSampling({
      bid,
      documents: [htmlDocument],
      createMessage: async (params) => {
        expect(params.systemPrompt).toContain("untrusted");
        expect(params.messages[0]?.content).toMatchObject({ type: "text" });
        return {
          role: "assistant",
          model: "test-model",
          content: {
            type: "text",
            text: JSON.stringify({
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
              evaluationCriteria: ["価格"],
              ambiguousPoints: [],
              rawNotes: ["テスト抽出"],
            }),
          },
        };
      },
    });

    expect(result.extractedRequirements?.eligibility).toEqual(["役務A等級"]);
    expect(result.model).toBe("test-model");
    expect(result.warnings).toContain("HTML本文をUTF-8として抽出しました。");
  });

  it("keeps raw sampling output when JSON parsing fails", async () => {
    const result = await extractRequirementsWithSampling({
      bid,
      documents: [htmlDocument],
      createMessage: async () => ({
        role: "assistant",
        model: "test-model",
        content: { type: "text", text: "not json" },
      }),
    });

    expect(result.extractedRequirements).toBeUndefined();
    expect(result.rawText).toBe("not json");
    expect(result.warnings.some((warning) => warning.includes("解析に失敗"))).toBe(true);
  });
});
