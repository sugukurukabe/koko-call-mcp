import { readFile } from "node:fs/promises";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JquantsClient } from "../api/jquants-client.js";
import type { KkjClient } from "../api/kkj-client.js";
import { AwardMappingResultSchema } from "../domain/investor.js";
import { toolError } from "../lib/tool-result.js";
import { formatMappingText, mapAwardsToListedResult } from "../tools/map-awards-to-listed.js";
import { searchBidsInputSchema } from "../tools/search-bids.js";

const INVESTOR_RADAR_APP_URI = "ui://jp-bids/investor-radar.html";

export function registerInvestorRadarApp(
  server: McpServer,
  client: KkjClient,
  jquants: JquantsClient,
): void {
  registerAppTool(
    server,
    "search_investor_radar_app",
    {
      title: "Investor Radar",
      description:
        "官公需公告を上場企業へ名寄せし、MCP Apps対応クライアントではInvestor Radar画面を表示する。USE THIS WHEN: 対応クライアントで銘柄付き公告フィードを見たいとき。DO NOT USE WHEN: テキストだけで足りるとき（map_awards_to_listed を使う）。投資助言ではない。Show KKJ notices mapped to listed tickers. This is not investment advice. Tampilkan pengumuman KKJ yang dipetakan ke ticker. Bukan nasihat investasi.",
      inputSchema: searchBidsInputSchema,
      outputSchema: AwardMappingResultSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: {
        ui: {
          resourceUri: INVESTOR_RADAR_APP_URI,
        },
      },
    },
    async (args) => {
      try {
        const result = await mapAwardsToListedResult(client, jquants, args);
        return {
          content: [{ type: "text" as const, text: formatMappingText(result) }],
          structuredContent: result,
        };
      } catch (error) {
        return toolError(
          error,
          "Investor Radar で一時的なエラーが発生しました。条件を絞って再実行してください。",
        );
      }
    },
  );

  registerAppResource(
    server,
    "JP Bids Investor Radar App",
    INVESTOR_RADAR_APP_URI,
    {
      title: "JP Bids Investor Radar",
      description: "Interactive MCP Apps workspace for listed-company procurement notices.",
      _meta: {
        ui: {
          csp: {
            connectDomains: [],
            resourceDomains: [],
          },
          permissions: {
            clipboardWrite: {},
          },
        },
      },
    },
    async () => ({
      contents: [
        {
          uri: INVESTOR_RADAR_APP_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: await readInvestorRadarAppHtml(),
          _meta: {
            ui: {
              csp: {
                connectDomains: [],
                resourceDomains: [],
              },
              permissions: {
                clipboardWrite: {},
              },
            },
          },
        },
      ],
    }),
  );
}

async function readInvestorRadarAppHtml(): Promise<string> {
  const candidateUrls = [
    new URL("./investor-radar.html", import.meta.url),
    new URL("../../dist/apps/investor-radar.html", import.meta.url),
  ];
  for (const url of candidateUrls) {
    try {
      return await readFile(url, "utf8");
    } catch (error) {
      if (!isFileNotFound(error)) {
        throw error;
      }
    }
  }
  throw new Error(
    "Investor Radar HTML is missing. Run npm run build:ui before reading the UI resource.",
  );
}

function isFileNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
