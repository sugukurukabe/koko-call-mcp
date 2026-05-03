import { beforeEach, describe, expect, it } from "vitest";
import type { FetchedDocument } from "../../src/api/pdf-fetcher.js";
import {
  resetVertexBudgetForTests,
  VertexGeminiClient,
} from "../../src/api/vertex-gemini-client.js";
import type { Bid } from "../../src/domain/bid.js";
import { UpstreamError } from "../../src/lib/errors.js";

const bid: Bid = {
  resultId: 1,
  key: "KKJ-TEST-001",
  projectName: "庁舎システム保守業務",
};

const pdfDocument: FetchedDocument = {
  sourceUri: "https://example.com/spec.pdf",
  finalUri: "https://example.com/spec.pdf",
  mimeType: "application/pdf",
  bytes: new Uint8Array([37, 80, 68, 70]),
  sizeBytes: 4,
  sha256: "b".repeat(64),
};

describe("VertexGeminiClient", () => {
  beforeEach(() => {
    resetVertexBudgetForTests();
  });

  it("sends PDF bytes as inlineData and parses structured JSON", async () => {
    const requests: unknown[] = [];
    const client = new VertexGeminiClient({
      ai: {
        models: {
          generateContent: async (request: unknown) => {
            requests.push(request);
            return {
              text: JSON.stringify({
                eligibility: ["役務A等級"],
                requiredDocuments: ["入札書"],
                questionDeadline: null,
                deliveryDeadline: null,
                contractPeriod: null,
                disqualification: [],
                estimatedBudget: null,
                evaluationCriteria: ["価格"],
                ambiguousPoints: [],
                rawNotes: ["PDFから抽出"],
              }),
            };
          },
        },
      },
      model: "gemini-3-flash-preview",
    });

    const result = await client.extractBidRequirements({ bid, documents: [pdfDocument] });

    expect(result.extractedRequirements?.requiredDocuments).toEqual(["入札書"]);
    expect(JSON.stringify(requests[0])).toContain("inlineData");
    expect(JSON.stringify(requests[0])).toContain("application/pdf");
  });

  it("returns raw text with warning when JSON parsing fails", async () => {
    const client = new VertexGeminiClient({
      ai: {
        models: {
          generateContent: async () => ({ text: "not json" }),
        },
      },
    });

    const result = await client.extractBidRequirements({ bid, documents: [pdfDocument] });

    expect(result.extractedRequirements).toBeUndefined();
    expect(result.warnings[0]).toContain("JSON解析に失敗");
  });

  it("blocks calls when the in-memory daily budget is exceeded", async () => {
    const client = new VertexGeminiClient({
      dailyBudgetUsd: 0.01,
      estimatedCostPerCallUsd: 0.02,
      ai: {
        models: {
          generateContent: async () => ({ text: "{}" }),
        },
      },
    });

    await expect(
      client.extractBidRequirements({ bid, documents: [pdfDocument] }),
    ).rejects.toBeInstanceOf(UpstreamError);
  });
});
