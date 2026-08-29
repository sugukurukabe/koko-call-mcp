import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { JquantsClient } from "../api/jquants-client.js";
import type { KkjClient, KkjSearchParams } from "../api/kkj-client.js";
import { summarizeListedAwards } from "../domain/award-signal.js";
import { daysAgoDate, formatKkjDateRange, todayDate } from "../domain/date-range.js";
import { ListedAwardHistorySchema } from "../domain/investor.js";
import { INVESTMENT_DISCLAIMER } from "../domain/listed-company.js";
import { UserInputError } from "../lib/errors.js";
import { toolError } from "../lib/tool-result.js";
import { loadCatalog, resolveListedQuery } from "./map-awards-to-listed.js";
import { capSearchResult } from "./search-bids.js";

const inputSchema = {
  query: z.string().min(1).describe("企業名または4桁銘柄コード。例: 富士通、6702。"),
  window_days: z
    .number()
    .int()
    .min(7)
    .max(1825)
    .default(365)
    .describe("過去何日分の公告を対象にするか。デフォルト365日。"),
  limit: z.number().int().min(1).max(1000).default(200).describe("KKJ取得件数の上限。"),
  jquants_api_key: z
    .string()
    .min(8)
    .optional()
    .describe("任意。J-Quants refresh token。未指定時はバンドル名寄せのみ。"),
};

export function registerGetListedAwardHistory(
  server: McpServer,
  client: KkjClient,
  jquants: JquantsClient,
): void {
  server.registerTool(
    "get_listed_award_history",
    {
      title: "上場企業の官公需公告履歴",
      description:
        "指定した上場企業・銘柄の官公需公告履歴を集計する。USE THIS WHEN: ある企業名や銘柄コードがKKJ公告に何件出るかを事実として見たいとき。DO NOT USE WHEN: 受注確度や株価の売買判断が欲しいとき。KKJは公告であり公式落札結果ではない。List KKJ notice history for a listed company. This is not investment advice. Riwayat pengumuman KKJ untuk perusahaan tercatat. Bukan nasihat investasi.",
      inputSchema,
      outputSchema: ListedAwardHistorySchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const catalog = await loadCatalog(jquants, args.jquants_api_key);
        const resolved = resolveListedQuery(args.query, catalog);
        if (!resolved) {
          throw new UserInputError(
            `「${args.query}」はバンドル済み上場カタログにありません。4桁コードか正式社名を指定するか、jquants_api_key でマスタを拡張してください。`,
          );
        }
        const params: KkjSearchParams = {
          Query: resolved.searchQuery,
          Count: args.limit,
        };
        const issueRange = formatKkjDateRange(daysAgoDate(args.window_days), todayDate());
        if (issueRange) {
          params.CFT_Issue_Date = issueRange;
        }
        const searchResult = capSearchResult(await client.search(params));
        const mapped = searchResult.bids.map((bid) => ({
          bid,
          matches: [
            {
              company: resolved.company,
              confidence: "exact" as const,
              matchedText: resolved.searchQuery,
            },
          ],
        }));
        const facts = summarizeListedAwards(mapped, 0, searchResult.attribution);
        const companyFacts = facts.companies[0];
        const result = {
          company: resolved.company,
          windowDays: args.window_days,
          noticeCount: companyFacts?.noticeCount ?? 0,
          latestNoticeDate: companyFacts?.latestNoticeDate ?? null,
          latestNoticeKey: companyFacts?.latestNoticeKey ?? null,
          prefectureBreakdown: companyFacts?.prefectureBreakdown ?? {},
          categoryBreakdown: companyFacts?.categoryBreakdown ?? {},
          bids: searchResult.bids,
          caveats: facts.caveats,
          investmentDisclaimer: INVESTMENT_DISCLAIMER,
          attribution: searchResult.attribution,
        };
        return {
          content: [{ type: "text" as const, text: formatHistoryText(result) }],
          structuredContent: result,
        };
      } catch (error) {
        return toolError(
          error,
          "上場企業の公告履歴で一時的なエラーが発生しました。企業名か銘柄コードを確認して再実行してください。",
        );
      }
    },
  );
}

function formatHistoryText(result: z.infer<typeof ListedAwardHistorySchema>): string {
  return [
    `${result.company.name} (${result.company.code}) の官公需公告: ${result.noticeCount}件 / ${result.windowDays}日`,
    `直近公告: ${result.latestNoticeDate ?? "なし"} (${result.latestNoticeKey ?? "-"})`,
    "",
    "注意:",
    ...result.caveats.map((caveat) => `- ${caveat}`),
    "",
    `出典: ${result.attribution.dataSource}`,
  ].join("\n");
}
