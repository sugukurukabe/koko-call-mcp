import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient } from "../api/kkj-client.js";
import { createAttribution } from "../domain/attribution.js";
import { BidReviewPacketSchema } from "../domain/bid.js";
import type { BidRankingOptions } from "../domain/bid-ranking.js";
import { createBidReviewPacket } from "../domain/bid-review-packet.js";
import { UserInputError } from "../lib/errors.js";
import { toolError } from "../lib/tool-result.js";

const inputSchema = {
  bid_key: z
    .string()
    .min(1)
    .describe("search_bids、rank_bids、またはlist_recent_bidsが返したKeyフィールド"),
  preferred_keywords: z.array(z.string().min(1)).optional(),
  avoid_keywords: z.array(z.string().min(1)).optional(),
  due_within_days: z.number().int().min(1).max(180).default(30),
};

export function registerCreateBidReviewPacket(server: McpServer, client: KkjClient): void {
  server.registerTool(
    "create_bid_review_packet",
    {
      title: "入札社内検討パック",
      description:
        "1件の入札Keyについて、判断サマリー、理由、リスク、要件、締切、次アクションをMarkdownの社内検討メモとして返す。Google Docs/Notion/稟議への貼り付けを想定する。",
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
        const packet = createBidReviewPacket(result.bid, result.attribution, rankingOptions);
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
