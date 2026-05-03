import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient, KkjSearchParams } from "../api/kkj-client.js";
import { PastAwardSummarySchema } from "../domain/bid.js";
import {
  CategorySchema,
  categoryCodes,
  ProcedureTypeSchema,
  procedureTypeCodes,
} from "../domain/codes.js";
import { daysAgoDate, formatKkjDateRange, todayDate } from "../domain/date-range.js";
import { summarizePastAwards } from "../domain/past-awards.js";
import { PrefectureNameSchema, toLgCode } from "../domain/prefectures.js";
import { toolError } from "../lib/tool-result.js";

const inputSchema = {
  query: z
    .string()
    .min(1)
    .optional()
    .describe("自由記述キーワード。例: システム、保守、クラウド。"),
  prefecture: z.union([PrefectureNameSchema, z.array(PrefectureNameSchema)]).optional(),
  category: CategorySchema.optional(),
  procedure_type: ProcedureTypeSchema.optional(),
  organization_name: z.string().min(1).optional().describe("発注機関名で絞り込む場合に指定。"),
  window_days: z
    .number()
    .int()
    .min(7)
    .max(1825)
    .default(365)
    .describe("過去何日分の公告を集計対象にするか。デフォルト365日。"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(500)
    .describe("KKJ API から取得する公告件数の上限。"),
};

export function registerAnalyzePastAwards(server: McpServer, client: KkjClient): void {
  server.registerTool(
    "analyze_past_awards",
    {
      title: "過去公告・競合レーダー",
      description:
        "条件に一致する過去公告を集計し、発注機関の頻度、カテゴリ・手続種別の偏り、月次トレンド、注目候補と注意点を返す。落札情報そのものは扱わず、公告履歴から競合・発注パターンを推定するMVP。",
      inputSchema,
      outputSchema: PastAwardSummarySchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        if (
          !args.query &&
          !args.organization_name &&
          !args.prefecture &&
          !args.category &&
          !args.procedure_type
        ) {
          return toolError(
            new Error("missing filters"),
            "analyze_past_awards は query, organization_name, prefecture, category, procedure_type のいずれかを指定してください。検索が広すぎると上流APIが拒否します。",
          );
        }
        const since = daysAgoDate(args.window_days);
        const until = todayDate();
        const params: KkjSearchParams = { Count: args.limit };
        if (args.query) {
          params.Query = args.query;
        }
        if (args.organization_name) {
          params.Organization_Name = args.organization_name;
        }
        if (args.prefecture) {
          params.LG_Code = toLgCode(args.prefecture);
        }
        if (args.category) {
          params.Category = categoryCodes[args.category];
        }
        if (args.procedure_type) {
          params.Procedure_Type = procedureTypeCodes[args.procedure_type];
        }
        const issueRange = formatKkjDateRange(since, until);
        if (issueRange) {
          params.CFT_Issue_Date = issueRange;
        }
        const searchResult = await client.search(params);
        const summary = summarizePastAwards(
          searchResult,
          { windowDays: args.window_days },
          searchResult.attribution,
        );
        return {
          content: [{ type: "text" as const, text: formatPastAwardsText(summary) }],
          structuredContent: summary,
        };
      } catch (error) {
        return toolError(
          error,
          "過去公告レーダーで一時的なエラーが発生しました。検索条件を絞って再実行してください。",
        );
      }
    },
  );
}

function formatPastAwardsText(summary: z.infer<typeof PastAwardSummarySchema>): string {
  const lines = [
    `過去公告レーダー: ${summary.totalHits}件 (取得 ${summary.returnedCount}件 / 期間 ${summary.windowDays}日)`,
    "",
    "上位発注機関:",
    ...(summary.topOrganizations.length > 0
      ? summary.topOrganizations.map(
          (org) =>
            `- ${org.organizationName}: ${org.bidCount}件 / カテゴリ ${org.categories.join(", ") || "不明"} / 直近 ${org.recentBidDate ?? "不明"}`,
        )
      : ["- データがありません"]),
    "",
    "カテゴリ内訳:",
    ...formatBreakdown(summary.categoryBreakdown),
    "",
    "手続種別内訳:",
    ...formatBreakdown(summary.procedureBreakdown),
    "",
    "示唆:",
    ...summary.insights.map((insight) => `- ${insight}`),
    "",
    "注意:",
    ...summary.caveats.map((caveat) => `- ${caveat}`),
    "",
    `出典: ${summary.attribution.dataSource}`,
  ];
  return lines.join("\n");
}

function formatBreakdown(counts: Record<string, number>): string[] {
  const entries = Object.entries(counts).sort(
    ([, leftCount], [, rightCount]) => rightCount - leftCount,
  );
  if (entries.length === 0) {
    return ["- データがありません"];
  }
  return entries.map(([key, count]) => `- ${key}: ${count}件`);
}
