import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient } from "../api/kkj-client.js";
import { fetchDocument } from "../api/pdf-fetcher.js";
import {
  extractRequirementsWithSampling,
  type SamplingCreateMessage,
} from "../api/sampling-extractor.js";
import { isVertexAiEnabled, VertexGeminiClient } from "../api/vertex-gemini-client.js";
import { createAttribution } from "../domain/attribution.js";
import { type BidRequirementExtraction, BidRequirementExtractionSchema } from "../domain/bid.js";
import { extractBidRequirements } from "../domain/bid-requirements.js";
import { UserInputError } from "../lib/errors.js";
import { toolError } from "../lib/tool-result.js";

const inputSchema = {
  bid_key: z
    .string()
    .min(1)
    .describe("search_bids、rank_bids、またはlist_recent_bidsが返したKeyフィールド"),
  fetch_documents: z
    .boolean()
    .default(false)
    .describe("trueの場合、公式公告ページまたは添付資料を一時取得して要件抽出を試みる。"),
  target_uris: z
    .array(z.string().url())
    .max(3)
    .optional()
    .describe("抽出対象URL。省略時は検索結果の公式公告ページ・添付資料URLから最大3件を使う。"),
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
        const baseExtraction = extractBidRequirements(result.bid, result.attribution);
        const extracted = args.fetch_documents
          ? await enrichWithDocumentExtraction(server, baseExtraction, args.target_uris)
          : baseExtraction;
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

async function enrichWithDocumentExtraction(
  server: McpServer,
  extraction: BidRequirementExtraction,
  targetUris: string[] | undefined,
): Promise<BidRequirementExtraction> {
  const candidateUris = targetUris ?? extraction.documentTargets.map((target) => target.uri);
  const uniqueUris = [...new Set(candidateUris.filter((uri) => uri.length > 0))].slice(0, 3);
  if (uniqueUris.length === 0) {
    return {
      ...extraction,
      extractionWarnings: [
        ...extraction.extractionWarnings,
        "fetch_documents=true ですが、取得対象URLがありません。",
      ],
    };
  }

  const documents = await Promise.all(uniqueUris.map((uri) => fetchDocument(uri)));
  const extractedFromDocuments = documents.map((document) => ({
    sourceUri: document.sourceUri,
    finalUri: document.finalUri,
    sha256: document.sha256,
    sizeBytes: document.sizeBytes,
    mimeType: document.mimeType,
    extractedAt: new Date().toISOString(),
    mode: "none" as const,
  }));

  if (isVertexAiEnabled()) {
    const vertex = await new VertexGeminiClient().extractBidRequirements({
      bid: extraction.bid,
      documents,
    });
    return {
      ...extraction,
      extractedFromDocuments: extractedFromDocuments.map((document) => ({
        ...document,
        mode: "vertex_ai" as const,
      })),
      ...(vertex.extractedRequirements
        ? { extractedRequirements: vertex.extractedRequirements }
        : {}),
      rawExtractionText: vertex.rawText,
      extractionWarnings: [...extraction.extractionWarnings, ...vertex.warnings],
    };
  }

  if (!server.server.getClientCapabilities()?.sampling) {
    return {
      ...extraction,
      extractedFromDocuments,
      extractionWarnings: [
        ...extraction.extractionWarnings,
        "MCP client が sampling capability を宣言していないため、PDF/HTML本文のAI抽出は実行しませんでした。",
      ],
    };
  }

  const sampling = await extractRequirementsWithSampling({
    bid: extraction.bid,
    documents,
    createMessage: server.server.createMessage.bind(server.server) as SamplingCreateMessage,
  });

  return {
    ...extraction,
    extractedFromDocuments: extractedFromDocuments.map((document) => ({
      ...document,
      mode: "sampling" as const,
    })),
    ...(sampling.extractedRequirements
      ? { extractedRequirements: sampling.extractedRequirements }
      : {}),
    rawExtractionText: sampling.rawText,
    extractionWarnings: [...extraction.extractionWarnings, ...sampling.warnings],
  };
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
    "AI抽出結果:",
    ...(extracted.extractedRequirements
      ? [
          `- 参加資格: ${toInlineList(extracted.extractedRequirements.eligibility)}`,
          `- 提出書類: ${toInlineList(extracted.extractedRequirements.requiredDocuments)}`,
          `- 質問期限: ${extracted.extractedRequirements.questionDeadline ?? "要確認"}`,
          `- 失格条件: ${toInlineList(extracted.extractedRequirements.disqualification)}`,
        ]
      : ["- 未実行または抽出不可"]),
    "",
    "抽出警告:",
    ...(extracted.extractionWarnings.length > 0
      ? extracted.extractionWarnings.map((warning) => `- ${warning}`)
      : ["- なし"]),
    "",
    `出典: ${extracted.attribution.dataSource}`,
  ].join("\n");
}

function toInlineList(values: string[]): string {
  return values.length > 0 ? values.join(" / ") : "要確認";
}
