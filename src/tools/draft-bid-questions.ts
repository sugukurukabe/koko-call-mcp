import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient } from "../api/kkj-client.js";
import { createAttribution } from "../domain/attribution.js";
import { BidQuestionDraftSchema } from "../domain/bid.js";
import { draftBidQuestions } from "../domain/bid-questions.js";
import { UserInputError } from "../lib/errors.js";
import { toolError } from "../lib/tool-result.js";

const inputSchema = {
  bid_key: z
    .string()
    .min(1)
    .describe("search_bids、rank_bids、またはlist_recent_bidsが返したKeyフィールド"),
};

export function registerDraftBidQuestions(server: McpServer, client: KkjClient): void {
  server.registerTool(
    "draft_bid_questions",
    {
      title: "入札質問書ドラフト",
      description:
        "1件の入札Keyについて、発注者へ確認したい質問案をMarkdownで返す。提出前に必ず公式公告・仕様書・指定様式と照合するための下書き。",
      inputSchema,
      outputSchema: BidQuestionDraftSchema.shape,
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
        const draft = draftBidQuestions(result.bid, result.attribution);
        return {
          content: [{ type: "text" as const, text: draft.markdown }],
          structuredContent: draft,
        };
      } catch (error) {
        return toolError(
          error,
          "入札質問書ドラフトの作成で一時的なエラーが発生しました。rank_bids または search_bids で取得した最新のbid_keyを指定してください。",
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
