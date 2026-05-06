// analyze_funding_fit — 指定案件への入札可否・補助金適合・会計余力を分析する
// analyze_funding_fit — Analyze bid eligibility, subsidy fit, and accounting headroom
// analyze_funding_fit — Analisis kelayakan tender, kesesuaian subsidi, dan kapasitas akuntansi

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { evaluate } from "../policy/policy-engine.js";
import { proxyToolCall } from "../proxy/mcp-proxy.js";
import { loadRegistry } from "../registry/loader.js";
import type { ToolContext } from "./register-tools.js";

export function registerAnalyzeFundingFit(server: McpServer, context: ToolContext): void {
  server.registerTool(
    "analyze_funding_fit",
    {
      title: "入札・補助金・会計余力の総合分析",
      description:
        "指定の入札案件に対して、自社プロファイルとの適合性・利用可能な補助金・会計上の資金余力をまとめて分析する（Pro tier）。USE THIS WHEN: 特定の入札案件に参加すべきかどうか、資金面も含めて総合的に判断したいとき。DO NOT USE WHEN: 単純な入札検索や補助金一覧が欲しいとき（search_public_opportunities を使う）。Analyzes bid fit, subsidy availability, and accounting headroom for a specific opportunity. Menganalisis kesesuaian tender, ketersediaan subsidi, dan kapasitas akuntansi untuk peluang tertentu.",
      inputSchema: {
        bid_keyword: z
          .string()
          .describe(
            "分析対象の入札案件のキーワードまたは案件名。Keyword or name of the bid to analyze. Kata kunci atau nama tender yang dianalisis.",
          ),
        company_profile: z
          .object({
            industry: z.string().describe("業種（例: IT, 農業, 建設）。Industry. Industri."),
            prefecture: z.string().optional().describe("所在都道府県。Prefecture. Prefektur."),
            annual_revenue_jpy: z
              .number()
              .optional()
              .describe("年間売上高（円）。Annual revenue in JPY. Pendapatan tahunan dalam JPY."),
          })
          .describe("自社プロファイル。Company profile. Profil perusahaan."),
        freee_token: z
          .string()
          .optional()
          .describe(
            "freee OAuth トークン（会計余力分析に使用）。freee OAuth token for accounting analysis. Token OAuth freee untuk analisis akuntansi.",
          ),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: false,
        openWorldHint: true,
        destructiveHint: false,
      },
    },
    async (args) => {
      const { bid_keyword, company_profile, freee_token } = args;
      const registry = loadRegistry();

      const analysis: Record<string, unknown> = {
        bid_keyword,
        company_profile,
        bid_analysis: null,
        subsidy_analysis: null,
        accounting_analysis: null,
        summary: null,
        attribution: [],
      };

      const tasks: Promise<void>[] = [];

      // 入札適合分析
      const jpBidsServer = registry.servers.find((s) => s.id === "jp-bids");
      if (jpBidsServer) {
        const apiKey = process.env.GATEWAY_CHILD_TOKEN_JP_BIDS;
        tasks.push(
          proxyToolCall({
            server: jpBidsServer,
            toolName: "rank_bids",
            toolArguments: {
              keyword: bid_keyword,
              industry: company_profile.industry,
              prefecture: company_profile.prefecture,
              limit: 5,
            },
            bearerToken: apiKey,
          })
            .then((result) => {
              analysis["bid_analysis"] = result.structuredContent ?? {
                text: result.content[0]?.text ?? "",
              };
              (analysis["attribution"] as string[]).push(jpBidsServer.attribution.source);
            })
            .catch((e) => {
              analysis["bid_analysis"] = { error: e instanceof Error ? e.message : String(e) };
            }),
        );
      }

      // 補助金適合分析
      const jgrantsServer = registry.servers.find((s) => s.id === "jgrants");
      if (jgrantsServer) {
        tasks.push(
          proxyToolCall({
            server: jgrantsServer,
            toolName: "search_subsidies",
            toolArguments: {
              keyword: `${bid_keyword} ${company_profile.industry}`,
              target_area_search: company_profile.prefecture,
            },
          })
            .then((result) => {
              analysis["subsidy_analysis"] =
                result.structuredContent ?? JSON.parse(result.content[0]?.text ?? "{}");
              (analysis["attribution"] as string[]).push(jgrantsServer.attribution.source);
            })
            .catch((e) => {
              analysis["subsidy_analysis"] = { error: e instanceof Error ? e.message : String(e) };
            }),
        );
      }

      // 会計余力分析（freee OAuth token がある場合のみ）
      // Accounting headroom analysis (only when freee OAuth token is available)
      // Analisis kapasitas akuntansi (hanya jika token OAuth freee tersedia)
      const freeeServer = registry.servers.find((s) => s.id === "freee");
      const effectiveFreeeToken =
        context.childAuthHeaders["freee"] ?? freee_token ?? process.env.GATEWAY_CHILD_TOKEN_FREEE;
      if (freeeServer && effectiveFreeeToken) {
        const policyResult = evaluate({
          server: freeeServer,
          toolName: "get_walletables",
          tier: context.tier,
          isOAuthAuthenticated: true,
        });

        if (policyResult.decision === "allowed") {
          tasks.push(
            proxyToolCall({
              server: freeeServer,
              toolName: "get_walletables",
              toolArguments: {},
              oauthToken: effectiveFreeeToken,
            })
              .then((result) => {
                analysis["accounting_analysis"] =
                  result.structuredContent ?? JSON.parse(result.content[0]?.text ?? "{}");
                (analysis["attribution"] as string[]).push(freeeServer.attribution.source);
              })
              .catch((e) => {
                analysis["accounting_analysis"] = {
                  error: e instanceof Error ? e.message : String(e),
                };
              }),
          );
        } else {
          analysis["accounting_analysis"] = {
            skipped: true,
            reason: policyResult.reason,
          };
        }
      } else if (freeeServer && !effectiveFreeeToken) {
        analysis["accounting_analysis"] = {
          skipped: true,
          reason:
            "freee OAuth token not provided. Pass freee_token parameter to enable accounting analysis.",
        };
      }

      await Promise.all(tasks);

      analysis["summary"] = buildSummary(analysis);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(analysis, null, 2),
          },
        ],
      };
    },
  );
}

function buildSummary(analysis: Record<string, unknown>): Record<string, unknown> {
  return {
    has_bid_matches: analysis["bid_analysis"] !== null && !isError(analysis["bid_analysis"]),
    has_subsidy_matches:
      analysis["subsidy_analysis"] !== null && !isError(analysis["subsidy_analysis"]),
    has_accounting_data:
      analysis["accounting_analysis"] !== null &&
      !isError(analysis["accounting_analysis"]) &&
      !(analysis["accounting_analysis"] as Record<string, unknown>)?.["skipped"],
    note: "本分析は参考情報です。入札参加・補助金申請の前に必ず一次資料を確認してください。This analysis is for reference only. Always verify with primary sources before bid submission or grant application.",
  };
}

function isError(value: unknown): boolean {
  return typeof value === "object" && value !== null && "error" in value;
}
