import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient } from "../api/kkj-client.js";
import { createAttribution } from "../domain/attribution.js";
import { BidQualificationAssessmentSchema } from "../domain/bid.js";
import { assessBidQualification } from "../domain/bid-qualification.js";
import { extractBidRequirements } from "../domain/bid-requirements.js";
import { UserInputError } from "../lib/errors.js";
import { toolError } from "../lib/tool-result.js";
import { enrichWithDocumentExtraction } from "./document-extraction.js";

const inputSchema = {
  bid_key: z
    .string()
    .min(1)
    .describe("search_bids、rank_bids、またはlist_recent_bidsが返したKeyフィールド"),
  qualified_prefectures: z
    .array(z.string().min(1))
    .default([])
    .describe("自社が対応できる都道府県。例: 鹿児島県、宮崎県。"),
  qualified_categories: z
    .array(z.string().min(1))
    .default([])
    .describe("自社が対応できるカテゴリ。例: 役務、物品。"),
  certifications: z
    .array(z.string().min(1))
    .default([])
    .describe("自社が持つ資格・等級・営業品目。例: A、役務の提供等、情報処理。"),
  service_keywords: z
    .array(z.string().min(1))
    .default([])
    .describe("自社サービスに関係する語句。例: システム、保守、クラウド。"),
  fetch_documents: z
    .boolean()
    .default(false)
    .describe("trueの場合、PDF/HTML抽出結果を資格判定に反映する。"),
  target_uris: z
    .array(z.string().url())
    .max(3)
    .optional()
    .describe("抽出対象URL。省略時は検索結果の公式公告ページ・添付資料URLから最大3件を使う。"),
};

export function registerAssessBidQualification(server: McpServer, client: KkjClient): void {
  server.registerTool(
    "assess_bid_qualification",
    {
      title: "入札資格適合MVP判定",
      description:
        "1件の入札について自社の地域・カテゴリ・資格と照合し参加可否をMVP判定する。Check bid participation eligibility against your company's region, category, and certifications. Periksa kelayakan mengikuti tender berdasarkan wilayah, kategori, dan sertifikasi perusahaan.",
      inputSchema,
      outputSchema: BidQualificationAssessmentSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const cached = client.getCachedBid(args.bid_key);
        const result = cached
          ? { bid: cached, attribution: createAttribution() }
          : await findBidByKey(client, args.bid_key);
        const baseRequirements = extractBidRequirements(result.bid, result.attribution);
        const requirements = args.fetch_documents
          ? await enrichWithDocumentExtraction(server, baseRequirements, args.target_uris)
          : baseRequirements;
        const assessment = assessBidQualification(
          result.bid,
          {
            qualifiedPrefectures: args.qualified_prefectures,
            qualifiedCategories: args.qualified_categories,
            certifications: args.certifications,
            serviceKeywords: args.service_keywords,
          },
          result.attribution,
          requirements,
        );
        return {
          content: [{ type: "text" as const, text: formatAssessmentText(assessment) }],
          structuredContent: assessment,
        };
      } catch (error) {
        return toolError(
          error,
          "入札資格適合判定で一時的なエラーが発生しました。rank_bids または search_bids で取得した最新のbid_keyを指定してください。",
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

function formatAssessmentText(
  assessment: z.infer<typeof BidQualificationAssessmentSchema>,
): string {
  return [
    `■ ${assessment.bid.projectName}`,
    `資格適合: ${assessment.status} / confidence ${assessment.confidence}`,
    "",
    "一致:",
    ...toList(assessment.matches, "一致候補はまだ確認できません"),
    "",
    "ギャップ:",
    ...toList(assessment.gaps, "明確なギャップは未検出"),
    "",
    "不明点:",
    ...toList(assessment.unknowns, "不明点は未検出"),
    "",
    "PDF/HTML抽出で使用した要件:",
    ...(assessment.requirementsUsed
      ? [
          `- 抽出mode: ${assessment.requirementsUsed.documentExtractionMode}`,
          `- 参加資格: ${toListInline(assessment.requirementsUsed.eligibility)}`,
          `- 提出書類: ${toListInline(assessment.requirementsUsed.requiredDocuments)}`,
          `- 提出期限: ${assessment.requirementsUsed.tenderSubmissionDeadline ?? "要確認"}`,
        ]
      : ["- 未使用"]),
    "",
    "次アクション:",
    ...assessment.nextActions.map((action) => `- ${action}`),
    "",
    `出典: ${assessment.attribution.dataSource}`,
  ].join("\n");
}

function toList(values: string[], fallback: string): string[] {
  return (values.length > 0 ? values : [fallback]).map((value) => `- ${value}`);
}

function toListInline(values: string[]): string {
  return values.length > 0 ? values.join(" / ") : "要確認";
}
