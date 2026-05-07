// search_public_opportunities — 入札と補助金を並列検索して統合結果を返す
// search_public_opportunities — Parallel search of bids and subsidies with unified results
// search_public_opportunities — Pencarian paralel tender dan subsidi dengan hasil terpadu

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { proxyToolCall } from "../proxy/mcp-proxy.js";
import { loadRegistry } from "../registry/loader.js";

export function registerSearchPublicOpportunities(server: McpServer): void {
  server.registerTool(
    "search_public_opportunities",
    {
      title: "入札・補助金並列検索",
      description:
        "入札情報（JP Bids MCP）と補助金情報（Jグランツ MCP）を並列で検索し、統合した資金調達機会の一覧を返す。USE THIS WHEN: 特定の業種・地域・キーワードに合う入札と補助金を一度に調べたいとき。DO NOT USE WHEN: 会計・残高・請求書情報が欲しいとき（freee MCPを使う）。Searches bids and subsidies in parallel and returns unified public funding opportunities. Mencari tender dan subsidi secara paralel dan mengembalikan peluang pendanaan publik yang terpadu.",
      inputSchema: {
        keyword: z
          .string()
          .describe(
            "検索キーワード（例: IT, 農業, システム開発）。Search keyword (e.g. IT, agriculture, system development). Kata kunci pencarian.",
          ),
        prefecture: z
          .string()
          .optional()
          .describe(
            "都道府県名（例: 鹿児島県）。Prefecture name (e.g. Kagoshima). Nama prefektur.",
          ),
        max_results_per_source: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .default(5)
          .describe(
            "ソースごとの最大件数（デフォルト: 5）。Max results per source (default: 5). Hasil maksimum per sumber.",
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
      const { keyword, prefecture, max_results_per_source = 5 } = args;
      const registry = loadRegistry();

      const jpBidsServer = registry.servers.find((s) => s.id === "jp-bids");
      const jgrantsServer = registry.servers.find((s) => s.id === "jgrants");

      const results: Record<string, unknown> = {
        keyword,
        prefecture: prefecture ?? null,
        sources: {},
        attribution: [],
      };

      const tasks: Promise<void>[] = [];

      if (jpBidsServer) {
        const apiKey = process.env.GATEWAY_CHILD_TOKEN_JP_BIDS;
        tasks.push(
          proxyToolCall({
            server: jpBidsServer,
            toolName: "search_bids",
            toolArguments: {
              keyword,
              prefecture,
              limit: max_results_per_source,
            },
            bearerToken: apiKey,
          })
            .then((result) => {
              results.sources = {
                ...(results.sources as Record<string, unknown>),
                jp_bids: result.structuredContent ?? { text: result.content[0]?.text ?? "" },
              };
              (results.attribution as string[]).push(jpBidsServer.attribution.source);
            })
            .catch((e) => {
              results.sources = {
                ...(results.sources as Record<string, unknown>),
                jp_bids: { error: e instanceof Error ? e.message : String(e) },
              };
            }),
        );
      }

      if (jgrantsServer) {
        tasks.push(
          proxyToolCall({
            server: jgrantsServer,
            toolName: "search_subsidies",
            toolArguments: {
              keyword,
              target_area_search: prefecture,
            },
          })
            .then((result) => {
              results.sources = {
                ...(results.sources as Record<string, unknown>),
                jgrants: result.structuredContent ?? JSON.parse(result.content[0]?.text ?? "{}"),
              };
              (results.attribution as string[]).push(jgrantsServer.attribution.source);
            })
            .catch((e) => {
              results.sources = {
                ...(results.sources as Record<string, unknown>),
                jgrants: { error: e instanceof Error ? e.message : String(e) },
              };
            }),
        );
      }

      await Promise.all(tasks);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    },
  );
}
