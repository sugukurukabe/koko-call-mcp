import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const remoteMcpUrl = process.env.JP_BIDS_REMOTE_MCP_URL ?? "https://mcp.bid-jp.com/mcp";

const client = new Client({
  name: "jp-bids-remote-check",
  version: "0.1.0",
});

const transport = new StreamableHTTPClientTransport(new URL(remoteMcpUrl), {
  requestInit: {
    headers: {
      Origin: process.env.JP_BIDS_REMOTE_ORIGIN ?? "https://mcp.bid-jp.com",
    },
  },
});

try {
  await client.connect(transport);

  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name);
  for (const expected of [
    "search_bids",
    "list_recent_bids",
    "get_bid_detail",
    "summarize_bids_by_org",
  ]) {
    if (!toolNames.includes(expected)) {
      throw new Error(`Missing tool: ${expected}`);
    }
  }
  console.error(`tools/list OK: ${toolNames.join(", ")}`);

  const prompts = await client.listPrompts();
  console.error(`prompts/list OK: ${prompts.prompts.map((prompt) => prompt.name).join(", ")}`);

  const resources = await client.listResources();
  console.error(
    `resources/list OK: ${resources.resources.map((resource) => resource.uri).join(", ")}`,
  );

  const templates = await client.listResourceTemplates();
  console.error(
    `resources/templates/list OK: ${templates.resourceTemplates
      .map((template) => template.uriTemplate)
      .join(", ")}`,
  );

  const completion = await client.complete({
    ref: { type: "ref/resource", uri: "prefecture://{lg_code}" },
    argument: { name: "lg_code", value: "4" },
  });
  if (!completion.completion.values.includes("46")) {
    throw new Error("prefecture completion did not include 46");
  }
  console.error("completion/complete OK");

  const result = await client.callTool({
    name: "search_bids",
    arguments: {
      query: "システム",
      prefecture: "鹿児島県",
      limit: 1,
    },
  });
  if (result.isError) {
    throw new Error(`search_bids returned isError: ${JSON.stringify(result.content)}`);
  }
  console.error("tools/call search_bids OK");
} finally {
  await client.close();
}
