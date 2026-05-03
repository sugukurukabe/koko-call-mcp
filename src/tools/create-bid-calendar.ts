import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient } from "../api/kkj-client.js";
import { createAttribution } from "../domain/attribution.js";
import { BidCalendarExportSchema } from "../domain/bid.js";
import { createBidCalendarExport } from "../domain/bid-calendar.js";
import { extractBidRequirements } from "../domain/bid-requirements.js";
import { UserInputError } from "../lib/errors.js";
import { toolError } from "../lib/tool-result.js";
import { enrichWithDocumentExtraction } from "./document-extraction.js";

const inputSchema = {
  bid_key: z
    .string()
    .min(1)
    .describe("search_bids、rank_bids、またはlist_recent_bidsが返したKeyフィールド"),
  fetch_documents: z
    .boolean()
    .default(false)
    .describe("trueの場合、PDF/HTML抽出結果の説明会日時・提出期限をカレンダーに追加する。"),
  target_uris: z
    .array(z.string().url())
    .max(3)
    .optional()
    .describe("抽出対象URL。省略時は検索結果の公式公告ページ・添付資料URLから最大3件を使う。"),
};

export function registerCreateBidCalendar(server: McpServer, client: KkjClient): void {
  server.registerTool(
    "create_bid_calendar",
    {
      title: "入札締切カレンダーICS",
      description:
        "入札の提出期限・開札日・納入期限をGoogle Calendar/OutlookへインポートできるICS形式で返す。Generate an ICS calendar file with bid deadlines for Google Calendar or Outlook. Buat file kalender ICS untuk tenggat waktu tender di Google Calendar atau Outlook.",
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
        const baseReq = extractBidRequirements(result.bid, result.attribution);
        const requirements = args.fetch_documents
          ? await enrichWithDocumentExtraction(server, baseReq, args.target_uris)
          : baseReq;
        const calendar = createBidCalendarExport(
          result.bid,
          result.attribution,
          requirements.extractedRequirements,
        );
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
