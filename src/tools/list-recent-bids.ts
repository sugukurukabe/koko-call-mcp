import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient, KkjSearchParams } from "../api/kkj-client.js";
import { BidSearchResultSchema } from "../domain/bid.js";
import { CategorySchema, categoryCodes } from "../domain/codes.js";
import { daysAgoDate, formatKkjDateRange, todayDate } from "../domain/date-range.js";
import { PrefectureNameSchema, prefectureEntries, toLgCode } from "../domain/prefectures.js";
import { toolError } from "../lib/tool-result.js";

const inputSchema = {
  prefecture: PrefectureNameSchema.optional().describe("都道府県名で絞り込む。例: 鹿児島県。"),
  category: CategorySchema.optional().describe("入札区分。物品、役務、工事、その他。"),
  days: z
    .number()
    .int()
    .min(1)
    .max(30)
    .default(7)
    .describe("過去何日分の公告を取得するか。デフォルト7日。"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(50)
    .describe("取得件数の上限。デフォルト50。"),
};

export function registerListRecentBids(server: McpServer, client: KkjClient): void {
  server.registerTool(
    "list_recent_bids",
    {
      title: "直近の官公需入札一覧",
      description:
        "過去1〜30日間に公告された新着官公需入札を一覧する。毎朝の営業チェックに使う。List recently published bid notices from the past 1–30 days for daily morning sales checks. Daftar pengumuman tender baru dalam 1–30 hari terakhir untuk cek pagi harian.",
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
        const since = daysAgoDate(args.days);
        const until = todayDate();
        const params: KkjSearchParams = {
          Count: args.limit,
        };
        const issueRange = formatKkjDateRange(since, until);
        if (issueRange) {
          params.CFT_Issue_Date = issueRange;
        }
        if (args.prefecture) {
          params.LG_Code = toLgCode(args.prefecture);
        } else {
          params.LG_Code = prefectureEntries.map((entry) => entry.code).join(",");
        }
        if (args.category) {
          params.Category = categoryCodes[args.category];
        }
        const result = await client.search(params);
        return {
          content: [
            {
              type: "text" as const,
              text: `${since} から ${until} までの新着入札: ${result.searchHits}件\n出典: ${result.attribution.dataSource}`,
            },
          ],
          structuredContent: result,
        };
      } catch (error) {
        return toolError(error, "直近入札一覧の取得で一時的なエラーが発生しました。");
      }
    },
  );
}
