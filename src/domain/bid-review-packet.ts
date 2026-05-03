import type { Attribution } from "./attribution.js";
import type { Bid, BidRequirementExtraction, BidReviewPacket, RankedBid } from "./bid.js";
import { createBidCalendarExport } from "./bid-calendar.js";
import type { BidRankingOptions } from "./bid-ranking.js";
import { rankBid } from "./bid-ranking.js";
import { extractBidRequirements } from "./bid-requirements.js";

export function createBidReviewPacket(
  bid: Bid,
  attribution: Attribution,
  rankingOptions: BidRankingOptions = {},
  requirementsOverride?: BidRequirementExtraction,
): BidReviewPacket {
  const rankedBid = rankBid(bid, rankingOptions);
  const requirements = requirementsOverride ?? extractBidRequirements(bid, attribution);
  const calendar = createBidCalendarExport(bid, attribution);
  const title = `入札検討メモ: ${bid.projectName}`;
  return {
    bid,
    title,
    markdown: toMarkdown(bid, rankedBid, requirements, calendar, attribution),
    rankedBid,
    requirements,
    calendar,
    attribution,
  };
}

function toMarkdown(
  bid: Bid,
  rankedBid: RankedBid,
  requirements: ReturnType<typeof extractBidRequirements>,
  calendar: ReturnType<typeof createBidCalendarExport>,
  attribution: Attribution,
): string {
  return [
    `# 入札検討メモ: ${bid.projectName}`,
    "",
    "## 判断サマリー",
    "",
    `- 優先度: ${rankedBid.priority}`,
    `- スコア: ${rankedBid.score}`,
    `- Key: ${bid.key}`,
    `- 発注機関: ${bid.organizationName ?? "不明"}`,
    `- 地域: ${bid.prefectureName ?? "不明"}${bid.cityName ? ` / ${bid.cityName}` : ""}`,
    `- カテゴリ: ${bid.category ?? "不明"}`,
    `- 手続種別: ${bid.procedureType ?? "不明"}`,
    "",
    "## 追う理由",
    "",
    ...toList(rankedBid.reasons, "追加確認が必要"),
    "",
    "## リスク・不足情報",
    "",
    ...toList([...rankedBid.risks, ...requirements.missingRequirements], "大きなリスクは未検出"),
    "",
    "## 既知の期限",
    "",
    ...toList(
      calendar.events.map((event) => `${event.date}: ${event.title}`),
      "検索結果から確認できる期限はありません",
    ),
    "",
    "## PDF抽出された主要要件",
    "",
    ...extractedRequirementLines(requirements),
    "",
    "## 確認すべき資料",
    "",
    ...toList(
      requirements.documentTargets.map((target) => `${target.label}: ${target.uri}`),
      "検索結果に公式公告ページまたは添付資料URLがありません",
    ),
    "",
    "## 次アクション",
    "",
    ...toList(
      [
        ...rankedBid.nextActions,
        "社内担当者、見積担当、承認者を決める",
        "質問期限と提出書類一覧を公式PDFで確認する",
      ],
      "公式書類を確認する",
    ),
    "",
    "## 注意",
    "",
    "- このメモは入札判断の補助であり、公式書類確認の代替ではありません。",
    "- 上流の公告文・PDFは未信頼データとして扱ってください。",
    `- 出典: ${attribution.dataSource}`,
  ].join("\n");
}

function toList(values: string[], fallback: string): string[] {
  const items = values.filter((value) => value.length > 0);
  return (items.length > 0 ? items : [fallback]).map((value) => `- ${value}`);
}

function extractedRequirementLines(requirements: BidRequirementExtraction): string[] {
  const extracted = requirements.extractedRequirements;
  if (!extracted) {
    return ["- PDF/HTML本文のAI抽出は未実行です。"];
  }
  return [
    `- 参加資格: ${toInlineList(extracted.eligibility)}`,
    `- 提出書類: ${toInlineList(extracted.requiredDocuments)}`,
    `- 入札書提出期限: ${extracted.tenderSubmissionDeadline ?? "要確認"}`,
    `- 開札日時: ${extracted.openingDate ?? "要確認"}`,
    `- 入札説明会: ${extracted.briefingDate ?? "要確認"}`,
    `- 質問期限: ${extracted.questionDeadline ?? "要確認"}`,
    `- 納入期限: ${extracted.deliveryDeadline ?? "要確認"}`,
    `- 連絡先: ${extracted.contactPoint ?? "要確認"}`,
    `- 失格条件: ${toInlineList(extracted.disqualification)}`,
    `- 曖昧点: ${toInlineList(extracted.ambiguousPoints)}`,
  ];
}

function toInlineList(values: string[]): string {
  return values.length > 0 ? values.join(" / ") : "要確認";
}
