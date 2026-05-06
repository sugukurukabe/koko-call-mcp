// Gateway MCP Server factory
// ゲートウェイ MCP サーバーのファクトリ
// Pabrik server MCP Gateway

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VERSION } from "./lib/version.js";
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
        "日本の公的データMCP（入札・補助金・銀行・会計）を1回の接続で使えるFederation Gateway。JP Bids（入札）・Jグランツ（補助金）・GMOあおぞらネット銀行（振込）・マネーフォワード クラウド会計（仕訳・試算表）の4子MCPを統合。Japan public-data MCP federation gateway connecting JP Bids, J-Grants, GMO Aozora Net Bank, and MoneyForward Cloud Accounting in one connection. Gateway federasi MCP data publik Jepang yang menghubungkan JP Bids, J-Grants, GMO Aozora, dan MoneyForward Cloud Accounting dalam satu koneksi.",
    },
    {
      capabilities: {
        tools: { listChanged: false },
        logging: {},
      },
      instructions:
        "You are connected to the Public MCP JP Gateway, which federates Japan's public-data MCP servers. Available servers: JP Bids (procurement bids), J-Grants (government subsidies), GMO Aozora Net Bank (banking/transfers), MoneyForward Cloud Accounting (journal entries, trial balance). Start with get_gateway_demo when the user asks what this Gateway can do or wants a guided first run. Use list_connected_servers to explore, search_public_opportunities for bid+subsidy search, analyze_funding_fit for comprehensive opportunity analysis, and call_registered_mcp for direct child MCP calls. For MoneyForward, the client must pass an OAuth token via the X-Mcp-Child-Authorization-moneyforward-ca header. Always include attribution from tool results.",
    },
  );

  registerTools(server, options.context);

  return server;
}
