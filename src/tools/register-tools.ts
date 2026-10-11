import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JquantsClient } from "../api/jquants-client.js";
import type { KkjClient } from "../api/kkj-client.js";
import type { ServerProfile } from "../lib/profile.js";
import { registerAnalyzeAwardPriceImpact } from "./analyze-award-price-impact.js";
import { registerAnalyzePastAwards } from "./analyze-past-awards.js";
import { registerAssessBidQualification } from "./assess-bid-qualification.js";
import { registerCreateBidCalendar } from "./create-bid-calendar.js";
import { registerCreateBidReviewPacket } from "./create-bid-review-packet.js";
import { registerDraftBidQuestions } from "./draft-bid-questions.js";
import { registerExplainBidFit } from "./explain-bid-fit.js";
import { registerExportBidShortlist } from "./export-bid-shortlist.js";
import { registerExtractBidRequirements } from "./extract-bid-requirements.js";
import { registerGetBidDetail } from "./get-bid-detail.js";
import { registerGetListedAwardHistory } from "./get-listed-award-history.js";
import { registerListRecentBids } from "./list-recent-bids.js";
import { registerMapAwardsToListed } from "./map-awards-to-listed.js";
import { registerRankBids } from "./rank-bids.js";
import { registerSavedSearchAlert } from "./saved-search-alert.js";
import { registerSearchBids } from "./search-bids.js";
import { registerSummarizeBidsByOrg } from "./summarize-bids-by-org.js";
import { registerWatchListedAwards } from "./watch-listed-awards.js";

// Public MVP 6 tools (7th is search_bids_app registered with the app resource)
export const PUBLIC_MVP_TOOL_REGISTRATIONS = [
  registerSearchBids,
  registerListRecentBids,
  registerGetBidDetail,
  registerRankBids,
  registerExtractBidRequirements,
  registerExportBidShortlist,
] as const;

// Additional tools registered only in full_local profile
export const FULL_LOCAL_ONLY_TOOL_REGISTRATIONS = [
  registerExplainBidFit,
  registerAssessBidQualification,
  registerCreateBidCalendar,
  registerCreateBidReviewPacket,
  registerDraftBidQuestions,
  registerAnalyzePastAwards,
  registerSummarizeBidsByOrg,
  registerSavedSearchAlert,
] as const;

export function registerTools(
  server: McpServer,
  client: KkjClient,
  profile: ServerProfile = "public_mvp",
  jquants?: JquantsClient,
): void {
  for (const register of PUBLIC_MVP_TOOL_REGISTRATIONS) {
    (register as (s: McpServer, c: KkjClient, p?: ServerProfile) => void)(server, client, profile);
  }
  if (profile === "full_local") {
    for (const register of FULL_LOCAL_ONLY_TOOL_REGISTRATIONS) {
      register(server, client);
    }
    const jq = jquants ?? new JquantsClient();
    registerMapAwardsToListed(server, client, jq);
    registerGetListedAwardHistory(server, client, jq);
    registerAnalyzeAwardPriceImpact(server, client, jq);
    registerWatchListedAwards(server, client, jq);
  }
}
