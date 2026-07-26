import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { KkjClient } from "../api/kkj-client.js";
import { CategorySchema } from "../domain/codes.js";
import { PrefectureNameSchema } from "../domain/prefectures.js";
import { UserInputError } from "../lib/errors.js";
import { jsonText, toolError } from "../lib/tool-result.js";
import { signJwt, verifyJwt } from "../oauth/jwt.js";
import { buildSearchBidsParams, type SearchBidsInput } from "./search-bids.js";

const SaveSearchOutputSchema = z.object({
  saved: z.boolean(),
  name: z.string(),
  criteria: z.record(z.string(), z.unknown()),
  totalSaved: z.number(),
  stateToken: z.string(),
  nextStep: z.string(),
});

const CheckSavedSearchOutputSchema = z.object({
  name: z.string(),
  newBidsCount: z.number(),
  bids: z.array(
    z.object({
      projectName: z.string(),
      organizationName: z.string().nullable(),
      prefectureName: z.string().nullable(),
      cftIssueDate: z.string().nullable(),
      tenderSubmissionDeadline: z.string().nullable(),
      key: z.string(),
    }),
  ),
  checkedAt: z.string(),
  previousCheck: z.string().nullable(),
  nextStateToken: z.string(),
  attribution: z.record(z.string(), z.unknown()),
  webhookHint: z.string(),
});

const ListSavedSearchesOutputSchema = z.object({
  totalSaved: z.number(),
  searches: z.array(
    z.object({
      name: z.string(),
      criteria: z.record(z.string(), z.unknown()),
      createdAt: z.string(),
      lastCheckedAt: z.string().nullable(),
    }),
  ),
  stateToken: z.string().nullable(),
});

type SavedSearchEntry = {
  name: string;
  criteria: SearchBidsInput;
  createdAt: string;
  lastCheckedAt: string | null;
};

const SavedSearchSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .describe("保存検索の名前（例: 「鹿児島IT案件」）。Name for this saved search."),
  query: z.string().optional().describe("キーワード。Keyword."),
  prefecture: z
    .union([PrefectureNameSchema, z.array(PrefectureNameSchema)])
    .optional()
    .describe("都道府県名で絞り込む。配列で複数指定可。"),
  category: CategorySchema.optional().describe("入札区分。物品、役務、工事、その他。"),
  organization_name: z.string().optional().describe("発注機関名。Organization name."),
  state_token: z
    .string()
    .optional()
    .describe("既存の保存検索state token。Existing saved-search state token."),
});

const CheckAlertSchema = z.object({
  name: z.string().min(1).describe("確認する保存検索の名前。Name of saved search to check."),
  state_token: z
    .string()
    .optional()
    .describe("save_search が返した保存検索state token。State token returned by save_search."),
});

const ListSavedSchema = z.object({
  state_tokens: z
    .array(z.string())
    .optional()
    .describe("保存検索state tokenの配列。Array of saved-search state tokens."),
});

