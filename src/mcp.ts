import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JquantsClient } from "./api/jquants-client.js";
import { KkjClient, type KkjClientOptions } from "./api/kkj-client.js";
import { registerInvestorRadarApp } from "./apps/register-investor-app.js";
import { registerSearchResultsApp } from "./apps/register-search-app.js";
import type { Tier } from "./lib/auth.js";
import { getBranding } from "./lib/branding.js";
import { VERSION } from "./lib/version.js";
import { registerPrompts } from "./prompts/register-prompts.js";
import { registerResources } from "./resources/register-resources.js";
import { registerTools } from "./tools/register-tools.js";

export interface CreateJpBidsServerOptions {
  kkjClient?: KkjClient;
  kkjClientOptions?: KkjClientOptions;
  jquantsClient?: JquantsClient;
  // リクエストごとのティア（Free/Pro）。省略時はPro（stdio・開発環境）
  // Per-request tier (Free/Pro). Defaults to Pro (stdio / dev environments)
  // Tier per permintaan (Free/Pro). Default Pro (stdio / lingkungan pengembangan)
  tier?: Tier;
}

export function createJpBidsServer(options: CreateJpBidsServerOptions = {}): McpServer {
  const tier: Tier = options.tier ?? "pro";
  const branding = getBranding();
  const server = new McpServer(
    {
      name: branding.serviceName,
      title: branding.serviceName,
      version: VERSION,
      description:
        "Japan KKJ procurement notices through MCP, with Investor Radar ticker mapping. Not investment advice.",
    },
    {
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false, subscribe: false },
        prompts: { listChanged: false },
        completions: {},
      },
      instructions:
        tier === "pro"
          ? "Use JP Bids to search public Japanese government procurement notices. Investor Radar tools map notices to listed-company tickers and can overlay public daily closes when a J-Quants API key is provided. Never give buy/sell advice. Always show the KKJ attribution included in tool results."
          : "Use JP Bids (Free tier) to search public Japanese government procurement bid information. Available tools: search_bids, rank_bids, list_recent_bids, get_bid_detail. Upgrade to Pro (990 JPY/month) for AI analysis and PDF extraction tools. Always show the KKJ attribution included in tool results.",
    },
  );
  const client = options.kkjClient ?? new KkjClient(options.kkjClientOptions);
  const jquants = options.jquantsClient ?? new JquantsClient();
  registerTools(server, client, tier, jquants);
  if (tier === "pro") {
    registerSearchResultsApp(server, client);
    registerInvestorRadarApp(server, client, jquants);
  }
  registerPrompts(server, tier);
  registerResources(server, client);
  return server;
}

// Smithery ディレクトリ掲載用サンドボックスサーバー
// Sandbox server for Smithery directory scanning
// Server sandbox untuk pemindaian direktori Smithery
export function createSandboxServer(): McpServer {
  return createJpBidsServer();
}
