import type { Bid, BidRankingResult, BidSearchResult, RankedBid } from "./bid.js";
import { parseJapaneseDateToDate } from "./date-range.js";

export interface BidRankingOptions {
  preferredKeywords?: string[];
  avoidKeywords?: string[];
  dueWithinDays?: number;
  now?: Date;
  shortlistLimit?: number;
}

export const bidRankingScoringPolicy = {
  version: "ai-bid-radar-0.1",
  summary:
    "Rules-based MVP ranking for public bid discovery. Scores prioritize deadline clarity, practical next actions, keyword fit, and missing-information risks.",
};

export function rankBidSearchResult(
  result: BidSearchResult,
  options: BidRankingOptions = {},
): BidRankingResult {
  const rankedBids = result.bids
    .map((bid) => rankBid(bid, options))
    .sort((left, right) => right.score - left.score || left.bid.resultId - right.bid.resultId)
    .slice(0, options.shortlistLimit ?? result.bids.length);

  return {
    searchHits: result.searchHits,
    returnedCount: result.returnedCount,
    rankedCount: rankedBids.length,
    rankedBids,
    query: result.query,
    attribution: result.attribution,
    scoringPolicy: bidRankingScoringPolicy,
  };
}

export function rankBid(bid: Bid, options: BidRankingOptions = {}): RankedBid {
  const reasons: string[] = [];
  const risks: string[] = [];
  const nextActions = [
    "公式公告ページまたは添付仕様書で参加条件を確認する",
    "質問期限、提出期限、開札日を社内カレンダーへ登録する",
    "過去落札者と概算原価を確認して追う/見送るを判断する",
  ];
  let score = 45;

  if (bid.externalDocumentUri) {
    score += 8;
    reasons.push("公式公告URLがあり、次の確認に進みやすい");
  } else {
    score -= 12;
    risks.push("公式公告URLが検索結果に含まれていない");
  }

  if (bid.organizationName) {
    score += 5;
    reasons.push(`発注機関が確認できる: ${bid.organizationName}`);
  } else {
    risks.push("発注機関名が不明");
  }

  if (bid.prefectureName) {
    score += 4;
    reasons.push(`地域が確認できる: ${bid.prefectureName}`);
  } else {
    risks.push("地域情報が不明");
  }

  if (bid.category) {
    score += 4;
    reasons.push(`カテゴリが確認できる: ${bid.category}`);
  }

  applyKeywordFit(bid, options, reasons, risks, (delta) => {
    score += delta;
  });
  score += scoreDeadline(bid, options, reasons, risks);
  score += scoreProcedure(bid, reasons);

  if (!bid.tenderSubmissionDeadline) {
    risks.push("提出期限が不明のため、公式書類で早急に確認が必要");
    score -= 10;
  }

  const normalizedScore = clampScore(score);
  return {
    bid,
    score: normalizedScore,
    priority: toPriority(normalizedScore, risks),
    reasons: reasons.slice(0, 6),
    risks: risks.slice(0, 6),
    nextActions,
  };
}

function applyKeywordFit(
  bid: Bid,
  options: BidRankingOptions,
  reasons: string[],
  risks: string[],
  addScore: (delta: number) => void,
): void {
  const haystack = [
    bid.projectName,
    bid.projectDescription,
    bid.organizationName,
    bid.category,
    bid.procedureType,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  for (const keyword of options.preferredKeywords ?? []) {
    if (keyword && haystack.includes(keyword.toLowerCase())) {
      addScore(7);
      reasons.push(`重要キーワードに一致: ${keyword}`);
    }
  }

  for (const keyword of options.avoidKeywords ?? []) {
    if (keyword && haystack.includes(keyword.toLowerCase())) {
      addScore(-15);
      risks.push(`避けたいキーワードに一致: ${keyword}`);
    }
  }
}

function scoreDeadline(
  bid: Bid,
  options: BidRankingOptions,
  reasons: string[],
  risks: string[],
): number {
  const deadline = parseKkjDate(bid.tenderSubmissionDeadline);
  if (!deadline) {
    return 0;
  }
  const now = options.now ?? new Date();
  const daysUntilDeadline = Math.ceil(
    (startOfDay(deadline).getTime() - startOfDay(now).getTime()) / 86_400_000,
  );
  if (daysUntilDeadline < 0) {
    risks.push("提出期限を過ぎている可能性がある");
    return -35;
  }
  if (daysUntilDeadline <= 3) {
    risks.push(`提出期限まで${daysUntilDeadline}日で、対応時間が短い`);
    return -12;
  }
  const dueWithinDays = options.dueWithinDays ?? 30;
  if (daysUntilDeadline <= dueWithinDays) {
    reasons.push(`提出期限まで${daysUntilDeadline}日で検討対象に入る`);
    return 12;
  }
  risks.push(`提出期限まで${daysUntilDeadline}日あり、優先度は下げてもよい`);
  return -2;
}

function scoreProcedure(bid: Bid, reasons: string[]): number {
  const procedure = bid.procedureType ?? "";
  if (procedure.includes("一般競争")) {
    reasons.push("一般競争入札で新規参加の検討対象になりやすい");
    return 8;
  }
  if (procedure.includes("指名")) {
    return -8;
  }
  return 0;
}

function parseKkjDate(value: string | undefined): Date | null {
  return parseJapaneseDateToDate(value);
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function toPriority(score: number, risks: string[]): RankedBid["priority"] {
  if (score >= 72 && risks.length <= 2) {
    return "pursue";
  }
  if (score <= 39) {
    return "skip";
  }
  return "review";
}
