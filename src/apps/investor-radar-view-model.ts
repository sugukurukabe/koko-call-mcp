import type { AwardMappingResult } from "../domain/investor.js";
import { INVESTMENT_DISCLAIMER } from "../domain/listed-company.js";

export interface InvestorCardViewModel {
  key: string;
  projectName: string;
  organizationName: string;
  prefectureName: string;
  noticeDate: string;
  companyName: string;
  ticker: string;
  sector: string;
  officialUrl: string;
}

export interface SparklinePoint {
  date: string;
  close: number;
}

export interface InvestorWorkspaceViewModel {
  cards: InvestorCardViewModel[];
  companySummaries: Array<{
    code: string;
    name: string;
    noticeCount: number;
    latestNoticeDate: string;
  }>;
  mappedCount: number;
  unmappedCount: number;
  catalogSource: string;
  dataSource: string;
  accessedAt: string;
  disclaimer: string;
}

export function toInvestorWorkspaceViewModel(
  result: AwardMappingResult,
): InvestorWorkspaceViewModel {
  return {
    cards: result.mapped.map((item) => {
      const primary = item.matches[0];
      return {
        key: item.bid.key,
        projectName: item.bid.projectName,
        organizationName: item.bid.organizationName ?? "不明",
        prefectureName: item.bid.prefectureName ?? "不明",
        noticeDate: item.bid.cftIssueDate ?? item.bid.date ?? "不明",
        companyName: primary?.company.name ?? "未一致",
        ticker: primary?.company.code ?? "-",
        sector: primary?.company.sector ?? "",
        officialUrl: item.bid.externalDocumentUri ?? "",
      };
    }),
    companySummaries: result.companies.map((entry) => ({
      code: entry.company.code,
      name: entry.company.name,
      noticeCount: entry.noticeCount,
      latestNoticeDate: entry.latestNoticeDate ?? "不明",
    })),
    mappedCount: result.mappedCount,
    unmappedCount: result.unmappedCount,
    catalogSource: result.catalogSource,
    dataSource: result.attribution.dataSource,
    accessedAt: result.attribution.accessedAt,
    disclaimer: result.investmentDisclaimer || INVESTMENT_DISCLAIMER,
  };
}

export function sparklinePath(points: readonly SparklinePoint[], width = 240, height = 64): string {
  if (points.length === 0) {
    return "";
  }
  const closes = points.map((point) => point.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  return points
    .map((point, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
      const y = height - ((point.close - min) / span) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function isAllowedOfficialLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    return (
      parsed.origin === "https://www.kkj.go.jp" ||
      parsed.origin === "https://disclosure.edinet-fsa.go.jp" ||
      parsed.origin === "https://www.release.tdnet.info" ||
      parsed.origin === "https://jpx-jquants.com"
    );
  } catch {
    return false;
  }
}
