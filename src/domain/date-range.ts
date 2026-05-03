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

/**
 * 和暦（令和N年M月D日）またはISO/slash日付文字列をDateに変換する（UTC midnight）
 * Converts wareki (令和N年M月D日) or ISO/slash date strings to Date (UTC midnight)
 * Mengonversi wareki (令和N年M月D日) atau string tanggal ISO/slash ke Date (UTC midnight)
 */
export function parseJapaneseDateToDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  const components = extractDateComponents(value);
  if (!components) {
    return null;
  }
  const date = new Date(Date.UTC(components.year, components.month - 1, components.day));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function extractDateComponents(
  value: string,
): { year: number; month: number; day: number } | null {
  const isoMatch = /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(value);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    if (year && month && day) {
      return { year: Number(year), month: Number(month), day: Number(day) };
    }
  }
  const warekiMatch = /(?:令和|R)\s*(\d{1,2})年\s*(\d{1,2})月\s*(\d{1,2})日/.exec(value);
  if (warekiMatch) {
    const [, era, month, day] = warekiMatch;
    if (era && month && day) {
      return {
        year: 2018 + Number(era),
        month: Number(month),
        day: Number(day),
      };
    }
  }
  return null;
}