export function registerSavedSearchAlert(server: McpServer, client: KkjClient): void {
  // 保存検索条件のインメモリストア（MCPサーバーインスタンス単位）
  // In-memory saved search store (per MCP server instance)
  // Penyimpanan pencarian tersimpan di memori (per instance server MCP)
  const savedSearches: Map<string, SavedSearchEntry> = new Map();

  // 検索条件を保存する
  // Save search criteria for later alerts
  // Simpan kriteria pencarian untuk peringatan
  server.registerTool(
    "save_search",
    {
      title: "検索条件を保存",
      description:
        "入札検索条件を名前付きでセッション内に保存する。USE THIS WHEN: stdio や同一インスタンス内で同じ検索条件を後で再確認したいとき。DO NOT USE WHEN: HTTP ステートレス環境で永続保存したいとき（状態はサーバーインスタンス内のみで保持される）。Save named bid search criteria in the current session for recurring alert checks. State is held per-instance and does not persist across HTTP stateless connections. Simpan kriteria pencarian tender bernama dalam sesi ini untuk pemeriksaan peringatan berulang.",
      inputSchema: SavedSearchSchema.shape,
      outputSchema: SaveSearchOutputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      const tokenEntries = decodeSavedSearchToken(args.state_token);
      const criteria: SearchBidsInput = {
        query: args.query,
        prefecture: args.prefecture,
        category: args.category,
        organization_name: args.organization_name,
        limit: 20,
      };
      const savedEntry = {
        name: args.name,
        criteria,
        createdAt: new Date().toISOString(),
        lastCheckedAt: null,
      };
      savedSearches.set(args.name, savedEntry);
      const mergedEntries = upsertSavedSearch(tokenEntries, savedEntry);
      const result = {
        saved: true,
        name: args.name,
        criteria: criteria as Record<string, unknown>,
        totalSaved: mergedEntries.length,
        stateToken: encodeSavedSearchToken(mergedEntries),
        nextStep:
          "check_saved_search に name と state_token を渡すと、HTTPステートレス環境でもこの条件の新着入札を確認できます。Pass name and state_token to check_saved_search to check this criteria in stateless HTTP.",
      };
      return {
        content: [{ type: "text" as const, text: jsonText(result) }],
        structuredContent: result,
      };
    },
  );

  // 保存した検索条件で新着を確認する
  // Check for new bids matching saved criteria
  // Periksa tender baru yang cocok dengan kriteria tersimpan
  server.registerTool(
    "check_saved_search",
    {
      title: "保存検索の新着確認",
      description:
        "保存した検索条件で新着入札を確認する。USE THIS WHEN: save_search で保存済みの条件について、前回チェック以降の新着だけを確認したいとき。DO NOT USE WHEN: 保存条件が無いとき、または HTTP ステートレスで永続アラートが必要なとき。Check for new bids since last check using saved search criteria. Periksa tender baru sejak pemeriksaan terakhir menggunakan kriteria tersimpan.",
      inputSchema: CheckAlertSchema.shape,
      outputSchema: CheckSavedSearchOutputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const tokenEntries = decodeSavedSearchToken(args.state_token);
      const saved =
        tokenEntries.find((entry) => entry.name === args.name) ?? savedSearches.get(args.name);
      if (!saved) {
        return toolError(
          new UserInputError(
            `「${args.name}」という保存検索が見つかりません。save_search で先に条件を保存し、HTTPでは state_token も渡してください。`,
          ),
          "保存検索が見つかりません。",
        );
      }

      try {
        const criteria = { ...saved.criteria };
        if (saved.lastCheckedAt) {
          criteria.issued_after = saved.lastCheckedAt.slice(0, 10);
        }

        const params = buildSearchBidsParams(criteria);
        const result = await client.search(params);

        const now = new Date().toISOString();
        const previousCheck = saved.lastCheckedAt;
        const updatedSaved = { ...saved, lastCheckedAt: now };
        savedSearches.set(args.name, updatedSaved);
        const mergedEntries = upsertSavedSearch(tokenEntries, updatedSaved);
        const returnedBids = result.bids.slice(0, 10);

        const checkResult = {
          name: args.name,
          newBidsCount: returnedBids.length,
          bids: returnedBids.map((bid) => ({
            projectName: bid.projectName,
            organizationName: bid.organizationName,
            prefectureName: bid.prefectureName,
            cftIssueDate: bid.cftIssueDate,
            tenderSubmissionDeadline: bid.tenderSubmissionDeadline,
            key: bid.key,
          })),
          checkedAt: now,
          previousCheck,
          nextStateToken: encodeSavedSearchToken(mergedEntries),
          attribution: result.attribution as Record<string, unknown>,
          webhookHint:
            "この機能を定期実行するには、Webhook通知を設定できます。将来のバージョンでSlack/メール/Webhook通知に対応予定です。",
        };
        return {
          content: [{ type: "text" as const, text: jsonText(checkResult) }],
          structuredContent: checkResult,
        };
      } catch (error) {
        return toolError(error, "保存検索の確認中にエラーが発生しました。");
      }
    },
  );

  // 保存検索の一覧
  // List all saved searches
  // Daftar semua pencarian tersimpan
  server.registerTool(
    "list_saved_searches",
    {
      title: "保存検索の一覧",
      description:
        "保存されている検索条件の一覧を返す。USE THIS WHEN: 現在のサーバーインスタンスに保存された検索名と条件を確認したいとき。DO NOT USE WHEN: 永続DBに保存されたアラート一覧を期待しているとき（このツールはインメモリ）。List all saved search criteria. Daftar semua kriteria pencarian yang tersimpan.",
      inputSchema: ListSavedSchema.shape,
      outputSchema: ListSavedSearchesOutputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const tokenEntries =
        args.state_tokens?.flatMap((token) => decodeSavedSearchToken(token)) ?? [];
      const entries = tokenEntries.length > 0 ? tokenEntries : [...savedSearches.values()];
      const dedupedEntries = dedupeSavedSearches(entries);
      const listResult = {
        totalSaved: dedupedEntries.length,
        searches: dedupedEntries.map((s) => ({
          name: s.name,
          criteria: s.criteria as Record<string, unknown>,
          createdAt: s.createdAt,
          lastCheckedAt: s.lastCheckedAt,
        })),
        stateToken: dedupedEntries.length > 0 ? encodeSavedSearchToken(dedupedEntries) : null,
      };
      return {
        content: [{ type: "text" as const, text: jsonText(listResult) }],
        structuredContent: listResult,
      };
    },
  );
}

