import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const remoteMcpUrl = process.env.JP_BIDS_REMOTE_MCP_URL ?? "https://mcp.bid-jp.com/mcp";
const runDocumentFetch =
  process.env.JP_BIDS_REMOTE_EXTRACTION_FETCH === "1" ||
  process.env.JP_BIDS_REMOTE_EXTRACTION_FETCH === "true";
const verbose =
  process.env.JP_BIDS_REMOTE_EXTRACTION_VERBOSE === "1" ||
  process.env.JP_BIDS_REMOTE_EXTRACTION_VERBOSE === "true";
const fallbackTargetUri =
  process.env.JP_BIDS_REMOTE_EXTRACTION_TARGET_URI ?? "https://example.com/";

const client = new Client({
  name: "jp-bids-remote-extraction-check",
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

  const searchResult = await client.callTool({
    name: "search_bids",
    arguments: {
      query: process.env.JP_BIDS_REMOTE_EXTRACTION_QUERY ?? "システム",
      prefecture: process.env.JP_BIDS_REMOTE_EXTRACTION_PREFECTURE ?? "鹿児島県",
      limit: 1,
    },
  });
  if (searchResult.isError) {
    throw new Error(`search_bids returned isError: ${JSON.stringify(searchResult.content)}`);
  }

  const structuredSearch = searchResult.structuredContent as {
    bids?: Array<{
      key?: string;
      externalDocumentUri?: string;
      attachments?: Array<{ uri?: string }>;
    }>;
  };
  const bid = structuredSearch.bids?.[0];
  if (!bid?.key) {
    throw new Error("search_bids returned no bid key for extraction smoke.");
  }

  const targetUri =
    bid.externalDocumentUri ??
    bid.attachments?.find((attachment) => attachment.uri && attachment.uri.length > 0)?.uri ??
    fallbackTargetUri;

  const extractionResult = await client.callTool({
    name: "extract_bid_requirements",
    arguments: {
      bid_key: bid.key,
      ...(runDocumentFetch
        ? {
            fetch_documents: true,
            target_uris: [targetUri],
          }
        : {}),
    },
  });
  if (extractionResult.isError) {
    throw new Error(
      `extract_bid_requirements returned isError: ${JSON.stringify(extractionResult.content)}`,
    );
  }

  const structuredExtraction = extractionResult.structuredContent as {
    bid?: { key?: string; projectName?: string };
    knownRequirements?: Record<string, unknown>;
    extractedRequirements?: {
      eligibility?: string[];
      requiredDocuments?: string[];
      questionDeadline?: string | null;
      tenderSubmissionDeadline?: string | null;
      openingDate?: string | null;
      briefingDate?: string | null;
      deliveryDeadline?: string | null;
      contractPeriod?: string | null;
      contactPoint?: string | null;
      disqualification?: string[];
      estimatedBudget?: string | null;
      evaluationCriteria?: string[];
      ambiguousPoints?: string[];
      rawNotes?: string[];
    };
    extractedFromDocuments?: Array<{
      sourceUri?: string;
      finalUri?: string;
      mimeType?: string;
      mode?: string;
      sizeBytes?: number;
      sha256?: string;
    }>;
    extractionWarnings?: string[];
  };
  if (structuredExtraction.bid?.key !== bid.key) {
    throw new Error(
      `extract_bid_requirements returned unexpected bid key: ${structuredExtraction.bid?.key}`,
    );
  }
  if (!structuredExtraction.knownRequirements) {
    throw new Error("extract_bid_requirements returned no knownRequirements object.");
  }

  console.error(
    [
      `extract_bid_requirements OK: ${bid.key}`,
      `fetch_documents: ${runDocumentFetch ? "true" : "false"}`,
      `documents: ${structuredExtraction.extractedFromDocuments?.length ?? 0}`,
      `warnings: ${structuredExtraction.extractionWarnings?.length ?? 0}`,
      ...(structuredExtraction.extractedRequirements
        ? [
            `eligibility: ${summaryList(structuredExtraction.extractedRequirements.eligibility)}`,
            `requiredDocuments: ${summaryList(structuredExtraction.extractedRequirements.requiredDocuments)}`,
            `questionDeadline: ${structuredExtraction.extractedRequirements.questionDeadline ?? "none"}`,
            `tenderSubmissionDeadline: ${structuredExtraction.extractedRequirements.tenderSubmissionDeadline ?? "none"}`,
            `openingDate: ${structuredExtraction.extractedRequirements.openingDate ?? "none"}`,
            `briefingDate: ${structuredExtraction.extractedRequirements.briefingDate ?? "none"}`,
            `contactPoint: ${structuredExtraction.extractedRequirements.contactPoint ?? "none"}`,
            `ambiguousPoints: ${summaryList(structuredExtraction.extractedRequirements.ambiguousPoints)}`,
          ]
        : ["extractedRequirements: none"]),
    ].join("\n"),
  );
  if (verbose) {
    console.error(JSON.stringify(structuredExtraction, null, 2));
  }
} finally {
  await client.close();
}

function summaryList(values: string[] | undefined): string {
  if (!values || values.length === 0) {
    return "none";
  }
  return values.slice(0, 3).join(" / ");
}
