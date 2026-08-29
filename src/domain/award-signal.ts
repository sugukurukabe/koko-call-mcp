import type { Attribution } from "./attribution.js";
import type { Bid } from "./bid.js";
import { INVESTMENT_DISCLAIMER, type ListedCompany, type ListedMatch } from "./listed-company.js";

export interface MappedAward {
  bid: Bid;
  matches: ListedMatch[];
}

export interface ListedAwardFacts {
  company: ListedCompany;
  noticeCount: number;
  latestNoticeDate: string | null;
  latestNoticeKey: string | null;
  prefectureBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  noticeKeys: string[];
}

export interface AwardSignalSummary {
  mappedCount: number;
  unmappedCount: number;
  companies: ListedAwardFacts[];
  caveats: string[];
  investmentDisclaimer: string;
  attribution: Attribution;
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function noticeDate(bid: Bid): string | undefined {
  return bid.cftIssueDate ?? bid.date;
}

function isLaterNotice(left: Bid, right: Bid): boolean {
  const leftDate = noticeDate(left) ?? "";
  const rightDate = noticeDate(right) ?? "";
  return leftDate > rightDate;
}

export function summarizeListedAwards(
  mapped: readonly MappedAward[],
  unmappedCount: number,
  attribution: Attribution,
): AwardSignalSummary {
  const byCode = new Map<
    string,
    {
      company: ListedCompany;
      bids: Bid[];
    }
  >();

  for (const item of mapped) {
    for (const match of item.matches) {
      const bucket = byCode.get(match.company.code) ?? {
        company: match.company,
        bids: [],
      };
      bucket.bids.push(item.bid);
      byCode.set(match.company.code, bucket);
    }
  }

  const companies: ListedAwardFacts[] = [...byCode.values()]
    .map((bucket) => {
      const latest = bucket.bids.reduce<Bid | undefined>((current, bid) => {
        if (!current || isLaterNotice(bid, current)) {
          return bid;
        }
        return current;
      }, undefined);
      return {
        company: bucket.company,
        noticeCount: bucket.bids.length,
        latestNoticeDate: latest ? (noticeDate(latest) ?? null) : null,
        latestNoticeKey: latest?.key ?? null,
        prefectureBreakdown: countBy(bucket.bids.map((bid) => bid.prefectureName ?? "不明")),
        categoryBreakdown: countBy(bucket.bids.map((bid) => String(bid.category ?? "不明"))),
        noticeKeys: bucket.bids.map((bid) => bid.key),
      };
    })
    .sort(
      (left, right) =>
        right.noticeCount - left.noticeCount || left.company.code.localeCompare(right.company.code),
    );

  return {
    mappedCount: mapped.length,
    unmappedCount,
    companies,
    caveats: [
      "KKJ検索結果は入札公告であり、公式の落札者・落札金額を含まない。",
      "銘柄への紐付けは企業名の名寄せであり、当該企業が受注したことを意味しない。",
      INVESTMENT_DISCLAIMER,
    ],
    investmentDisclaimer: INVESTMENT_DISCLAIMER,
    attribution,
  };
}

export function bidSearchText(bid: Bid): string {
  return [bid.projectName, bid.projectDescription, bid.organizationName].filter(Boolean).join(" ");
}
