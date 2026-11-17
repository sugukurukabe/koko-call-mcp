import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { evaluateSecurityScan } from "../../scripts/code-security-review.mjs";

const digest = (s) => createHash("sha256").update(s).digest("hex");
const source = "trusted offline fixture\nsecond line\n";
const rule = "fixture.security.rule";
const file = "scripts/fixture.mjs";
const bundle = digest("fixed rules");
const review = {
  rule,
  path: file,
  line: 1,
  sourceSha256: digest(source),
  classification: "NOT_APPLICABLE_IN_THIS_FIXED_CONTEXT",
  reason: "Fixed local fixture",
  evidence: "Literal source is bound to this hash",
  requiresReviewOnAnySourceChange: true,
};
function input() {
  return {
    findings: [{ check_id: rule, path: file, start: { line: 1 } }],
    reviewDocument: { version: 1, ruleBundleSha256: bundle, reviews: [structuredClone(review)] },
    sourceSnapshots: { [file]: { sha256: digest(source), lines: 3 } },
    ruleIds: new Set([rule]),
    ruleBundleSha256: bundle,
    scannedTargets: [file],
    engineErrors: [],
  };
}

test("matching source-bound review classifies an emitted finding", () => {
  const result = evaluateSecurityScan(input());
  assert.equal(result.allPassed, true);
  assert.equal(result.reviewedNonissues.length, 1);
  assert.equal(result.unreportedReviews.length, 0);
});
test("unchanged review not emitted by the current engine is reported separately", () => {
  const value = input();
  value.findings = [];
  const result = evaluateSecurityScan(value);
  assert.equal(result.allPassed, true);
  assert.equal(result.unreportedReviews[0].status, "UNCHANGED_REVIEW_NOT_EMITTED_BY_THIS_SCAN");
});
for (const [name, mutate] of [
  [
    "source changed with a finding",
    (v) => {
      v.sourceSnapshots[file].sha256 = digest("changed");
    },
  ],
  [
    "source changed without a finding",
    (v) => {
      v.findings = [];
      v.sourceSnapshots[file].sha256 = digest("changed");
    },
  ],
  [
    "wrong bundle binding",
    (v) => {
      v.reviewDocument.ruleBundleSha256 = digest("other");
    },
  ],
  [
    "unknown reviewed rule",
    (v) => {
      v.reviewDocument.reviews[0].rule = "unknown";
    },
  ],
  [
    "invalid location",
    (v) => {
      v.reviewDocument.reviews[0].line = 99;
    },
  ],
  [
    "missing source",
    (v) => {
      v.reviewDocument.reviews[0].path = "../outside.mjs";
    },
  ],
  [
    "duplicate review",
    (v) => {
      v.reviewDocument.reviews.push(structuredClone(review));
    },
  ],
  [
    "missing review reason",
    (v) => {
      v.reviewDocument.reviews[0].reason = "";
    },
  ],
  [
    "unreviewed finding",
    (v) => {
      v.reviewDocument.reviews = [];
    },
  ],
  [
    "engine error",
    (v) => {
      v.engineErrors.push({ message: "fixture engine failure" });
    },
  ],
  [
    "unscanned target",
    (v) => {
      v.scannedTargets = [];
    },
  ],
  [
    "unexpected scanned target",
    (v) => {
      v.scannedTargets.push("../outside.mjs");
    },
  ],
  [
    "unexpected finding target",
    (v) => {
      v.findings[0].path = "../outside.mjs";
    },
  ],
]) {
  test(`fails on ${name}`, () => {
    const value = input();
    mutate(value);
    assert.equal(evaluateSecurityScan(value).allPassed, false);
  });
}
