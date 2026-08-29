import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { JquantsClient } from "../api/jquants-client.js";
import { resolveJquantsApiKey } from "../api/jquants-client.js";
import type { KkjClient } from "../api/kkj-client.js";
import { bidSearchText, summarizeListedAwards } from "../domain/award-signal.js";
import { type AwardMappingResult, AwardMappingResultSchema } from "../domain/investor.js";
import {
  createJquantsAttribution,
  findListedCompany,
  INVESTMENT_DISCLAIMER,
  type ListedCompany,
  matchListedCompaniesInText,
} from "../domain/listed-company.js";
import { toolError } from "../lib/tool-result.js";
import {
  buildSearchBidsParams,
  capSearchResult,
  type SearchBidsInput,
  searchBidsInputSchema,
} from "./search-bids.js";

const inputSchema = {
  ...searchBidsInputSchema,
  jquants_api_key: z
    .string()
    .min(8)
    .optional()
    .describe(
      "任意。J-Quants refresh token。未指定時はバンドル名寄せのみ。ホストの会話履歴に残る可能性があるため、stdioでは JQUANTS_API_KEY を推奨。",
    ),
};

export function registerMapAwardsToListed(
  server: McpServer,
  client: KkjClient,
  jquants: JquantsClient,
): void {
  server.registerTool(
    "map_awards_to_listed",
    {
      title: "公告を上場企業へ名寄せ",
      description:
        "官公需公告の件名から上場企業・銘柄コードへ名寄せする。USE THIS WHEN: 入札公告に登場する企業をティッカーに結びたいとき。DO NOT USE WHEN: 売買判断や落札者の確定が欲しいとき（KKJは公告であり公式落札結果ではない）。Map KKJ notices to listed-company tickers. This is not investment advice. Petakan pengumuman KKJ ke ticker perusahaan tercatat. Bukan nasihat investasi.",
      inputSchema,
      outputSchema: AwardMappingResultSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const result = await mapAwardsToListedResult(client, jquants, args, args.jquants_api_key);
        return {
          content: [{ type: "text" as const, text: formatMappingText(result) }],
          structuredContent: result,
        };
      } catch (error) {
        return toolError(
          error,
          "上場企業への名寄せで一時的なエラーが発生しました。検索条件を絞って再実行してください。",
        );
      }
    },
  );
}

export async function mapAwardsToListedResult(
  client: KkjClient,
  jquants: JquantsClient,
  args: SearchBidsInput,
  jquantsApiKey?: string,
): Promise<AwardMappingResult> {
  const searchResult = capSearchResult(await client.search(buildSearchBidsParams(args)));
  const catalog = await loadCatalog(jquants, jquantsApiKey);
  const mapped = [];
  let unmappedCount = 0;
  for (const bid of searchResult.bids) {
    const matches = matchListedCompaniesInText(bidSearchText(bid), catalog);
    if (matches.length === 0) {
      unmappedCount += 1;
      continue;
    }
    mapped.push({ bid, matches });
  }
  const facts = summarizeListedAwards(mapped, unmappedCount, searchResult.attribution);
  const apiKey = resolveJquantsApiKey(jquantsApiKey);
  return {
    searchHits: searchResult.searchHits,
    returnedCount: searchResult.returnedCount,
    mappedCount: facts.mappedCount,
    unmappedCount: facts.unmappedCount,
    mapped,
    companies: facts.companies,
    catalogSource: apiKey ? ("jquants" as const) : ("bundled" as const),
    caveats: facts.caveats,
    investmentDisclaimer: INVESTMENT_DISCLAIMER,
    attribution: searchResult.attribution,
    ...(apiKey ? { jquantsAttribution: createJquantsAttribution() } : {}),
  };
}

export async function loadCatalog(
  jquants: JquantsClient,
  toolArg?: string,
): Promise<ListedCompany[]> {
  const apiKey = resolveJquantsApiKey(toolArg);
  if (!apiKey) {
    return jquants.bundledMaster();
  }
  return jquants.listedMaster(apiKey);
}

export function resolveListedQuery(
  query: string,
  companies: readonly ListedCompany[],
): { company: ListedCompany; searchQuery: string } | undefined {
  const match = findListedCompany(query, companies);
  if (!match) {
    return undefined;
  }
  return { company: match.company, searchQuery: match.company.name };
}

export function formatMappingText(result: z.infer<typeof AwardMappingResultSchema>): string {
  const lines = [
    `上場企業名寄せ: 取得 ${result.returnedCount}件 / 名寄せ ${result.mappedCount}件 / 未一致 ${result.unmappedCount}件（カタログ ${result.catalogSource}）`,
    "",
    "企業別公告件数（落札確定ではない）:",
    ...(result.companies.length > 0
      ? result.companies.map(
          (entry) =>
            `- ${entry.company.name} (${entry.company.code}): ${entry.noticeCount}件 / 直近 ${entry.latestNoticeDate ?? "不明"}`,
        )
      : ["- 一致する上場企業がありません"]),
    "",
    "注意:",
    ...result.caveats.map((caveat) => `- ${caveat}`),
    "",
    `出典: ${result.attribution.dataSource}`,
  ];
  return lines.join("\n");
}
