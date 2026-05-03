import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient } from "../api/kkj-client.js";
import { createAttribution } from "../domain/attribution.js";
import { BidRequirementExtractionSchema } from "../domain/bid.js";
import { extractBidRequirements } from "../domain/bid-requirements.js";
import { UserInputError } from "../lib/errors.js";
import { toolError } from "../lib/tool-result.js";

const inputSchema = {
  bid_key: z
    .string()
    .min(1)
    .describe("search_bids、rank_bids、またはlist_recent_bidsが返したKeyフィールド"),
};

export function registerExtractBidRequirements(server: McpServer, client: KkjClient): void {
  server.registerTool(
    "extract_bid_requirements",
    {
      title: "入札要件抽出MVP",
      description:
        "1件の入札Keyについて、検索結果メタデータと添付資料情報から参加条件・期限・確認すべきPDFを構造化する。PDF本文は保存せず、Gemini / Document AI連携前の安全な要件整理として使う。",
      inputSchema,
      outputSchema: BidRequirementExtractionSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const cached = client.getCachedBid(args.bid_key);
        const result = cached
          ? { bid: cached, attribution: createAttribution() }
          : await findBidByKey(client, args.bid_key);
        const extracted = extractBidRequirements(result.bid, result.attribution);
        return {
          content: [{ type: "text" as const, text: formatRequirementText(extracted) }],
          structuredContent: extracted,
        };
      } catch (error) {
        return toolError(
          error,
          "入札要件抽出で一時的なエラーが発生しました。rank_bids または search_bids で取得した最新のbid_keyを指定してください。",
        );
      }
    },
  );
}

async function findBidByKey(client: KkjClient, bidKey: string) {
  const searchResult = await client.search({ Query: bidKey, Count: 10 });
  const bid = searchResult.bids.find((candidate) => candidate.key === bidKey);
  if (!bid) {
    throw new UserInputError(
      "指定された bid_key の入札を確認できませんでした。rank_bids または search_bids で取得した最新の Key を指定してください。",
    );
  }
  return { bid, attribution: searchResult.attribution };
}

function formatRequirementText(extracted: z.infer<typeof BidRequirementExtractionSchema>): string {
  return [
    `■ ${extracted.bid.projectName}`,
    `Key: ${extracted.bid.key}`,
    "",
    "既知の要件:",
    ...Object.entries(extracted.knownRequirements).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "確認すべき資料:",
    ...(extracted.documentTargets.length > 0
      ? extracted.documentTargets.map((target) => `- ${target.label}: ${target.uri}`)
      : ["- 公式公告ページまたは添付資料URLが検索結果にありません"]),
    "",
    "不足・要確認:",
    ...extracted.missingRequirements.map((item) => `- ${item}`),
    "",
    `出典: ${extracted.attribution.dataSource}`,
  ].join("\n");
}
