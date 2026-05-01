import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createKokoCallServer } from "../mcp.js";

export async function startStdioServer(): Promise<void> {
  const server = createKokoCallServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("KokoCallMCP listening on stdio");
}
