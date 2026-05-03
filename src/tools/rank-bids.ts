import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient } from "../api/kkj-client.js";
import { BidRankingResultSchema } from "../domain/bid.js";
import { type BidRankingOptions, rankBidSearchResult } from "../domain/bid-ranking.js";
import { toolError } from "../lib/tool-result.js";
import { buildSearchBidsParams, searchBidsInputSchema } from "./search-bids.js";

const rankBidsInputSchema = {
  ...searchBidsInputSchema,
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
    .describe("この日数以内に提出期限が来る案件を優先します。"),
  shortlist_limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("ランキング結果として返す最大件数。"),
};

export function registerRankBids(server: McpServer, client: KkjClient): void {
  server.registerTool(
    "rank_bids",
    {
      title: "追うべき入札ランキング",
      description:
        "官公需入札を検索し、AI Bid RadarのMVPとして追うべき順にスコアリングする。参加可否の最終判断ではなく、公式書類・資格・過去落札を確認するための候補整理に使う。",
      inputSchema: rankBidsInputSchema,
      outputSchema: BidRankingResultSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const searchResult = await client.search(buildSearchBidsParams(args));
        const rankingOptions: BidRankingOptions = {
          dueWithinDays: args.due_within_days,
          shortlistLimit: args.shortlist_limit,
        };
        if (args.preferred_keywords) {
          rankingOptions.preferredKeywords = args.preferred_keywords;
        }
        if (args.avoid_keywords) {
          rankingOptions.avoidKeywords = args.avoid_keywords;
        }
        const result = rankBidSearchResult(searchResult, rankingOptions);
        return {
          content: [{ type: "text" as const, text: formatRankingSummary(result) }],
          structuredContent: result,
        };
      } catch (error) {
        return toolError(
          error,
          "入札ランキングで一時的なエラーが発生しました。検索条件を絞って再実行してください。",
        );
      }
    },
  );
}

function formatRankingSummary(result: z.infer<typeof BidRankingResultSchema>): string {
  const lines = [
    `追うべき入札候補: ${result.rankedCount}件（検索ヒット ${result.searchHits}件）`,
    `スコアリング: ${result.scoringPolicy.version}`,
    `出典: ${result.attribution.dataSource}`,
    "",
  ];
  for (const rankedBid of result.rankedBids.slice(0, 10)) {
    lines.push(
      `■ ${rankedBid.score}点 / ${rankedBid.priority}: ${rankedBid.bid.projectName}`,
      `  機関: ${rankedBid.bid.organizationName ?? "不明"} | 地域: ${rankedBid.bid.prefectureName ?? "不明"}`,
      `  理由: ${rankedBid.reasons.join(" / ") || "追加確認が必要"}`,
      `  リスク: ${rankedBid.risks.join(" / ") || "大きなリスクは未検出"}`,
      `  次: ${rankedBid.nextActions[0] ?? "公式書類を確認する"}`,
      "",
    );
  }
  return lines.join("\n");
}
