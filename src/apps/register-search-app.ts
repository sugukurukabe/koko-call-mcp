import { readFile } from "node:fs/promises";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KkjClient } from "../api/kkj-client.js";
import { BidSearchResultSchema } from "../domain/bid.js";
import { toolError } from "../lib/tool-result.js";
import {
  buildSearchBidsParams,
  formatSearchSummary,
  searchBidsInputSchema,
} from "../tools/search-bids.js";

const SEARCH_RESULTS_APP_URI = "ui://jp-bids/search-results.html";

export function registerSearchResultsApp(server: McpServer, client: KkjClient): void {
  registerAppTool(
    server,
    "search_bids_app",
    {
      title: "官公需入札検索テーブル",
      description:
        "日本全国の官公需入札情報を検索し、MCP Apps対応クライアントでは検索結果を表で表示する。非対応クライアントでも通常のテキスト要約とstructuredContentを返す。",
      inputSchema: searchBidsInputSchema,
      outputSchema: BidSearchResultSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: {
        ui: {
          resourceUri: SEARCH_RESULTS_APP_URI,
        },
      },
    },
    async (args) => {
      try {
        const result = await client.search(buildSearchBidsParams(args));
        return {
          content: [{ type: "text" as const, text: formatSearchSummary(result) }],
          structuredContent: result,
        };
      } catch (error) {
        return toolError(
          error,
          "官公需入札検索テーブルで一時的なエラーが発生しました。条件を絞って再実行してください。",
        );
      }
    },
  );

  registerAppResource(
    server,
    "JP Bids Search Results App",
    SEARCH_RESULTS_APP_URI,
    {
      title: "JP Bids Search Results",
      description: "Interactive MCP Apps table for JP Bids search results.",
      _meta: {
        ui: {
          csp: {
            connectDomains: [],
            resourceDomains: [],
          },
        },
      },
    },
    async () => ({
      contents: [
        {
          uri: SEARCH_RESULTS_APP_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: await readSearchResultsAppHtml(),
          _meta: {
            ui: {
              csp: {
                connectDomains: [],
                resourceDomains: [],
              },
            },
          },
        },
      ],
    }),
  );
}

async function readSearchResultsAppHtml(): Promise<string> {
  const candidateUrls = [
    new URL("./search-results.html", import.meta.url),
    new URL("../../dist/apps/search-results.html", import.meta.url),
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
  throw new Error("MCP Apps HTML is missing. Run npm run build:ui before reading the UI resource.");
}

function isFileNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
