import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient } from "../api/kkj-client.js";
import { CategorySchema } from "../domain/codes.js";
import { PrefectureNameSchema } from "../domain/prefectures.js";
import { jsonText, toolError } from "../lib/tool-result.js";
import { buildSearchBidsParams, type SearchBidsInput } from "./search-bids.js";

const SaveSearchOutputSchema = z.object({
  saved: z.boolean(),
  name: z.string(),
  criteria: z.record(z.string(), z.unknown()),
  totalSaved: z.number(),
  nextStep: z.string(),
});

const CheckSavedSearchOutputSchema = z.object({
  name: z.string(),
  newBidsCount: z.number(),
  bids: z.array(
    z.object({
      projectName: z.string(),
      organizationName: z.string().nullable(),
      prefectureName: z.string().nullable(),
      cftIssueDate: z.string().nullable(),
      tenderSubmissionDeadline: z.string().nullable(),
      key: z.string(),
    }),
  ),
  checkedAt: z.string(),
  previousCheck: z.string().nullable(),
  attribution: z.record(z.string(), z.unknown()),
  webhookHint: z.string(),
});

const ListSavedSearchesOutputSchema = z.object({
  totalSaved: z.number(),
  searches: z.array(
    z.object({
      name: z.string(),
      criteria: z.record(z.string(), z.unknown()),
      createdAt: z.string(),
      lastCheckedAt: z.string().nullable(),
    }),
  ),
});

const SavedSearchSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .describe("保存検索の名前（例: 「鹿児島IT案件」）。Name for this saved search."),
  query: z.string().optional().describe("キーワード。Keyword."),
  prefecture: z
    .union([PrefectureNameSchema, z.array(PrefectureNameSchema)])
    .optional()
    .describe("都道府県名で絞り込む。配列で複数指定可。"),
  category: CategorySchema.optional().describe("入札区分。物品、役務、工事、その他。"),
  organization_name: z.string().optional().describe("発注機関名。Organization name."),
});

const CheckAlertSchema = z.object({
  name: z.string().min(1).describe("確認する保存検索の名前。Name of saved search to check."),
});

const ListSavedSchema = z.object({});

export function registerSavedSearchAlert(server: McpServer, client: KkjClient): void {
  // 保存検索条件のインメモリストア（MCPサーバーインスタンス単位）
  // In-memory saved search store (per MCP server instance)
  // Penyimpanan pencarian tersimpan di memori (per instance server MCP)
  const savedSearches: Map<
    string,
    { name: string; criteria: SearchBidsInput; createdAt: string; lastCheckedAt: string | null }
  > = new Map();

  // 検索条件を保存する
  // Save search criteria for later alerts
  // Simpan kriteria pencarian untuk peringatan
  server.registerTool(
    "save_search",
    {
      title: "検索条件を保存",
      description:
        "入札検索条件を名前付きで保存する。保存した条件は check_saved_search で新着確認に使える。Save named bid search criteria for recurring alert checks. Simpan kriteria pencarian tender bernama untuk pemeriksaan peringatan berulang.",
      inputSchema: SavedSearchSchema.shape,
      outputSchema: SaveSearchOutputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      const criteria: SearchBidsInput = {
        query: args.query,
        prefecture: args.prefecture,
        category: args.category,
        organization_name: args.organization_name,
        limit: 20,
      };
      savedSearches.set(args.name, {
        name: args.name,
        criteria,
        createdAt: new Date().toISOString(),
        lastCheckedAt: null,
      });
      const result = {
        saved: true,
        name: args.name,
        criteria: criteria as Record<string, unknown>,
        totalSaved: savedSearches.size,
        nextStep:
          "check_saved_search でこの条件の新着入札を確認できます。Use check_saved_search to check for new bids matching this criteria.",
      };
      return {
        content: [{ type: "text" as const, text: jsonText(result) }],
        structuredContent: result,
      };
    },
  );

  // 保存した検索条件で新着を確認する
  // Check for new bids matching saved criteria
  // Periksa tender baru yang cocok dengan kriteria tersimpan
  server.registerTool(
    "check_saved_search",
    {
      title: "保存検索の新着確認",
      description:
        "保存した検索条件で新着入札を確認する。前回チェック以降の新着のみを返す。Check for new bids since last check using saved search criteria. Periksa tender baru sejak pemeriksaan terakhir menggunakan kriteria tersimpan.",
      inputSchema: CheckAlertSchema.shape,
      outputSchema: CheckSavedSearchOutputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const saved = savedSearches.get(args.name);
      if (!saved) {
        return toolError(
          null,
          `「${args.name}」という保存検索が見つかりません。save_search で先に条件を保存してください。`,
        );
      }

      try {
        const criteria = { ...saved.criteria };
        if (saved.lastCheckedAt) {
          criteria.issued_after = saved.lastCheckedAt.slice(0, 10);
        }

        const params = buildSearchBidsParams(criteria);
        const result = await client.search(params);

        const now = new Date().toISOString();
        const previousCheck = saved.lastCheckedAt;
        saved.lastCheckedAt = now;

        const checkResult = {
          name: args.name,
          newBidsCount: result.searchHits,
          bids: result.bids.slice(0, 10).map((bid) => ({
            projectName: bid.projectName,
            organizationName: bid.organizationName,
            prefectureName: bid.prefectureName,
            cftIssueDate: bid.cftIssueDate,
            tenderSubmissionDeadline: bid.tenderSubmissionDeadline,
            key: bid.key,
          })),
          checkedAt: now,
          previousCheck,
          attribution: result.attribution as Record<string, unknown>,
          webhookHint:
            "この機能を定期実行するには、Webhook通知を設定できます。将来のバージョンでSlack/メール/Webhook通知に対応予定です。",
        };
        return {
          content: [{ type: "text" as const, text: jsonText(checkResult) }],
          structuredContent: checkResult,
        };
      } catch (error) {
        return toolError(error, "保存検索の確認中にエラーが発生しました。");
      }
    },
  );

  // 保存検索の一覧
  // List all saved searches
  // Daftar semua pencarian tersimpan
  server.registerTool(
    "list_saved_searches",
    {
      title: "保存検索の一覧",
      description:
        "保存されている検索条件の一覧を返す。List all saved search criteria. Daftar semua kriteria pencarian yang tersimpan.",
      inputSchema: ListSavedSchema.shape,
      outputSchema: ListSavedSearchesOutputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const listResult = {
        totalSaved: savedSearches.size,
        searches: [...savedSearches.values()].map((s) => ({
          name: s.name,
          criteria: s.criteria as Record<string, unknown>,
          createdAt: s.createdAt,
          lastCheckedAt: s.lastCheckedAt,
        })),
      };
      return {
        content: [{ type: "text" as const, text: jsonText(listResult) }],
        structuredContent: listResult,
      };
    },
  );
}
