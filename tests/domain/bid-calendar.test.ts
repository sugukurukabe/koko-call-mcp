import { describe, expect, it } from "vitest";
import { createAttribution } from "../../src/domain/attribution.js";
import { createBidCalendarExport } from "../../src/domain/bid-calendar.js";

describe("bid calendar export", () => {
  it("creates ICS events from known bid dates", () => {
    const exported = createBidCalendarExport(
      {
        resultId: 1,
        key: "KKJ-001",
        projectName: "システム保守",
        organizationName: "鹿児島市",
        tenderSubmissionDeadline: "2026-05-15",
        openingTendersEvent: "2026-05-20",
        periodEndTime: "2027-03-31",
      },
      createAttribution(),
    );

    expect(exported.eventCount).toBe(4);
    expect(exported.events.map((event) => event.kind)).toEqual(
      expect.arrayContaining(["internal_review", "submission_deadline", "opening", "period_end"]),
    );
    expect(exported.ics).toContain("BEGIN:VCALENDAR");
    expect(exported.ics).toContain("DTSTART;VALUE=DATE:20260515");
    expect(exported.missingDates).toContain("質問期限");
  });
});
