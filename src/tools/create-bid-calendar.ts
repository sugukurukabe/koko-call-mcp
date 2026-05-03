import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient } from "../api/kkj-client.js";
import { createAttribution } from "../domain/attribution.js";
import { BidCalendarExportSchema } from "../domain/bid.js";
import { createBidCalendarExport } from "../domain/bid-calendar.js";
import { UserInputError } from "../lib/errors.js";
import { toolError } from "../lib/tool-result.js";

const inputSchema = {
  bid_key: z
    .string()
    .min(1)
    .describe("search_bids、rank_bids、またはlist_recent_bidsが返したKeyフィールド"),
};

export function registerCreateBidCalendar(server: McpServer, client: KkjClient): void {
  server.registerTool(
    "create_bid_calendar",
    {
      title: "入札締切カレンダーICS",
      description:
        "1件の入札Keyについて、提出期限、社内確認日、開札日、納入期限をGoogle Calendar/Outlookに取り込めるICS形式で返す。検索結果に無い質問期限は捏造せずmissingDatesに入れる。",
      inputSchema,
      outputSchema: BidCalendarExportSchema.shape,
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
        const calendar = createBidCalendarExport(result.bid, result.attribution);
        return {
          content: [{ type: "text" as const, text: formatCalendarText(calendar) }],
          structuredContent: calendar,
        };
      } catch (error) {
        return toolError(
          error,
          "入札カレンダー作成で一時的なエラーが発生しました。rank_bids または search_bids で取得した最新のbid_keyを指定してください。",
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

function formatCalendarText(calendar: z.infer<typeof BidCalendarExportSchema>): string {
  return [
    `ICSファイル候補: ${calendar.filename}`,
    `イベント数: ${calendar.eventCount}`,
    "",
    "イベント:",
    ...calendar.events.map((event) => `- ${event.date} ${event.title}`),
    "",
    "公式書類で確認が必要な日付:",
    ...calendar.missingDates.map((item) => `- ${item}`),
    "",
    calendar.ics,
  ].join("\n");
}
