const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export function assertDateOnly(value: string, fieldName: string): string {
  if (!dateOnlyPattern.test(value)) {
    throw new Error(`${fieldName} must be YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a real calendar date`);
  }
  return value;
}

export function formatKkjDateRange(after?: string, before?: string): string | undefined {
  if (!after && !before) {
    return undefined;
  }
  if (after) {
    assertDateOnly(after, "after");
  }
  if (before) {
    assertDateOnly(before, "before");
  }
  if (after && before && after === before) {
    return after;
  }
  return `${after ?? ""}/${before ?? ""}`;
}

export function daysAgoDate(days: number, now = new Date()): string {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function todayDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
