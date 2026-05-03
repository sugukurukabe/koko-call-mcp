import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KkjClient } from "../api/kkj-client.js";
import { registerAnalyzePastAwards } from "./analyze-past-awards.js";
import { registerAssessBidQualification } from "./assess-bid-qualification.js";
import { registerCreateBidCalendar } from "./create-bid-calendar.js";
import { registerCreateBidReviewPacket } from "./create-bid-review-packet.js";
import { registerDraftBidQuestions } from "./draft-bid-questions.js";
import { registerExplainBidFit } from "./explain-bid-fit.js";
import { registerExportBidShortlist } from "./export-bid-shortlist.js";
import { registerExtractBidRequirements } from "./extract-bid-requirements.js";
import { registerGetBidDetail } from "./get-bid-detail.js";
import { registerListRecentBids } from "./list-recent-bids.js";
import { registerRankBids } from "./rank-bids.js";
import { registerSearchBids } from "./search-bids.js";
import { registerSummarizeBidsByOrg } from "./summarize-bids-by-org.js";

export function registerTools(server: McpServer, client: KkjClient): void {
  registerSearchBids(server, client);
  registerRankBids(server, client);
  registerExplainBidFit(server, client);
  registerAssessBidQualification(server, client);
  registerExtractBidRequirements(server, client);
  registerExportBidShortlist(server, client);
  registerCreateBidCalendar(server, client);
  registerCreateBidReviewPacket(server, client);
  registerDraftBidQuestions(server, client);
  registerAnalyzePastAwards(server, client);
  registerListRecentBids(server, client);
  registerGetBidDetail(server, client);
  registerSummarizeBidsByOrg(server, client);
}
