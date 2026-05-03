import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient } from "../api/kkj-client.js";
import { type BidRequirementExtraction, BidShortlistExportSchema } from "../domain/bid.js";
import { type BidRankingOptions, rankBidSearchResult } from "../domain/bid-ranking.js";
import { extractBidRequirements } from "../domain/bid-requirements.js";
import { exportBidShortlistCsv } from "../domain/bid-shortlist.js";
import { toolError } from "../lib/tool-result.js";
import { enrichWithDocumentExtraction } from "./document-extraction.js";
import { buildSearchBidsParams, searchBidsInputSchema } from "./search-bids.js";

const inputSchema = {
  ...searchBidsInputSchema,
  preferred_keywords: z
    .array(z.string().min(1))
    .optional()
    .describe("優先したい語句。例: ソフトウェア、保守、クラウド。"),
  avoid_keywords: z
    .array(z.string().min(1))
    .optional()
    .describe("避けたい語句。例: 工事、常駐、夜間。"),
  due_within_days: z.number().int().min(1).max(180).default(30),
  shortlist_limit: z.number().int().min(1).max(50).default(10),
  fetch_documents: z
    .boolean()
    .default(false)
    .describe("trueの場合、上位案件のPDF/HTML抽出結果をCSVに参加資格・提出期限列として追加する。"),
};

export function registerExportBidShortlist(server: McpServer, client: KkjClient): void {
  server.registerTool(
    "export_bid_shortlist",
    {
      title: "入札検討shortlist CSV",
      description:
        "入札を検索・ランキングしてGoogle Sheets/Excel用のCSVを返す。スコア・判断・リスク・次アクション付き。Search and rank bids, then export a CSV shortlist for Google Sheets/Excel with scores and next actions. Cari, peringkat, dan ekspor shortlist CSV untuk Google Sheets/Excel.",
      inputSchema,
      outputSchema: BidShortlistExportSchema.shape,
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
        const ranked = rankBidSearchResult(searchResult, rankingOptions);
        let extractionMap: Map<string, BidRequirementExtraction> | undefined;
        if (args.fetch_documents) {
          extractionMap = new Map();
          for (const rankedBid of ranked.rankedBids.slice(0, 3)) {
            const baseReq = extractBidRequirements(rankedBid.bid, ranked.attribution);
            const enriched = await enrichWithDocumentExtraction(server, baseReq, undefined);
            extractionMap.set(rankedBid.bid.key, enriched);
          }
        }
        const exported = exportBidShortlistCsv(ranked, extractionMap);
        return {
          content: [
            {
              type: "text" as const,
              text: [
                `入札shortlist CSV: ${exported.rankedCount}件`,
                `ファイル名候補: ${exported.filename}`,
                "",
                exported.csv,
              ].join("\n"),
            },
          ],
          structuredContent: exported,
        };
      } catch (error) {
        return toolError(
          error,
          "入札shortlist CSVの作成で一時的なエラーが発生しました。検索条件を絞って再実行してください。",
        );
      }
    },
  );
}
