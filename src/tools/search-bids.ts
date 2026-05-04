import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient, KkjSearchParams } from "../api/kkj-client.js";
import { BidSearchResultSchema } from "../domain/bid.js";
import {
  CategorySchema,
  CertificationSchema,
  categoryCodes,
  ProcedureTypeSchema,
  procedureTypeCodes,
} from "../domain/codes.js";
import { formatKkjDateRange } from "../domain/date-range.js";
import { PrefectureNameSchema, toLgCode } from "../domain/prefectures.js";
import { jsonText, toolError } from "../lib/tool-result.js";

export const searchBidsInputSchema = {
  query: z
    .string()
    .min(1)
    .optional()
    .describe("自由記述キーワード。複数キーワードはAND結合で検索されます。"),
  project_name: z.string().min(1).optional().describe("件名で絞り込む場合に指定します。"),
  prefecture: z
    .union([PrefectureNameSchema, z.array(PrefectureNameSchema)])
    .optional()
    .describe("都道府県名で絞り込む。配列で複数指定可。例: 鹿児島県、東京都。"),
  category: CategorySchema.optional().describe("入札区分。物品、役務、工事、その他。"),
  procedure_type: ProcedureTypeSchema.optional().describe(
    "公示種別。一般競争入札、指名競争入札、随意契約など。",
  ),
  certification: z
    .array(CertificationSchema)
    .optional()
    .describe("全省庁統一資格の等級。A、B、C、D から複数指定可。"),
  organization_name: z
    .string()
    .min(1)
    .optional()
    .describe("発注機関名で絞り込む。例: 農林水産省、防衛省。"),
  issued_after: z.string().optional().describe("公告日 YYYY-MM-DD 以降"),
  issued_before: z.string().optional().describe("公告日 YYYY-MM-DD 以前"),
  due_after: z.string().optional().describe("入札書提出期限 YYYY-MM-DD 以降"),
  due_before: z.string().optional().describe("入札書提出期限 YYYY-MM-DD 以前"),
  opening_after: z.string().optional().describe("開札日 YYYY-MM-DD 以降"),
  opening_before: z.string().optional().describe("開札日 YYYY-MM-DD 以前"),
  period_end_after: z.string().optional().describe("納入期限日 YYYY-MM-DD 以降"),
  period_end_before: z.string().optional().describe("納入期限日 YYYY-MM-DD 以前"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(20)
    .describe("取得件数の上限。デフォルト20、最大1000。"),
};
const SearchBidsInputObject = z.object(searchBidsInputSchema);
export type SearchBidsInput = z.infer<typeof SearchBidsInputObject>;

export function registerSearchBids(server: McpServer, client: KkjClient): void {
  server.registerTool(
    "search_bids",
    {
      title: "官公需入札検索",
      description:
        "日本全国の官公需入札情報を検索する。全文検索は query、件名は project_name、発注機関は organization_name を使う。Search Japanese public procurement bids by keyword, project name, or organization. Cari tender pengadaan pemerintah Jepang berdasarkan kata kunci, nama proyek, atau instansi.",
      inputSchema: searchBidsInputSchema,
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
        const params = buildSearchBidsParams(args);
        const result = await client.search(params);
        return {
          content: [{ type: "text" as const, text: formatSearchSummary(result) }],
          structuredContent: result,
        };
      } catch (error) {
        return toolError(
          error,
          "官公需入札検索で一時的なエラーが発生しました。条件を絞って再実行してください。",
        );
      }
    },
  );
}

export function buildSearchBidsParams(args: SearchBidsInput): KkjSearchParams {
  const params: KkjSearchParams = {
    Count: args.limit,
  };
  if (args.query) {
    params.Query = args.query;
  }
  if (args.project_name) {
    params.Project_Name = args.project_name;
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
  if (args.certification && args.certification.length > 0) {
    params.Certification = args.certification.join(",");
  }
  const issueRange = formatKkjDateRange(args.issued_after, args.issued_before);
  if (issueRange) {
    params.CFT_Issue_Date = issueRange;
  }
  const dueRange = formatKkjDateRange(args.due_after, args.due_before);
  if (dueRange) {
    params.Tender_Submission_Deadline = dueRange;
  }
  const openingRange = formatKkjDateRange(args.opening_after, args.opening_before);
  if (openingRange) {
    params.Opening_Tenders_Event = openingRange;
  }
  const periodEndRange = formatKkjDateRange(args.period_end_after, args.period_end_before);
  if (periodEndRange) {
    params.Period_End_Time = periodEndRange;
  }
  return params;
}

export function formatSearchSummary(result: z.infer<typeof BidSearchResultSchema>): string {
  const lines = [
    `${result.searchHits}件ヒット（取得 ${result.returnedCount}件）`,
    `出典: ${result.attribution.dataSource}`,
    `取得時刻: ${result.attribution.accessedAt}`,
    "",
  ];
  for (const bid of result.bids.slice(0, 10)) {
    lines.push(
      `■ ${bid.projectName}`,
      `  機関: ${bid.organizationName ?? "不明"} | 地域: ${bid.prefectureName ?? "不明"}`,
      `  公告日: ${bid.cftIssueDate ?? "不明"} | 入札開始: ${bid.tenderSubmissionDeadline ?? "不明"} | 開札: ${bid.openingTendersEvent ?? "不明"}`,
      `  区分: ${bid.category ?? "不明"} | 種別: ${bid.procedureType ?? "不明"} | 資格: ${bid.certification ?? "不明"}`,
      `  Key: ${bid.key}`,
      "",
    );
  }
  if (result.bids.length > 10) {
    lines.push(`他 ${result.bids.length - 10}件は structuredContent を参照してください。`);
  }
  lines.push(jsonText({ attribution: result.attribution }));
  return lines.join("\n");
}
