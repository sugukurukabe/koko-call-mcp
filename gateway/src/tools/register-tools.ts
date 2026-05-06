// Gateway ツールの一括登録
// Register all Gateway MCP tools
// Daftarkan semua alat MCP Gateway

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Tier } from "../lib/auth.js";
import { registerAnalyzeFundingFit } from "./analyze-funding-fit.js";
import { registerCallRegisteredMcp } from "./call-registered-mcp.js";
import { registerGetAuditEvents } from "./get-audit-events.js";
import { registerGetGatewayDemo } from "./get-gateway-demo.js";
import { registerIssueApprovalToken } from "./issue-approval-token.js";
import { registerListConnectedServers } from "./list-connected-servers.js";
import { registerSearchPublicOpportunities } from "./search-public-opportunities.js";

export interface ToolContext {
  tier: Tier;
  isOAuthAuthenticated: boolean;
  actorHash: string;
  // X-Mcp-Child-Authorization-{server-id} ヘッダ由来のトークン（server-id → Bearer token）
  // Tokens from X-Mcp-Child-Authorization-{server-id} headers (server-id → Bearer token)
  // Token dari header X-Mcp-Child-Authorization-{server-id} (server-id → Bearer token)
  childAuthHeaders: Record<string, string>;
}

export function registerTools(server: McpServer, context: ToolContext): void {
  // Free tier ツール
  registerGetGatewayDemo(server);
  registerListConnectedServers(server, context);
  registerSearchPublicOpportunities(server);

  // Pro tier ツール
  if (context.tier !== "pro") {
    return;
  }
  registerAnalyzeFundingFit(server, context);
  registerCallRegisteredMcp(server, context);
  registerGetAuditEvents(server, context);
  registerIssueApprovalToken(server, context);
}
