import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { KkjClient, type KkjClientOptions } from "./api/kkj-client.js";
import { registerPrompts } from "./prompts/register-prompts.js";
import { registerResources } from "./resources/register-resources.js";
import { registerTools } from "./tools/register-tools.js";

export interface CreateKokoCallServerOptions {
  kkjClient?: KkjClient;
  kkjClientOptions?: KkjClientOptions;
}

export function createKokoCallServer(options: CreateKokoCallServerOptions = {}): McpServer {
  const server = new McpServer(
    {
      name: "KokoCallMCP",
      title: "KokoCallMCP",
      version: "0.2.0",
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
        "Use KokoCallMCP to search public Japanese government procurement bid information. Always show the KKJ attribution included in tool results.",
    },
  );
  const client = options.kkjClient ?? new KkjClient(options.kkjClientOptions);
  registerTools(server, client);
  registerPrompts(server);
  registerResources(server, client);
  return server;
}
