import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { KkjClient, type KkjClientOptions } from "./api/kkj-client.js";
import { registerSearchResultsApp } from "./apps/register-search-app.js";
import { registerPrompts } from "./prompts/register-prompts.js";
import { registerResources } from "./resources/register-resources.js";
import { registerTools } from "./tools/register-tools.js";

export interface CreateJpBidsServerOptions {
  kkjClient?: KkjClient;
  kkjClientOptions?: KkjClientOptions;
}

export function createJpBidsServer(options: CreateJpBidsServerOptions = {}): McpServer {
  const server = new McpServer(
    {
      name: "JP Bids MCP",
      title: "JP Bids MCP",
      version: "0.6.2",
      description: "Japan government procurement bid search through the Model Context Protocol.",
    },
    {
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false, subscribe: false },
        prompts: { listChanged: false },
        completions: {},
        logging: {},
      },
      instructions:
        "Use JP Bids MCP to search public Japanese government procurement bid information. Always show the KKJ attribution included in tool results.",
    },
  );
  const client = options.kkjClient ?? new KkjClient(options.kkjClientOptions);
  registerTools(server, client);
  registerSearchResultsApp(server, client);
  registerPrompts(server);
  registerResources(server, client);
  return server;
}
