import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JquantsClient } from "../api/jquants-client.js";
import type { KkjClient } from "../api/kkj-client.js";
import type { Tier } from "../lib/auth.js";
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

// Freeティアで利用可能なツール: search, rank, list, detail のみ
// Tools available in Free tier: only search, rank, list, detail
// Alat yang tersedia di tier Free: hanya search, rank, list, detail
const FREE_TIER_REGISTRATIONS = [
  registerSearchBids,
  registerRankBids,
  registerListRecentBids,
  registerGetBidDetail,
] as const;

// Proティア専用ツール（AI分析・PDF抽出を含む）
// Pro-tier exclusive tools (including AI analysis and PDF extraction)
// Alat eksklusif tier Pro (termasuk analisis AI dan ekstraksi PDF)
const PRO_ONLY_REGISTRATIONS = [
  registerExplainBidFit,
  registerAssessBidQualification,
  registerExtractBidRequirements,
  registerExportBidShortlist,
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
  tier: Tier = "pro",
  jquants: JquantsClient = new JquantsClient(),
): void {
  for (const register of FREE_TIER_REGISTRATIONS) {
    register(server, client);
  }
  if (tier === "pro") {
    for (const register of PRO_ONLY_REGISTRATIONS) {
      register(server, client);
    }
    registerMapAwardsToListed(server, client, jquants);
    registerGetListedAwardHistory(server, client, jquants);
    registerAnalyzeAwardPriceImpact(server, client, jquants);
    registerWatchListedAwards(server, client, jquants);
  }
}