function encodeSavedSearchToken(searches: SavedSearchEntry[]): string {
  return signJwt(
    {
      type: "saved_search_state",
      searches: searches.map((entry) => ({
        name: entry.name,
        criteria: entry.criteria,
        createdAt: entry.createdAt,
        lastCheckedAt: entry.lastCheckedAt,
      })),
    },
    resolveStateTokenSecret(),
    30 * 24 * 3600,
  );
}

function decodeSavedSearchToken(token: string | undefined): SavedSearchEntry[] {
  if (!token) return [];
  const payload = verifyJwt(token, resolveStateTokenSecret());
  if (!payload || payload.type !== "saved_search_state" || !Array.isArray(payload.searches)) {
    throw new UserInputError("保存検索state tokenが無効です。save_search を再実行してください。");
  }
  return payload.searches.map((entry) => parseSavedSearchEntry(entry));
}

function parseSavedSearchEntry(value: unknown): SavedSearchEntry {
  const parsed = z
    .object({
      name: z.string().min(1).max(100),
      criteria: z.object({
        query: z.string().optional(),
        prefecture: z.union([PrefectureNameSchema, z.array(PrefectureNameSchema)]).optional(),
        category: CategorySchema.optional(),
        organization_name: z.string().optional(),
        limit: z.number().default(20),
        issued_after: z.string().optional(),
      }),
      createdAt: z.string(),
      lastCheckedAt: z.string().nullable(),
    })
    .parse(value);
  return parsed;
}

function upsertSavedSearch(
  entries: SavedSearchEntry[],
  next: SavedSearchEntry,
): SavedSearchEntry[] {
  return dedupeSavedSearches([next, ...entries]);
}

function dedupeSavedSearches(entries: SavedSearchEntry[]): SavedSearchEntry[] {
  const byName = new Map<string, SavedSearchEntry>();
  for (const entry of entries) {
    byName.set(entry.name, entry);
  }
  return [...byName.values()];
}

function resolveStateTokenSecret(): string {
  const secret = process.env.JP_BIDS_STATE_TOKEN_SECRET ?? process.env.JP_BIDS_OAUTH_SECRET;
  if (secret) return secret;
  if (process.env.K_SERVICE) {
    throw new Error("JP_BIDS_STATE_TOKEN_SECRET is required in production.");
  }
  return "local-dev-saved-search-state-secret";
}
