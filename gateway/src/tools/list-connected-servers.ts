// list_connected_servers — 接続中の子 MCP サーバー一覧を返す
// list_connected_servers — Returns list of connected child MCP servers
// list_connected_servers — Mengembalikan daftar server MCP anak yang terhubung

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { stats as cacheStats } from "../cache/tool-cache.js";
import { filterTools, isServerVisibleInMode } from "../filter/tool-filter.js";
import { fetchChildToolList } from "../proxy/mcp-proxy.js";
import { getRegistryDeploymentStatus, loadRegistry } from "../registry/loader.js";
import type { ChildMcpServer, GatewayMode } from "../registry/schema.js";
import { FULL_ORCHESTRATION_MODE, GatewayModeSchema } from "../registry/schema.js";
import type { ToolContext } from "./register-tools.js";

function configuredTools(server: ChildMcpServer, mode: GatewayMode): Array<{ name: string }> {
  if (mode === FULL_ORCHESTRATION_MODE) {
    const fullModeTools = server.tool_modes?.[FULL_ORCHESTRATION_MODE] ?? [];
    const names = fullModeTools.length > 0 ? fullModeTools : server.tool_allowlist;
    return names.map((name) => ({ name }));
  }

  const names = server.tool_modes?.[mode] ?? [];
  return names.map((name) => ({ name }));
}

export function registerListConnectedServers(server: McpServer, context: ToolContext): void {
  server.registerTool(
    "list_connected_servers",
    {
      title: "接続済み子MCPサーバー一覧",
      description:
        "接続中の子 MCP サーバーの一覧と、各サーバーのツール一覧を返す。USE THIS WHEN: どのサーバーに何のツールがあるか確認したいとき、MoneyForward OAuthヘッダが効いているか確認したいとき、または call_registered_mcp で使うサーバーIDを調べたいとき。FIRST RUN TIP: 迷ったら get_gateway_demo を先に呼ぶ。DO NOT USE WHEN: 入札・補助金・会計データが直接欲しいとき（専用ツールを使う）。Lists all connected child MCP servers and their tools. Use when exploring available servers. Mencantumkan semua server MCP anak yang terhubung dan alatnya.",
      inputSchema: {
        include_tools: z
          .boolean()
          .optional()
          .describe(
            "各サーバーのツール一覧も取得するか（デフォルト: true）。Whether to fetch tool list per server (default: true). Apakah mengambil daftar alat per server (default: true).",
          ),
        mode: GatewayModeSchema.optional()
          .default("full_orchestration")
          .describe(
            "表示するツールをモードで絞り込む（ADR-0017, ADR-0022）。例: bid_search / subsidy_search / financial_check / agri_research / company_identity / full_orchestration。registry.json の tool_modes キーで mode を定義する。Filter visible tools by agent mode. Filter alat yang terlihat berdasarkan mode agen.",
          ),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
        destructiveHint: false,
      },
    },
    async (args) => {
      const { include_tools = true, mode = FULL_ORCHESTRATION_MODE } = args;
      const registry = loadRegistry();
      const deployment = getRegistryDeploymentStatus();

      const candidateServers =
        mode === FULL_ORCHESTRATION_MODE
          ? registry.servers
          : registry.servers.filter((s) => isServerVisibleInMode(s, mode));

      const serverInfos = await Promise.all(
        candidateServers.map(async (s) => {
          let tools: Array<{ name: string; description?: string }> = [];
          let status: "available" | "registry_fallback" | "unreachable" = "available";
          let error: string | undefined;
          if (include_tools) {
            const apiKey =
              process.env[`GATEWAY_CHILD_TOKEN_${s.id.toUpperCase().replace(/-/g, "_")}`];
            const oauthToken =
              context.childAuthHeaders[s.id] ??
              process.env[`GATEWAY_CHILD_TOKEN_${s.id.toUpperCase().replace(/-/g, "_")}_OAUTH`] ??
              (s.id === "freee" ? process.env.GATEWAY_CHILD_TOKEN_FREEE : undefined);
            try {
              const allTools = await fetchChildToolList(s, apiKey, oauthToken);
              // Mode ベースのフィルタリング（ADR-0017）: allowlist も考慮した上でモードで絞り込む
              // Mode-based filtering (ADR-0017): filter by mode on top of allowlist
              // Pemfilteran berbasis mode (ADR-0017): filter berdasarkan mode di atas allowlist
              tools =
                allTools.length > 0 ? filterTools(allTools, s, mode) : configuredTools(s, mode);
              if (allTools.length === 0 && tools.length > 0) {
                status = "registry_fallback";
              }
            } catch (e) {
              status = "unreachable";
              error = e instanceof Error ? e.message : String(e);
              tools = configuredTools(s, mode);
            }
          }
          return {
            id: s.id,
            display_name: s.display_name,
            display_name_en: s.display_name_en,
            display_name_id: s.display_name_id,
            status,
            ...(error ? { error } : {}),
            risk_level: s.risk_level,
            auth_type: s.auth_type,
            routing_keywords: s.routing_keywords.slice(0, 5),
            attribution: s.attribution,
            tools: include_tools ? tools.map((t) => t.name) : undefined,
          };
        }),
      );

      // モードで非表示になったサーバー（ツール数0）は一覧から省く
      // In focused modes, omit servers with no tools in this mode
      // Dalam mode terfokus, hilangkan server tanpa alat dalam mode ini
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                mode,
                server_count: serverInfos.length,
                servers: serverInfos,
                deployment,
                capabilities: {
                  prompts: [
                    "investigate_opportunity",
                    "financial_health_check",
                    "bid_to_close_workflow",
                    "cross_mcp_comparison",
                    "gateway_quick_tour",
                  ],
                  resources: [
                    "gateway://registry/summary",
                    "gateway://modes/reference",
                    "gateway://samples/queries",
                    "gateway://attribution/all",
                  ],
                },
                cache: cacheStats(),
                next_step:
                  "For a guided first run, call get_gateway_demo or use the gateway_quick_tour prompt. For bid+subsidy search, call search_public_opportunities. For financial tools, use call_registered_mcp with mode='financial_check'. Read gateway://samples/queries for example conversations.",
                attribution: "Public MCP JP Gateway — connecting Japan public-data MCP servers",
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
