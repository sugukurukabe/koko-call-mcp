import type { Attribution } from "./attribution.js";
import type { Bid, BidSearchResult, PastAwardSummary } from "./bid.js";

const TOP_ORG_LIMIT = 10;

export interface PastAwardsOptions {
  windowDays: number;
}

export function summarizePastAwards(
  searchResult: BidSearchResult,
  options: PastAwardsOptions,
  attribution: Attribution,
): PastAwardSummary {
  const topOrganizations = aggregateOrganizations(searchResult.bids);
  const categoryBreakdown = countBy(searchResult.bids.map((bid) => bid.category ?? "不明"));
  const procedureBreakdown = countBy(searchResult.bids.map((bid) => bid.procedureType ?? "不明"));
  const monthlyVolume = countByMonth(searchResult.bids);
  return {
    query: searchResult.query,
    totalHits: searchResult.searchHits,
    returnedCount: searchResult.returnedCount,
    windowDays: options.windowDays,
    topOrganizations,
    categoryBreakdown,
    procedureBreakdown,
    monthlyVolume,
    insights: buildInsights(topOrganizations, categoryBreakdown, procedureBreakdown),
    caveats: [
      "本サマリーは官公需情報ポータルサイトの公告データに基づく。実際の落札情報・落札金額は含まれない。",
      "発注機関ごとのカウントは公告件数であり、案件の重複や中止案件を含む可能性がある。",
      "競合分析・落札確率の判定は公式落札公表ページや過去落札データベースで検証する必要がある。",
    ],
    attribution,
  };
}

function aggregateOrganizations(bids: Bid[]): PastAwardSummary["topOrganizations"] {
  const buckets = new Map<
    string,
    {
      organizationName: string;
      bidCount: number;
      categories: Set<string>;
      procedureTypes: Set<string>;
      recentBid?: Bid;
    }
  >();

  for (const bid of bids) {
    const name = bid.organizationName ?? "不明";
    const bucket = buckets.get(name) ?? {
      organizationName: name,
      bidCount: 0,
      categories: new Set<string>(),
      procedureTypes: new Set<string>(),
    };
    bucket.bidCount += 1;
    if (bid.category) {
      bucket.categories.add(bid.category);
    }
    if (bid.procedureType) {
      bucket.procedureTypes.add(bid.procedureType);
    }
    if (!bucket.recentBid || isLater(bid, bucket.recentBid)) {
      bucket.recentBid = bid;
    }
    buckets.set(name, bucket);
  }

  return [...buckets.values()]
    .sort(
      (left, right) =>
        right.bidCount - left.bidCount ||
        left.organizationName.localeCompare(right.organizationName),
    )
    .slice(0, TOP_ORG_LIMIT)
    .map((bucket) => {
      const recentBidDate = bucket.recentBid?.cftIssueDate ?? bucket.recentBid?.date;
      const entry: PastAwardSummary["topOrganizations"][number] = {
        organizationName: bucket.organizationName,
        bidCount: bucket.bidCount,
        categories: [...bucket.categories],
        procedureTypes: [...bucket.procedureTypes],
      };
      if (bucket.recentBid?.key) {
        entry.recentBidKey = bucket.recentBid.key;
      }
      if (recentBidDate) {
        entry.recentBidDate = recentBidDate;
      }
      return entry;
    });
}

function isLater(left: Bid, right: Bid): boolean {
  const leftDate = (left.cftIssueDate ?? left.date ?? "").slice(0, 10);
  const rightDate = (right.cftIssueDate ?? right.date ?? "").slice(0, 10);
  return leftDate > rightDate;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}

function countByMonth(bids: Bid[]): PastAwardSummary["monthlyVolume"] {
  const buckets = new Map<string, number>();
  for (const bid of bids) {
    const date = (bid.cftIssueDate ?? bid.date ?? "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(date)) {
      continue;
    }
    buckets.set(date, (buckets.get(date) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([leftMonth], [rightMonth]) => leftMonth.localeCompare(rightMonth))
    .map(([month, count]) => ({ month, count }));
}

function buildInsights(
  topOrganizations: PastAwardSummary["topOrganizations"],
  categoryBreakdown: Record<string, number>,
  procedureBreakdown: Record<string, number>,
): string[] {
  const insights: string[] = [];
  const dominantOrg = topOrganizations[0];
  if (dominantOrg && dominantOrg.bidCount >= 2) {
    insights.push(
      `${dominantOrg.organizationName} が公告数トップ (${dominantOrg.bidCount}件)。常連発注機関として注目候補。`,
    );
  }
  const namedOnly = topOrganizations.filter((org) => org.organizationName !== "不明");
  if (namedOnly.length >= 3) {
    const names = namedOnly
      .slice(0, 3)
      .map((org) => org.organizationName)
      .join(", ");
    insights.push(`公告数の多い上位3機関: ${names}`);
  }
  const dominantCategory = pickDominant(categoryBreakdown);
  if (dominantCategory) {
    insights.push(`カテゴリは「${dominantCategory.key}」が最多 (${dominantCategory.count}件)。`);
  }
  const dominantProcedure = pickDominant(procedureBreakdown);
  if (dominantProcedure) {
    insights.push(`手続種別は「${dominantProcedure.key}」が最多 (${dominantProcedure.count}件)。`);
  }
  if (insights.length === 0) {
    insights.push("件数が少なく傾向は判別できません。検索条件を広げて再実行してください。");
  }
  return insights;
}

function pickDominant(counts: Record<string, number>): { key: string; count: number } | null {
  const entries = Object.entries(counts).filter(([key]) => key !== "不明");
  if (entries.length === 0) {
    return null;
  }
  entries.sort((left, right) => right[1] - left[1]);
  const [key, count] = entries[0] as [string, number];
  return { key, count };
}
