import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createJpBidsServer } from "../mcp.js";

export async function startStdioServer(): Promise<void> {
  const server = createJpBidsServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("JP Bids MCP listening on stdio");
}
