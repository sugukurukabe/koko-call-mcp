import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KkjClient } from "../api/kkj-client.js";
import { registerGetBidDetail } from "./get-bid-detail.js";
import { registerListRecentBids } from "./list-recent-bids.js";
import { registerSearchBids } from "./search-bids.js";
import { registerSummarizeBidsByOrg } from "./summarize-bids-by-org.js";

export function registerTools(server: McpServer, client: KkjClient): void {
  registerSearchBids(server, client);
  registerListRecentBids(server, client);
  registerGetBidDetail(server, client);
  registerSummarizeBidsByOrg(server, client);
}
