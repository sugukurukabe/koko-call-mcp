// Gateway MCP Resources — 静的・動的リソースの公開
// Gateway MCP Resources — Static and dynamic resource publication
// Sumber Daya MCP Gateway — Publikasi sumber daya statis dan dinamis

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadRegistry } from "../registry/loader.js";

export function registerResources(server: McpServer): void {
  server.registerResource(
    "registry_summary",
    "gateway://registry/summary",
    {
      title: "子MCPレジストリ概要",
      description:
        "接続中の子MCPサーバー一覧とメタデータの概要。" +
        "Summary of connected child MCP servers and metadata. " +
        "Ringkasan server MCP anak yang terhubung dan metadata.",
      mimeType: "application/json",
    },
    async () => {
      const registry = loadRegistry();
      const summary = registry.servers.map((s) => ({
        id: s.id,
        display_name: s.display_name,
        display_name_en: s.display_name_en,
        risk_level: s.risk_level,
        auth_type: s.auth_type,
        tool_count: s.tool_allowlist.length > 0 ? s.tool_allowlist.length : "dynamic",
        modes: Object.keys(s.tool_modes ?? {}).filter((m) => (s.tool_modes?.[m]?.length ?? 0) > 0),
        attribution: s.attribution,
      }));
      return {
        contents: [
          {
            uri: "gateway://registry/summary",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                version: registry.version,
                server_count: registry.servers.length,
                servers: summary,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerResource(
    "modes_reference",
    "gateway://modes/reference",
    {
      title: "動的モード一覧",
      description:
        "registry.json で定義されている全モードとモード別ツール配置の参照。" +
        "Reference of all dynamic modes and their tool assignments defined in registry.json. " +
        "Referensi semua mode dinamis dan penugasan alatnya yang didefinisikan di registry.json.",
      mimeType: "application/json",
    },
    async () => {
      const registry = loadRegistry();
      const modeMap: Record<string, Array<{ server: string; tools: string[] }>> = {};
      for (const s of registry.servers) {
        for (const [mode, tools] of Object.entries(s.tool_modes ?? {})) {
          if (tools.length === 0) continue;
          if (!modeMap[mode]) modeMap[mode] = [];
          modeMap[mode].push({ server: s.id, tools });
        }
      }
      return {
        contents: [
          {
            uri: "gateway://modes/reference",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                description:
                  "Dynamic modes are defined per-server in registry.json. " +
                  "full_orchestration is the reserved mode that shows all tools.",
                modes: modeMap,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerResource(
    "sample_queries",
    "gateway://samples/queries",
    {
      title: "サンプルクエリ集",
      description:
        "Gateway ですぐに試せるサンプルクエリ・会話例。" +
        "Sample queries and conversation examples ready to try on this Gateway. " +
        "Contoh kueri dan percakapan yang siap dicoba di Gateway ini.",
      mimeType: "application/json",
    },
    async () => {
      const samples = [
        {
          category: "入札調査 / Bid Search",
          queries: [
            "東京都のDX関連入札を探して、使える補助金も一緒に教えて。",
            "IT system procurement bids in Osaka, with related subsidies.",
          ],
        },
        {
          category: "資金繰り / Financial Check",
          queries: [
            "MoneyForwardの試算表を確認して、今月の資金繰りに問題がないか教えて。",
            "Check MoneyForward trial balance and summarize cash flow status.",
          ],
        },
        {
          category: "補助金探索 / Subsidy Search",
          queries: [
            "中小企業が使えるDX推進の補助金を探して。",
            "Find subsidies for small businesses related to digital transformation.",
          ],
        },
        {
          category: "一気通貫 / End-to-End",
          queries: [
            "IT入札を探して、補助金を確認して、会計データを見て、受注判断の材料をまとめて。",
            "Search IT bids, check subsidies, verify accounting data, and summarize decision factors.",
          ],
        },
        {
          category: "横断比較 / Cross-MCP",
          queries: [
            "接続されている全子MCPの一覧と、それぞれで何ができるか教えて。",
            "List all connected child MCPs and explain what each one can do.",
          ],
        },
      ];
      return {
        contents: [
          {
            uri: "gateway://samples/queries",
            mimeType: "application/json",
            text: JSON.stringify({ sample_count: samples.length, samples }, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "attribution_all",
    "gateway://attribution/all",
    {
      title: "出典一覧",
      description:
        "全子MCPの出典・ライセンス情報をまとめて返す。" +
        "Aggregated attribution and license information for all child MCPs. " +
        "Informasi atribusi dan lisensi gabungan untuk semua MCP anak.",
      mimeType: "application/json",
    },
    async () => {
      const registry = loadRegistry();
      const attributions = registry.servers.map((s) => ({
        server_id: s.id,
        display_name: s.display_name,
        ...s.attribution,
      }));
      return {
        contents: [
          {
            uri: "gateway://attribution/all",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                note: "Always cite the attribution.source field when presenting data from each child MCP.",
                attributions,
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
