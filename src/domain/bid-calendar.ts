import type { Attribution } from "./attribution.js";
import type { Bid, BidCalendarExport } from "./bid.js";

type CalendarEvent = BidCalendarExport["events"][number];

export function createBidCalendarExport(bid: Bid, attribution: Attribution): BidCalendarExport {
  const events = buildEvents(bid);
  return {
    format: "ics",
    filename: `jp-bids-${sanitizeFilename(bid.key)}.ics`,
    eventCount: events.length,
    ics: toIcs(bid, events, attribution),
    events,
    missingDates: findMissingDates(bid),
    attribution,
  };
}

function buildEvents(bid: Bid): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const submissionDate = normalizeDate(bid.tenderSubmissionDeadline);
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

  const openingDate = normalizeDate(bid.openingTendersEvent);
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

  return events;
}

function findMissingDates(bid: Bid): string[] {
  const missing: string[] = ["質問期限"];
  if (!bid.tenderSubmissionDeadline) {
    missing.push("提出期限");
  }
  if (!bid.openingTendersEvent) {
    missing.push("開札日");
  }
  if (!bid.periodEndTime) {
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
  if (!value) {
    return null;
  }
  const match = /(\d{4})[-/](\d{2})[-/](\d{2})/.exec(value);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  if (!year || !month || !day) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00+09:00`);
  value.setDate(value.getDate() + days);
  return [
    String(value.getFullYear()).padStart(4, "0"),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
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
