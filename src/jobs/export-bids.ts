import type { KkjClient, KkjSearchParams } from "../api/kkj-client.js";
import type { Bid, BidSearchResult } from "../domain/bid.js";
import { type Category, CategorySchema, categoryCodes } from "../domain/codes.js";
import { daysAgoDate, formatKkjDateRange, todayDate } from "../domain/date-range.js";
import { type PrefectureName, PrefectureNameSchema, toLgCode } from "../domain/prefectures.js";

export type ExportFormat = "csv" | "json";

export interface ExportBidsConfig {
  prefectures: PrefectureName[];
  category?: Category;
  queryTerms: string[];
  organizationName?: string;
  days: number;
  limit: number;
  format: ExportFormat;
}

export function parseExportBidsConfig(argv: string[], env: NodeJS.ProcessEnv): ExportBidsConfig {
  const args = parseArgs(argv);
  const categoryValue = args.category ?? env.JP_BIDS_EXPORT_CATEGORY;
  const organizationName = args.organization ?? env.JP_BIDS_EXPORT_ORGANIZATION;

  return {
    prefectures: parsePrefectures(args.prefecture ?? env.JP_BIDS_EXPORT_PREFECTURES ?? "鹿児島県"),
    ...(categoryValue ? { category: CategorySchema.parse(categoryValue) } : {}),
    queryTerms: parseCsv(args.query ?? env.JP_BIDS_EXPORT_QUERIES ?? "システム"),
    ...(organizationName ? { organizationName } : {}),
    days: parsePositiveInt(args.days ?? env.JP_BIDS_EXPORT_DAYS, 7, 1, 365),
    limit: parsePositiveInt(args.limit ?? env.JP_BIDS_EXPORT_LIMIT, 100, 1, 1000),
    format: parseFormat(args.format ?? env.JP_BIDS_EXPORT_FORMAT ?? "csv"),
  };
}

export async function exportBids(
  client: KkjClient,
  config: ExportBidsConfig,
): Promise<{
  result: BidSearchResult;
  output: string;
}> {
  const since = daysAgoDate(config.days);
  const until = todayDate();
  const issueRange = formatKkjDateRange(since, until);
  const params: KkjSearchParams = {
    LG_Code: toLgCode(config.prefectures),
    Count: config.limit,
    ...(issueRange ? { CFT_Issue_Date: issueRange } : {}),
  };

  if (config.queryTerms.length > 0) {
    params.Query = config.queryTerms.join(" OR ");
  }
  if (config.organizationName) {
    params.Organization_Name = config.organizationName;
  }
  if (config.category) {
    params.Category = categoryCodes[config.category];
  }

  const result = await client.search(params);
  return {
    result,
    output: config.format === "json" ? JSON.stringify(result, null, 2) : toCsv(result.bids),
  };
}

export function toCsv(bids: Bid[]): string {
  const header = [
    "key",
    "project_name",
    "organization_name",
    "prefecture",
    "city",
    "category",
    "procedure_type",
    "certification",
    "notice_date",
    "tender_submission_deadline",
    "opening_tenders_event",
    "period_end_time",
    "external_document_uri",
  ];
  const rows = bids.map((bid) => [
    bid.key,
    bid.projectName,
    bid.organizationName ?? "",
    bid.prefectureName ?? "",
    bid.cityName ?? "",
    bid.category ?? "",
    bid.procedureType ?? "",
    bid.certification ?? "",
    bid.cftIssueDate ?? "",
    bid.tenderSubmissionDeadline ?? "",
    bid.openingTendersEvent ?? "",
    bid.periodEndTime ?? "",
    bid.externalDocumentUri ?? "",
  ]);

  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function parseArgs(argv: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item?.startsWith("--")) {
      continue;
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parsePrefectures(value: string): PrefectureName[] {
  return parseCsv(value).map((item) => PrefectureNameSchema.parse(item));
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Expected integer between ${min} and ${max}, got ${value}`);
  }
  return parsed;
}

function parseFormat(value: string): ExportFormat {
  if (value === "csv" || value === "json") {
    return value;
  }
  throw new Error(`Unsupported format: ${value}`);
}

function escapeCsvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}
