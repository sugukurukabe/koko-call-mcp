import type { Attribution } from "./attribution.js";
import type { Bid, BidCalendarExport, ExtractedBidRequirements } from "./bid.js";
import { parseJapaneseDateToDate } from "./date-range.js";

type CalendarEvent = BidCalendarExport["events"][number];

export function createBidCalendarExport(
  bid: Bid,
  attribution: Attribution,
  extractedRequirements?: ExtractedBidRequirements,
): BidCalendarExport {
  const events = buildEvents(bid, extractedRequirements);
  return {
    format: "ics",
    filename: `jp-bids-${sanitizeFilename(bid.key)}.ics`,
    eventCount: events.length,
    ics: toIcs(bid, events, attribution),
    events,
    missingDates: findMissingDates(bid, extractedRequirements),
    attribution,
  };
}

function buildEvents(bid: Bid, extracted?: ExtractedBidRequirements): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const submissionDate =
    normalizeDate(bid.tenderSubmissionDeadline) ??
    normalizeDate(extracted?.tenderSubmissionDeadline ?? undefined);
  if (submissionDate) {
    const internalReviewDate = addDays(submissionDate, -2);
    events.push({
      title: `社内確認: ${bid.projectName}`,
      date: internalReviewDate,
      kind: "internal_review",
      sourceField: "tenderSubmissionDeadline - 2 days",
    });
    events.push({
      title: `提出期限: ${bid.projectName}`,
      date: submissionDate,
      kind: "submission_deadline",
      sourceField: "tenderSubmissionDeadline",
    });
  }

  const openingDate =
    normalizeDate(bid.openingTendersEvent) ?? normalizeDate(extracted?.openingDate ?? undefined);
  if (openingDate) {
    events.push({
      title: `開札日: ${bid.projectName}`,
      date: openingDate,
      kind: "opening",
      sourceField: "openingTendersEvent",
    });
  }

  const periodEndDate = normalizeDate(bid.periodEndTime);
  if (periodEndDate) {
    events.push({
      title: `納入期限/契約終了: ${bid.projectName}`,
      date: periodEndDate,
      kind: "period_end",
      sourceField: "periodEndTime",
    });
  }

  const briefingDate = normalizeDate(extracted?.briefingDate ?? undefined);
  if (briefingDate) {
    events.push({
      title: `入札説明会: ${bid.projectName}`,
      date: briefingDate,
      kind: "internal_review",
      sourceField: "extractedRequirements.briefingDate",
    });
  }

  return events;
}

function findMissingDates(bid: Bid, extracted?: ExtractedBidRequirements): string[] {
  const missing: string[] = [];
  if (!extracted?.questionDeadline) {
    missing.push("質問期限");
  }
  if (!bid.tenderSubmissionDeadline && !extracted?.tenderSubmissionDeadline) {
    missing.push("提出期限");
  }
  if (!bid.openingTendersEvent && !extracted?.openingDate) {
    missing.push("開札日");
  }
  if (!bid.periodEndTime && !extracted?.deliveryDeadline) {
    missing.push("納入期限または契約終了日");
  }
  return missing;
}

function toIcs(bid: Bid, events: CalendarEvent[], attribution: Attribution): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JP Bids MCP//AI Bid Radar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(`${bid.key}-${event.kind}-${event.date}`)}@jp-bids-mcp`,
      `DTSTAMP:${formatUtcDateTime(new Date())}`,
      `DTSTART;VALUE=DATE:${formatIcsDate(event.date)}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `DESCRIPTION:${escapeIcsText(
        [
          `Key: ${bid.key}`,
          `Organization: ${bid.organizationName ?? "unknown"}`,
          `Source field: ${event.sourceField}`,
          `Data source: ${attribution.dataSource}`,
          "Verify official procurement documents before bidding decisions.",
        ].join("\\n"),
      )}`,
      ...(bid.externalDocumentUri ? [`URL:${bid.externalDocumentUri}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function normalizeDate(value: string | undefined): string | null {
  const parsed = parseJapaneseDateToDate(value);
  if (!parsed) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatIcsDate(date: string): string {
  return date.replaceAll("-", "");
}

function formatUtcDateTime(date: Date): string {
  return date
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
}
