import type { Bid, BidSearchResult } from "../domain/bid.js";

export interface BidCardViewModel {
  key: string;
  projectName: string;
  organizationName: string;
  prefectureName: string;
  category: string;
  cftIssueDate: string;
  submissionDeadline: string;
  openingDate: string;
  officialUrl: string;
  hasPdf: boolean;
  daysUntilDeadline: number | null;
  deadlineUrgency: "overdue" | "urgent" | "normal" | "unknown";
  quickScore: number;
  priorityLabel: "pursue" | "review" | "skip";
  actionState: "unread" | "pdf_extracted" | "qualified" | "memo_created";
}

export interface WorkspaceViewModel {
  cards: BidCardViewModel[];
  totalHits: number;
  returnedCount: number;
  dataSource: string;
  accessedAt: string;
}

export function toWorkspaceViewModel(
  result: BidSearchResult,
  now: Date = new Date(),
): WorkspaceViewModel {
  return {
    cards: result.bids.map((bid) => toBidCardViewModel(bid, now)),
    totalHits: result.searchHits,
    returnedCount: result.returnedCount,
    dataSource: result.attribution.dataSource,
    accessedAt: result.attribution.accessedAt,
  };
}

export function toBidCardViewModel(bid: Bid, now: Date = new Date()): BidCardViewModel {
  const hasPdf =
    bid.fileType === "pdf" ||
    (bid.externalDocumentUri ?? "").toLowerCase().endsWith(".pdf") ||
    (bid.attachments ?? []).some((attachment) => attachment.name.toLowerCase().endsWith(".pdf"));

  const daysUntilDeadline = computeDaysUntilDeadline(bid.tenderSubmissionDeadline, now);
  const deadlineUrgency = computeDeadlineUrgency(daysUntilDeadline);
  const quickScore = computeQuickScore(bid, daysUntilDeadline);
  const priorityLabel = computePriorityLabel(quickScore);

  return {
    key: bid.key,
    projectName: bid.projectName,
    organizationName: bid.organizationName ?? "-",
    prefectureName: bid.prefectureName ?? "-",
    category: bid.category ?? "-",
    cftIssueDate: bid.cftIssueDate ?? "-",
    submissionDeadline: bid.tenderSubmissionDeadline ?? "-",
    openingDate: bid.openingTendersEvent ?? "-",
    officialUrl: bid.externalDocumentUri ?? "",
    hasPdf,
    daysUntilDeadline,
    deadlineUrgency,
    quickScore,
    priorityLabel,
    actionState: "unread",
  };
}

function computeDaysUntilDeadline(deadline: string | undefined, now: Date): number | null {
  if (!deadline) {
    return null;
  }
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return Math.ceil((parsed.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function computeDeadlineUrgency(
  daysUntilDeadline: number | null,
): BidCardViewModel["deadlineUrgency"] {
  if (daysUntilDeadline === null) {
    return "unknown";
  }
  if (daysUntilDeadline < 0) {
    return "overdue";
  }
  if (daysUntilDeadline <= 7) {
    return "urgent";
  }
  return "normal";
}

function computeQuickScore(bid: Bid, daysUntilDeadline: number | null): number {
  let score = 40;
  if (bid.externalDocumentUri) {
    score += 10;
  }
  if (bid.organizationName) {
    score += 5;
  }
  if (bid.tenderSubmissionDeadline) {
    score += 10;
  }
  if (bid.openingTendersEvent) {
    score += 5;
  }
  if (bid.certification) {
    score += 5;
  }
  if (daysUntilDeadline !== null && daysUntilDeadline > 0 && daysUntilDeadline <= 30) {
    score += 10;
  }
  if (bid.fileType === "pdf" || (bid.externalDocumentUri ?? "").toLowerCase().endsWith(".pdf")) {
    score += 5;
  }
  return Math.min(100, Math.max(0, score));
}

function computePriorityLabel(score: number): BidCardViewModel["priorityLabel"] {
  if (score >= 70) {
    return "pursue";
  }
  if (score >= 45) {
    return "review";
  }
  return "skip";
}
