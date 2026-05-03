import type { BidRankingResult, BidShortlistExport, RankedBid } from "./bid.js";

const shortlistColumns = [
  "priority",
  "score",
  "key",
  "project_name",
  "organization_name",
  "prefecture",
  "city",
  "category",
  "procedure_type",
  "notice_date",
  "tender_submission_deadline",
  "opening_tenders_event",
  "fit_reasons",
  "risks",
  "next_action",
  "official_url",
];

export function exportBidShortlistCsv(result: BidRankingResult): BidShortlistExport {
  const rows = result.rankedBids.map(toShortlistRow);
  const csv = [shortlistColumns, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  return {
    format: "csv",
    filename: "jp-bids-shortlist.csv",
    rankedCount: result.rankedCount,
    csv,
    columns: shortlistColumns,
    attribution: result.attribution,
    scoringPolicy: result.scoringPolicy,
  };
}

function toShortlistRow(rankedBid: RankedBid): string[] {
  const { bid } = rankedBid;
  return [
    rankedBid.priority,
    String(rankedBid.score),
    bid.key,
    bid.projectName,
    bid.organizationName ?? "",
    bid.prefectureName ?? "",
    bid.cityName ?? "",
    bid.category ?? "",
    bid.procedureType ?? "",
    bid.cftIssueDate ?? "",
    bid.tenderSubmissionDeadline ?? "",
    bid.openingTendersEvent ?? "",
    rankedBid.reasons.join(" / "),
    rankedBid.risks.join(" / "),
    rankedBid.nextActions[0] ?? "",
    bid.externalDocumentUri ?? "",
  ];
}

function escapeCsvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}
