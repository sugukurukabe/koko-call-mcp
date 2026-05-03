import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchDocument } from "../api/pdf-fetcher.js";
import {
  extractRequirementsWithSampling,
  type SamplingCreateMessage,
} from "../api/sampling-extractor.js";
import { isVertexAiEnabled, VertexGeminiClient } from "../api/vertex-gemini-client.js";
import type { BidRequirementExtraction } from "../domain/bid.js";
import { isBillingEnabled, recordPdfExtractionUsage } from "../lib/billing.js";

export const documentExtractionInputSchema = {
  fetch_documents: {
    description: "trueの場合、公式公告ページまたは添付資料を一時取得して要件抽出を試みる。",
  },
  target_uris: {
    description: "抽出対象URL。省略時は検索結果の公式公告ページ・添付資料URLから最大3件を使う。",
  },
} as const;

/**
 * PDF/HTML書類を取得しAI抽出した結果でBidRequirementExtractionを強化する
 * Enrich BidRequirementExtraction with AI-extracted content from PDF/HTML documents
 * Memperkaya BidRequirementExtraction dengan konten yang diekstraksi AI dari dokumen PDF/HTML
 *
 * @param server - MCPサーバーインスタンス / MCP server instance / Instance server MCP
 * @param extraction - 抽出元データ / Source extraction data / Data ekstraksi sumber
 * @param targetUris - 対象URL / Target URIs / URI target
 * @param stripeCustomerId - Stripe顧客ID（課金追跡用）/ Stripe customer ID (for billing tracking) / ID pelanggan Stripe (untuk pelacakan penagihan)
 */
export async function enrichWithDocumentExtraction(
  server: McpServer,
  extraction: BidRequirementExtraction,
  targetUris: string[] | undefined,
  stripeCustomerId?: string,
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

  // PDF取得成功時にStripe Meterイベントを送信（fire-and-forget、課金失敗はツール実行を止めない）
  // Send Stripe Meter event on successful PDF fetch (fire-and-forget, billing failure must not block tool)
  // Kirim acara Stripe Meter saat PDF berhasil diambil (fire-and-forget, kegagalan penagihan tidak menghentikan alat)
  const billingCustomerId = stripeCustomerId ?? process.env.STRIPE_DEFAULT_CUSTOMER_ID;
  if (isBillingEnabled() && billingCustomerId) {
    void recordPdfExtractionUsage(billingCustomerId);
  }

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
