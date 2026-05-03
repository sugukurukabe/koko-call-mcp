import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient } from "../api/kkj-client.js";
import { OrganizationSummarySchema } from "../domain/bid.js";
import { daysAgoDate, formatKkjDateRange } from "../domain/date-range.js";
import { toolError } from "../lib/tool-result.js";

const inputSchema = {
  organization_name: z.string().min(1).describe("分析対象の発注機関名"),
  since: z.string().optional().describe("YYYY-MM-DD 以降。未指定なら過去1年。"),
  limit: z.number().int().min(1).max(1000).default(200),
};

export function registerSummarizeBidsByOrg(server: McpServer, client: KkjClient): void {
  server.registerTool(
    "summarize_bids_by_org",
    {
      title: "発注機関別の入札傾向分析",
      description:
        "発注機関名を指定してカテゴリ別・公示種別別の入札傾向と直近案件を集計する。Summarize bid trends and recent notices for a specific procurement organization by category and procedure type. Ringkas tren tender dan pengumuman terbaru untuk instansi tertentu berdasarkan kategori.",
      inputSchema,
      outputSchema: OrganizationSummarySchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const since = args.since ?? daysAgoDate(365);
        const params = {
          Organization_Name: args.organization_name,
          Count: args.limit,
        };
        const issueRange = formatKkjDateRange(since, undefined);
        const result = await client.search(
          issueRange ? { ...params, CFT_Issue_Date: issueRange } : params,
        );
        const categories = countBy(result.bids.map((bid) => bid.category ?? "不明"));
        const procedureTypes = countBy(result.bids.map((bid) => bid.procedureType ?? "不明"));
        const summary = {
          organizationName: args.organization_name,
          totalHits: result.searchHits,
          returnedCount: result.returnedCount,
          categories,
          procedureTypes,
          recentProjects: result.bids.slice(0, 20),
          attribution: result.attribution,
        };
        return {
          content: [
            {
              type: "text" as const,
              text: `${args.organization_name} の入札傾向: ${result.searchHits}件ヒット\nカテゴリ: ${JSON.stringify(categories)}\n出典: ${result.attribution.dataSource}`,
            },
          ],
          structuredContent: summary,
        };
      } catch (error) {
        return toolError(error, "発注機関別の入札傾向分析で一時的なエラーが発生しました。");
      }
    },
  );
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}
