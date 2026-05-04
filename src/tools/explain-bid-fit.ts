import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient } from "../api/kkj-client.js";
import { createAttribution } from "../domain/attribution.js";
import { BidFitExplanationSchema } from "../domain/bid.js";
import { type BidRankingOptions, bidRankingScoringPolicy, rankBid } from "../domain/bid-ranking.js";
import { extractBidRequirements } from "../domain/bid-requirements.js";
import { UserInputError } from "../lib/errors.js";
import { toolError } from "../lib/tool-result.js";
import { enrichWithDocumentExtraction } from "./document-extraction.js";

const inputSchema = {
  bid_key: z
    .string()
    .min(1)
    .describe("search_bids、rank_bids、またはlist_recent_bidsが返したKeyフィールド"),
  preferred_keywords: z
    .array(z.string().min(1))
    .optional()
    .describe("優先したい語句。例: ソフトウェア、保守、クラウド。"),
  avoid_keywords: z
    .array(z.string().min(1))
    .optional()
    .describe("避けたい語句。例: 工事、常駐、夜間。"),
  due_within_days: z
    .number()
    .int()
    .min(1)
    .max(180)
    .default(30)
    .describe("この日数以内に提出期限が来る案件を優先。デフォルト30日。"),
  fetch_documents: z
    .boolean()
    .default(false)
    .describe("trueの場合、PDF/HTML抽出結果を追跡判断の説明に反映する。"),
  target_uris: z
    .array(z.string().url())
    .max(3)
    .optional()
    .describe("抽出対象URL。省略時は検索結果の公式公告ページ・添付資料URLから最大3件を使う。"),
};

export function registerExplainBidFit(server: McpServer, client: KkjClient): void {
  server.registerTool(
    "explain_bid_fit",
    {
      title: "入札追跡判断の説明",
      description:
        "1件の入札について追うべきか・要確認か・見送るべきかを理由・リスク・次アクション付きで説明する。Explain bid fit with rationale, risks, and next actions for one bid. Jelaskan kesesuaian tender dengan alasan, risiko, dan langkah selanjutnya.",
      inputSchema,
      outputSchema: BidFitExplanationSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const cached = client.getCachedBid(args.bid_key);
        const result = cached
          ? {
              bid: cached,
              attribution: createAttribution(),
            }
          : await findBidByKey(client, args.bid_key);
        const rankingOptions: BidRankingOptions = {
          dueWithinDays: args.due_within_days,
        };
        if (args.preferred_keywords) {
          rankingOptions.preferredKeywords = args.preferred_keywords;
        }
        if (args.avoid_keywords) {
          rankingOptions.avoidKeywords = args.avoid_keywords;
        }
        const rankedBid = rankBid(result.bid, rankingOptions);
        const baseRequirements = extractBidRequirements(result.bid, result.attribution);
        const requirements = args.fetch_documents
          ? await enrichWithDocumentExtraction(server, baseRequirements, args.target_uris)
          : baseRequirements;
        const extracted = requirements.extractedRequirements;
        const checklist = [
          "公式公告ページまたは仕様書PDFで参加条件を確認する",
          "全省庁統一資格・自治体資格・営業品目が一致するか確認する",
          "質問期限、提出期限、開札日を社内カレンダーへ登録する",
          "過去落札者、落札価格、競合常連の有無を確認する",
          "概算工数、外注費、交通費、粗利を確認する",
        ];
        if (extracted) {
          if (extracted.eligibility.length > 0) {
            checklist.push(`PDF抽出で確認済みの参加資格: ${extracted.eligibility.join(" / ")}`);
          }
          if (extracted.tenderSubmissionDeadline) {
            checklist.push(`PDF抽出で確認済みの提出期限: ${extracted.tenderSubmissionDeadline}`);
          }
          if (extracted.contactPoint) {
            checklist.push(`連絡先: ${extracted.contactPoint}`);
          }
          for (const point of extracted.ambiguousPoints) {
            checklist.push(`曖昧点（要確認）: ${point}`);
          }
        }
        const explanation = {
          rankedBid,
          fitSummary: formatFitSummary(rankedBid),
          confirmationChecklist: checklist,
          attribution: result.attribution,
          scoringPolicy: bidRankingScoringPolicy,
        };
        return {
          content: [{ type: "text" as const, text: formatExplanationText(explanation) }],
          structuredContent: explanation,
        };
      } catch (error) {
        return toolError(
          error,
          "入札追跡判断の説明で一時的なエラーが発生しました。rank_bidsで取得した最新のbid_keyを指定してください。",
        );
      }
    },
  );
}

async function findBidByKey(client: KkjClient, bidKey: string) {
  const searchResult = await client.search({ Query: bidKey, Count: 10 });
  const bid = searchResult.bids.find((candidate) => candidate.key === bidKey);
  if (!bid) {
    throw new UserInputError(
      "指定された bid_key の入札を確認できませんでした。rank_bids または search_bids で取得した最新の Key を指定してください。",
    );
  }
  return { bid, attribution: searchResult.attribution };
}

function formatFitSummary(rankedBid: ReturnType<typeof rankBid>): string {
  if (rankedBid.priority === "pursue") {
    return "追跡候補です。公式書類と資格条件を確認したうえで、社内検討に進める価値があります。";
  }
  if (rankedBid.priority === "skip") {
    return "見送り候補です。期限切れ、情報不足、または避けたい条件が含まれる可能性があります。";
  }
  return "要確認候補です。情報は揃い始めていますが、資格・期限・過去落札・原価の追加確認が必要です。";
}

function formatExplanationText(explanation: z.infer<typeof BidFitExplanationSchema>): string {
  const { rankedBid } = explanation;
  return [
    `■ ${rankedBid.bid.projectName}`,
    `判断: ${rankedBid.priority} / ${rankedBid.score}点`,
    explanation.fitSummary,
    "",
    `理由: ${rankedBid.reasons.join(" / ") || "追加確認が必要"}`,
    `リスク: ${rankedBid.risks.join(" / ") || "大きなリスクは未検出"}`,
    "",
    "確認チェックリスト:",
    ...explanation.confirmationChecklist.map((item) => `- ${item}`),
    "",
    `出典: ${explanation.attribution.dataSource}`,
  ].join("\n");
}
