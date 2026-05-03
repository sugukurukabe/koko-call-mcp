import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient } from "../api/kkj-client.js";
import { createAttribution } from "../domain/attribution.js";
import { BidSearchResultSchema } from "../domain/bid.js";
import { UserInputError } from "../lib/errors.js";
import { toolError } from "../lib/tool-result.js";

const inputSchema = {
  bid_key: z
    .string()
    .min(1)
    .describe("search_bids または list_recent_bids が返した Key フィールド"),
};

export function registerGetBidDetail(server: McpServer, client: KkjClient): void {
  server.registerTool(
    "get_bid_detail",
    {
      title: "官公需入札詳細",
      description:
        "入札Keyから1件の詳細を取得する。添付資料は保存せず公式サイトのURIのみ返す。Fetch full details for one bid by key without storing attachments. Ambil detail lengkap satu tender berdasarkan kunci tanpa menyimpan lampiran.",
      inputSchema,
      outputSchema: BidSearchResultSchema.shape,
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
          ? {
              searchHits: 1,
              returnedCount: 1,
              bids: [cached],
              query: { bid_key: args.bid_key },
              attribution: createAttribution(),
            }
          : await client.search({ Query: args.bid_key, Count: 10 });
        const exact = result.bids.find((bid) => bid.key === args.bid_key);
        if (!exact) {
          throw new UserInputError(
            "指定された bid_key の入札を確認できませんでした。search_bids で取得した最新の Key を指定してください。",
          );
        }
        const detail = {
          ...result,
          searchHits: 1,
          returnedCount: 1,
          bids: [exact],
        };
        return {
          content: [
            {
              type: "text" as const,
              text: `■ ${exact.projectName}\n機関: ${exact.organizationName ?? "不明"}\nKey: ${exact.key}\n出典: ${detail.attribution.dataSource}`,
            },
          ],
          structuredContent: detail,
        };
      } catch (error) {
        return toolError(error, "入札詳細の取得で一時的なエラーが発生しました。");
      }
    },
  );
}
