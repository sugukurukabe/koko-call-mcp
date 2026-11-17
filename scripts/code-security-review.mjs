// Evaluate scanner output against independently validated, source-bound reviews.
export function evaluateSecurityScan({
  findings,
  reviewDocument,
  sourceSnapshots,
  ruleIds,
  ruleBundleSha256,
  scannedTargets,
  engineErrors = [],
}) {
  const errors = [...engineErrors];
  const targets = new Set(Object.keys(sourceSnapshots));
  const scanned = new Set(scannedTargets);
  const missingTargets = [...targets].filter((p) => !scanned.has(p));
  for (const p of scanned)
    if (!targets.has(p)) errors.push({ message: "Unexpected scanned target", path: p });
  const valid = new Map();
  const key = (rule, file, line) => JSON.stringify([rule, file, line]);
  if (
    reviewDocument?.version !== 1 ||
    reviewDocument.ruleBundleSha256 !== ruleBundleSha256 ||
    !Array.isArray(reviewDocument.reviews)
  ) {
    errors.push({ message: "Invalid review document or rule-bundle binding" });
  } else {
    const seen = new Set();
    for (const review of reviewDocument.reviews) {
      const source = sourceSnapshots[review?.path];
      const id = key(review?.rule, review?.path, review?.line);
      const fresh =
        source &&
        ruleIds.has(review.rule) &&
        Number.isInteger(review.line) &&
        review.line > 0 &&
        review.line <= source.lines &&
        /^[a-f0-9]{64}$/.test(review.sourceSha256) &&
        review.sourceSha256 === source.sha256 &&
        review.classification === "NOT_APPLICABLE_IN_THIS_FIXED_CONTEXT" &&
        typeof review.reason === "string" &&
        review.reason.trim() &&
        typeof review.evidence === "string" &&
        review.evidence.trim() &&
        review.requiresReviewOnAnySourceChange === true;
      if (!fresh || seen.has(id)) {
        errors.push({
          message: "Invalid or stale nonissue review",
          path: review?.path,
          rule: review?.rule,
        });
        valid.delete(id);
      } else valid.set(id, review);
      seen.add(id);
    }
  }
  const reviewedNonissues = [];
  const blockingFindings = [];
  const used = new Set();
  for (const finding of findings) {
    const file = finding.path?.replaceAll("\\", "/");
    if (
      !targets.has(file) ||
      !ruleIds.has(finding.check_id) ||
      !Number.isInteger(finding.start?.line)
    ) {
      errors.push({ message: "Invalid finding target, rule, or location", path: file });
      blockingFindings.push(finding);
      continue;
    }
    const id = key(finding.check_id, file, finding.start.line);
    const review = valid.get(id);
    if (review) {
      reviewedNonissues.push({ finding, review });
      used.add(id);
    } else blockingFindings.push(finding);
  }
  const unreportedReviews = [...valid]
    .filter(([id]) => !used.has(id))
    .map(([, review]) => ({
      status: "UNCHANGED_REVIEW_NOT_EMITTED_BY_THIS_SCAN",
      review,
    }));
  return {
    reviewedNonissues,
    blockingFindings,
    unreportedReviews,
    missingTargets,
    errors,
    allPassed: !errors.length && !missingTargets.length && !blockingFindings.length,
  };
}
