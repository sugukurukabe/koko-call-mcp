import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatKkjDateRange } from "../../src/domain/date-range.js";

describe("formatKkjDateRange", () => {
  it("formats open and closed KKJ date ranges", () => {
    expect(formatKkjDateRange("2026-05-01", "2026-05-10")).toBe("2026-05-01/2026-05-10");
    expect(formatKkjDateRange("2026-05-01", undefined)).toBe("2026-05-01/");
    expect(formatKkjDateRange(undefined, "2026-05-10")).toBe("/2026-05-10");
    expect(formatKkjDateRange("2026-05-01", "2026-05-01")).toBe("2026-05-01");
  });

  it("rejects non date-only values", () => {
    fc.assert(
      fc.property(
        fc.string().filter((value) => value.length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(value)),
        (value) => {
          expect(() => formatKkjDateRange(value, undefined)).toThrow();
        },
      ),
    );
  });
});
