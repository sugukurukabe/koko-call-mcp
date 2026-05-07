// Gateway MCP Server factory
// ゲートウェイ MCP サーバーのファクトリ
// Pabrik server MCP Gateway

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VERSION } from "./lib/version.js";
import { registerPrompts } from "./prompts/register-prompts.js";
import { registerResources } from "./resources/register-resources.js";
import { registerTools, type ToolContext } from "./tools/register-tools.js";

export interface CreateGatewayServerOptions {
  context: ToolContext;
}

export function createGatewayServer(options: CreateGatewayServerOptions): McpServer {
  const server = new McpServer(
    {
      name: "Public MCP JP Gateway",
      title: "Public MCP JP Gateway",
      version: VERSION,
      description:
        "日本の公的データMCP（入札・補助金・法人番号・農業統計・不動産・会計）を1回の接続で使えるFederation Gateway。JP Bids（入札）・Jグランツ（補助金）・法人番号（国税庁）・AgriOps（農業統計）・不動産インテル（地価・投資分析）・マネーフォワード クラウド会計（仕訳・試算表）・freee（会計・請求書）の7子MCPを統合。GMO銀行系APIは利用許諾・API取得後にprivate connectorとして追加予定です。Japan public-data MCP federation gateway connecting JP Bids, J-Grants, Corporate Number, AgriOps, Real Estate Intel, MoneyForward Cloud Accounting, and freee in one connection. GMO banking APIs are planned as a future private connector after permission and API access are obtained.",
    },
    {
      capabilities: {
        tools: { listChanged: false },
        prompts: { listChanged: false },
        resources: { listChanged: false },
        logging: {},
      },
      instructions:
        "You are connected to the Public MCP JP Gateway, which federates Japan's public-data MCP servers. Available servers: JP Bids (procurement bids), J-Grants (government subsidies), Corporate Number (NTA corporate registry), AgriOps (agriculture/municipality stats), Real Estate Intel (land price, transactions, disaster risk, human flow, investment analysis — 10 prefectures), MoneyForward Cloud Accounting (journal entries, trial balance), freee (accounting/invoicing). GMO banking APIs are not exposed in the public Gateway; they are planned only as a future private connector after permission and API access are obtained. Start with the gateway_quick_tour prompt or get_gateway_demo tool when the user asks what this Gateway can do. Use list_connected_servers to explore, search_public_opportunities for bid+subsidy search, analyze_funding_fit for comprehensive opportunity analysis, call_registered_mcp for direct child MCP calls, and suggest_next_actions when unsure what to do next. For real estate analysis, use mode 'real_estate_analysis' or 'store_location'. Resources are available at gateway://registry/summary, gateway://modes/reference, gateway://samples/queries, and gateway://attribution/all. For MoneyForward, the client must pass an OAuth token via the X-Mcp-Child-Authorization-moneyforward-ca header. Always include attribution from tool results.",
    },
  );

  registerTools(server, options.context);
  registerPrompts(server);
  registerResources(server);

  return server;
}
