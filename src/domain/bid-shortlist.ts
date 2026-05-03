import type {
  BidRankingResult,
  BidRequirementExtraction,
  BidShortlistExport,
  RankedBid,
} from "./bid.js";

const baseColumns = [
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

const pdfExtraColumns = [
  "pdf_eligibility",
  "pdf_required_documents",
  "pdf_submission_deadline",
  "pdf_opening_date",
  "pdf_contact_point",
];

export function exportBidShortlistCsv(
  result: BidRankingResult,
  extractionMap?: Map<string, BidRequirementExtraction>,
): BidShortlistExport {
  const hasPdfData = extractionMap && extractionMap.size > 0;
  const columns = hasPdfData ? [...baseColumns, ...pdfExtraColumns] : baseColumns;
  const rows = result.rankedBids.map((rankedBid) => toShortlistRow(rankedBid, extractionMap));
  const csv = [columns, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  return {
    format: "csv",
    filename: "jp-bids-shortlist.csv",
    rankedCount: result.rankedCount,
    csv,
    columns,
    attribution: result.attribution,
    scoringPolicy: result.scoringPolicy,
  };
}

function toShortlistRow(
  rankedBid: RankedBid,
  extractionMap?: Map<string, BidRequirementExtraction>,
): string[] {
  const { bid } = rankedBid;
  const base = [
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
  if (!extractionMap || extractionMap.size === 0) {
    return base;
  }
  const extracted = extractionMap.get(bid.key)?.extractedRequirements;
  return [
    ...base,
    extracted?.eligibility.join(" / ") ?? "",
    extracted?.requiredDocuments.join(" / ") ?? "",
    extracted?.tenderSubmissionDeadline ?? "",
    extracted?.openingDate ?? "",
    extracted?.contactPoint ?? "",
  ];
}

function escapeCsvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}
