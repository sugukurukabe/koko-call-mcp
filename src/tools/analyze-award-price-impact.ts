import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { JquantsClient } from "../api/jquants-client.js";
import { resolveJquantsApiKey } from "../api/jquants-client.js";
import type { KkjClient } from "../api/kkj-client.js";
import { createAttribution } from "../domain/attribution.js";
import { AwardPriceImpactSchema } from "../domain/investor.js";
import { createJquantsAttribution, INVESTMENT_DISCLAIMER } from "../domain/listed-company.js";
import { UserInputError } from "../lib/errors.js";
import { toolError } from "../lib/tool-result.js";
import { loadCatalog, resolveListedQuery } from "./map-awards-to-listed.js";

const inputSchema = {
  query: z.string().min(1).describe("企業名または4桁銘柄コード。"),
  event_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("事象日 YYYY-MM-DD。省略時は bid_key の公告日、それも無ければ今日。"),
  bid_key: z.string().min(1).optional().describe("KKJ案件キー。公告日の取得に使う。"),
  window_days: z
    .number()
    .int()
    .min(1)
    .max(30)
    .default(5)
    .describe("公告日の前後営業日に近い暦日ウィンドウ。デフォルト5日。"),
  jquants_api_key: z
    .string()
    .min(8)
    .optional()
    .describe(
      "必須（環境変数 JQUANTS_API_KEY でも可）。J-Quants refresh token。会話履歴に残る可能性あり。",
    ),
};

export function registerAnalyzeAwardPriceImpact(
  server: McpServer,
  client: KkjClient,
  jquants: JquantsClient,
): void {
  server.registerTool(
    "analyze_award_price_impact",
    {
      title: "公告日前後の株価推移",
      description:
        "官公需公告日前後の公開終値を返す。USE THIS WHEN: 公告日を挟んだ株価の事実系列が見たいとき。DO NOT USE WHEN: 買い推奨や因果の断定が欲しいとき。変化率は相関の事実であり投資助言ではない。Return public daily closes around a KKJ notice date. This is not investment advice. Kembalikan harga penutupan di sekitar tanggal pengumuman. Bukan nasihat investasi.",
      inputSchema,
      outputSchema: AwardPriceImpactSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const apiKey = resolveJquantsApiKey(args.jquants_api_key);
        if (!apiKey) {
          throw new UserInputError(
            "analyze_award_price_impact には J-Quants APIキーが必要です。jquants_api_key を渡すか、環境変数 JQUANTS_API_KEY を設定してください。https://jpx-jquants.com/",
          );
        }
        const catalog = await loadCatalog(jquants, apiKey);
        const resolved = resolveListedQuery(args.query, catalog);
        if (!resolved) {
          throw new UserInputError(
            `「${args.query}」を上場カタログで特定できませんでした。4桁コードか正式社名を指定してください。`,
          );
        }
        let eventDate = args.event_date;
        let projectName: string | undefined;
        if (args.bid_key) {
          const cached = client.getCachedBid(args.bid_key);
          const found =
            cached ??
            (await client.search({ Query: args.bid_key, Count: 10 })).bids.find(
              (bid) => bid.key === args.bid_key,
            );
          if (found) {
            projectName = found.projectName;
            eventDate = eventDate ?? found.cftIssueDate?.slice(0, 10);
          }
        }
        const resolvedEventDate = eventDate ?? new Date().toISOString().slice(0, 10);
        const window = await jquants.eventWindow(
          apiKey,
          resolved.company.code,
          resolvedEventDate,
          args.window_days,
        );
        const result = {
          company: resolved.company,
          eventDate: resolvedEventDate,
          ...(args.bid_key ? { bidKey: args.bid_key } : {}),
          ...(projectName ? { projectName } : {}),
          windowDays: args.window_days,
          from: window.from,
          to: window.to,
          closeAtOrBeforeEvent: window.closeAtOrBeforeEvent,
          closeAtOrAfterWindowEnd: window.closeAtOrAfterWindowEnd,
          pctChange: window.pctChange,
          bars: window.bars,
          caveats: [
            "終値の変化は公告との因果を示さない。他の開示・市場要因と同時に動く。",
            "KKJ公告は落札確定ではない。",
            INVESTMENT_DISCLAIMER,
          ],
          investmentDisclaimer: INVESTMENT_DISCLAIMER,
          attribution: createAttribution(),
          jquantsAttribution: createJquantsAttribution(),
        };
        return {
          content: [{ type: "text" as const, text: formatImpactText(result) }],
          structuredContent: result,
        };
      } catch (error) {
        return toolError(
          error,
          "公告日前後の株価取得で一時的なエラーが発生しました。APIキーと銘柄コードを確認して再実行してください。",
        );
      }
    },
  );
}

function formatImpactText(result: z.infer<typeof AwardPriceImpactSchema>): string {
  const change =
    result.pctChange === null
      ? "不明"
      : `${result.pctChange >= 0 ? "+" : ""}${result.pctChange.toFixed(2)}%`;
  return [
    `${result.company.name} (${result.company.code}) 公告日 ${result.eventDate} 前後 ±${result.windowDays}日`,
    `事象前終値: ${result.closeAtOrBeforeEvent ?? "不明"} / ウィンドウ末終値: ${result.closeAtOrAfterWindowEnd ?? "不明"} / 変化率: ${change}`,
    "",
    "注意:",
    ...result.caveats.map((caveat) => `- ${caveat}`),
    "",
    `出典: ${result.attribution.dataSource} / ${result.jquantsAttribution.dataSource}`,
  ].join("\n");
}
