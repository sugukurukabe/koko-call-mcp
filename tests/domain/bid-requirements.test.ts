import { describe, expect, it } from "vitest";
import { createAttribution } from "../../src/domain/attribution.js";
import { extractBidRequirements } from "../../src/domain/bid-requirements.js";

describe("bid requirements extraction", () => {
  it("builds document targets and missing requirement checklist", () => {
    const extracted = extractBidRequirements(
      {
        resultId: 1,
        key: "A",
        projectName: "システム保守",
        externalDocumentUri: "https://example.test/notice",
        organizationName: "鹿児島市",
        tenderSubmissionDeadline: "2026-05-15",
        attachments: [{ name: "仕様書.pdf", uri: "https://example.test/spec.pdf" }],
      },
      createAttribution(),
    );

    expect(extracted.knownRequirements).toMatchObject({
      organizationName: "鹿児島市",
      tenderSubmissionDeadline: "2026-05-15",
    });
    expect(extracted.documentTargets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "attachment",
          recommendedProcessor: "gemini_document_understanding",
        }),
      ]),
    );
    expect(extracted.missingRequirements).toEqual(expect.arrayContaining(["質問期限"]));
    expect(extracted.safetyNotes).toEqual(
      expect.arrayContaining(["このMVPはPDF本文を保存・取得しない"]),
    );
  });
});
