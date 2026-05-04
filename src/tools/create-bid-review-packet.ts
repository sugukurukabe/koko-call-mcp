import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient } from "../api/kkj-client.js";
import { createAttribution } from "../domain/attribution.js";
import { BidReviewPacketSchema } from "../domain/bid.js";
import type { BidRankingOptions } from "../domain/bid-ranking.js";
import { extractBidRequirements } from "../domain/bid-requirements.js";
import { createBidReviewPacket } from "../domain/bid-review-packet.js";
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
    .describe("trueの場合、PDF/HTML抽出結果を社内検討メモへ反映する。"),
  target_uris: z
    .array(z.string().url())
    .max(3)
    .optional()
    .describe("抽出対象URL。省略時は検索結果の公式公告ページ・添付資料URLから最大3件を使う。"),
};

export function registerCreateBidReviewPacket(server: McpServer, client: KkjClient): void {
  server.registerTool(
    "create_bid_review_packet",
    {
      title: "入札社内検討パック",
      description:
        "入札1件の判断サマリー・理由・リスク・要件・締切・次アクションをMarkdown社内メモとして返す。Generate a Markdown review packet with decision summary, risks, and next actions for one bid. Buat ringkasan tinjauan Markdown dengan keputusan, risiko, dan langkah selanjutnya untuk satu tender.",
      inputSchema,
      outputSchema: BidReviewPacketSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const cached = client.getCachedBid(args.bid_key);
        const result = cached
          ? { bid: cached, attribution: createAttribution() }
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
        const baseRequirements = extractBidRequirements(result.bid, result.attribution);
        const requirements = args.fetch_documents
          ? await enrichWithDocumentExtraction(server, baseRequirements, args.target_uris)
          : baseRequirements;
        const packet = createBidReviewPacket(
          result.bid,
          result.attribution,
          rankingOptions,
          requirements,
        );
        return {
          content: [{ type: "text" as const, text: packet.markdown }],
          structuredContent: packet,
        };
      } catch (error) {
        return toolError(
          error,
          "入札社内検討パックの作成で一時的なエラーが発生しました。rank_bids または search_bids で取得した最新のbid_keyを指定してください。",
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
