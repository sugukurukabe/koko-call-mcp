import type { Attribution } from "./attribution.js";
import type { Bid, BidQualificationAssessment, BidRequirementExtraction } from "./bid.js";

export interface CompanyQualificationProfile {
  qualifiedPrefectures?: string[];
  qualifiedCategories?: string[];
  certifications?: string[];
  serviceKeywords?: string[];
}

export function assessBidQualification(
  bid: Bid,
  profile: CompanyQualificationProfile,
  attribution: Attribution,
  requirements?: BidRequirementExtraction,
): BidQualificationAssessment {
  const normalizedProfile = {
    qualifiedPrefectures: profile.qualifiedPrefectures ?? [],
    qualifiedCategories: profile.qualifiedCategories ?? [],
    certifications: profile.certifications ?? [],
    serviceKeywords: profile.serviceKeywords ?? [],
  };
  const matches: string[] = [];
  const gaps: string[] = [];
  const unknowns: string[] = [];
  let score = 50;

  score += assessPrefecture(bid, normalizedProfile.qualifiedPrefectures, matches, gaps, unknowns);
  score += assessCategory(bid, normalizedProfile.qualifiedCategories, matches, gaps, unknowns);
  score += assessCertification(
    bid,
    normalizedProfile.certifications,
    matches,
    gaps,
    unknowns,
    requirements,
  );
  score += assessKeywords(bid, normalizedProfile.serviceKeywords, matches, unknowns);
  score += assessExtractedDocuments(requirements, matches, unknowns);

  const confidence = clamp(score);
  return {
    bid,
    status: toStatus(confidence, gaps),
    confidence,
    profile: normalizedProfile,
    matches,
    gaps,
    unknowns,
    ...(requirements?.extractedRequirements
      ? { requirementsUsed: toRequirementsUsed(requirements) }
      : {}),
    nextActions: [
      "公式公告・仕様書で参加資格、等級、営業品目を確認する",
      "自社の全省庁統一資格、自治体資格、営業品目と照合する",
      "資格証明書、納税証明書、会社資料など必要書類の有効期限を確認する",
      "資格が不明な場合は発注機関へ質問書で確認する",
    ],
    attribution,
  };
}

function assessPrefecture(
  bid: Bid,
  qualifiedPrefectures: string[],
  matches: string[],
  gaps: string[],
  unknowns: string[],
): number {
  if (!bid.prefectureName) {
    unknowns.push("案件の地域が検索結果から確認できない");
    return -5;
  }
  if (qualifiedPrefectures.length === 0) {
    unknowns.push("自社の対応地域が未指定");
    return 0;
  }
  if (qualifiedPrefectures.includes(bid.prefectureName)) {
    matches.push(`対応地域に一致: ${bid.prefectureName}`);
    return 15;
  }
  gaps.push(`対応地域外の可能性: ${bid.prefectureName}`);
  return -25;
}

function assessCategory(
  bid: Bid,
  qualifiedCategories: string[],
  matches: string[],
  gaps: string[],
  unknowns: string[],
): number {
  if (!bid.category) {
    unknowns.push("案件カテゴリが検索結果から確認できない");
    return -5;
  }
  if (qualifiedCategories.length === 0) {
    unknowns.push("自社の対応カテゴリが未指定");
    return 0;
  }
  if (qualifiedCategories.includes(bid.category)) {
    matches.push(`対応カテゴリに一致: ${bid.category}`);
    return 15;
  }
  gaps.push(`対応カテゴリ外の可能性: ${bid.category}`);
  return -20;
}

function assessCertification(
  bid: Bid,
  certifications: string[],
  matches: string[],
  gaps: string[],
  unknowns: string[],
  requirements: BidRequirementExtraction | undefined,
): number {
  const extractedEligibility = requirements?.extractedRequirements?.eligibility ?? [];
  const certificationHaystack = [bid.certification, ...extractedEligibility].filter(
    (value): value is string => Boolean(value),
  );

  if (certificationHaystack.length === 0) {
    unknowns.push("案件側の資格・等級条件が検索結果から確認できない");
    return -5;
  }
  if (certifications.length === 0) {
    unknowns.push("自社の資格・等級が未指定");
    return 0;
  }
  const bidCertification = certificationHaystack.join(" ").toLowerCase();
  const matched = certifications.find((certification) =>
    bidCertification.includes(certification.toLowerCase()),
  );
  if (matched) {
    matches.push(`資格条件に一致候補: ${matched}`);
    return 15;
  }
  gaps.push(`資格条件の一致を確認できない: ${certificationHaystack.join(" / ")}`);
  return -20;
}

function assessExtractedDocuments(
  requirements: BidRequirementExtraction | undefined,
  matches: string[],
  unknowns: string[],
): number {
  const extracted = requirements?.extractedRequirements;
  if (!extracted) {
    return 0;
  }
  let score = 0;
  if (extracted.requiredDocuments.length > 0) {
    matches.push(`PDF抽出で提出書類を確認: ${extracted.requiredDocuments.join(", ")}`);
    score += 5;
  }
  if (extracted.tenderSubmissionDeadline) {
    matches.push(`PDF抽出で入札書提出期限を確認: ${extracted.tenderSubmissionDeadline}`);
    score += 5;
  }
  if (extracted.openingDate) {
    matches.push(`PDF抽出で開札日時を確認: ${extracted.openingDate}`);
  }
  if (!extracted.questionDeadline) {
    unknowns.push("PDF抽出でも質問期限を確認できない");
  }
  return score;
}

function assessKeywords(
  bid: Bid,
  serviceKeywords: string[],
  matches: string[],
  unknowns: string[],
): number {
  if (serviceKeywords.length === 0) {
    unknowns.push("自社サービスキーワードが未指定");
    return 0;
  }
  const haystack = [bid.projectName, bid.projectDescription, bid.category, bid.procedureType]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  const matchedKeywords = serviceKeywords.filter((keyword) =>
    haystack.includes(keyword.toLowerCase()),
  );
  if (matchedKeywords.length === 0) {
    unknowns.push("件名・概要から自社サービスとの一致を確認できない");
    return -5;
  }
  matches.push(`サービスキーワードに一致: ${matchedKeywords.join(", ")}`);
  return Math.min(20, matchedKeywords.length * 7);
}

function toStatus(confidence: number, gaps: string[]): BidQualificationAssessment["status"] {
  if (gaps.length >= 2 || confidence < 40) {
    return "not_eligible";
  }
  if (confidence >= 75 && gaps.length === 0) {
    return "eligible";
  }
  return "needs_review";
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toRequirementsUsed(
  requirements: BidRequirementExtraction,
): NonNullable<BidQualificationAssessment["requirementsUsed"]> {
  const extracted = requirements.extractedRequirements;
  return {
    documentExtractionMode: requirements.extractedFromDocuments.some(
      (document) => document.mode === "vertex_ai",
    )
      ? "vertex_ai"
      : requirements.extractedFromDocuments.some((document) => document.mode === "sampling")
        ? "sampling"
        : "none",
    eligibility: extracted?.eligibility ?? [],
    requiredDocuments: extracted?.requiredDocuments ?? [],
    tenderSubmissionDeadline: extracted?.tenderSubmissionDeadline ?? null,
    openingDate: extracted?.openingDate ?? null,
    contactPoint: extracted?.contactPoint ?? null,
  };
}
