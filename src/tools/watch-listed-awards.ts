import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { JquantsClient } from "../api/jquants-client.js";
import type { KkjClient } from "../api/kkj-client.js";
import { createAttribution } from "../domain/attribution.js";
import { WatchListedAwardsSchema } from "../domain/investor.js";
import { INVESTMENT_DISCLAIMER } from "../domain/listed-company.js";
import { UserInputError } from "../lib/errors.js";
import { jsonText, toolError } from "../lib/tool-result.js";
import { signJwt, verifyJwt } from "../oauth/jwt.js";
import { loadCatalog, resolveListedQuery } from "./map-awards-to-listed.js";

const WatchEntrySchema = z.object({
  name: z.string().min(1).max(100),
  query: z.string().min(1),
  code: z.string().optional(),
  createdAt: z.string(),
  lastCheckedAt: z.string().nullable(),
  seenKeys: z.array(z.string()).default([]),
});

type WatchEntry = z.infer<typeof WatchEntrySchema>;

const inputSchema = {
  action: z.enum(["save", "check", "list"]).describe("save=追加, check=差分確認, list=一覧。"),
  name: z.string().min(1).max(100).optional().describe("ウォッチ名。save / check で必須。"),
  query: z.string().min(1).optional().describe("企業名または銘柄コード。save で必須。"),
  state_token: z.string().optional().describe("前回の state_token。HTTPステートレス接続で必須。"),
};

export function registerWatchListedAwards(
  server: McpServer,
  client: KkjClient,
  jquants: JquantsClient,
): void {
  const memory = new Map<string, WatchEntry>();

  server.registerTool(
    "watch_listed_awards",
    {
      title: "上場企業の公告ウォッチ",
      description:
        "銘柄・企業名のウォッチリストを state_token で差分確認する。USE THIS WHEN: 特定銘柄に関する新しいKKJ公告を追いたいとき。DO NOT USE WHEN: 売買アラートが欲しいとき。This is not investment advice. Pantau pengumuman KKJ untuk ticker. Bukan nasihat investasi.",
      inputSchema,
      outputSchema: WatchListedAwardsSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const tokenEntries = decodeWatchToken(args.state_token);
        const entries = mergeEntries(tokenEntries, [...memory.values()]);
        if (args.action === "save") {
          if (!args.name || !args.query) {
            throw new UserInputError("watch_listed_awards の save には name と query が必要です。");
          }
          const catalog = await loadCatalog(jquants);
          const resolved = resolveListedQuery(args.query, catalog);
          const saved: WatchEntry = {
            name: args.name,
            query: args.query,
            ...(resolved ? { code: resolved.company.code } : {}),
            createdAt: new Date().toISOString(),
            lastCheckedAt: null,
            seenKeys: [],
          };
          memory.set(args.name, saved);
          const watchlist = upsert(entries, saved);
          const result = {
            action: "save" as const,
            watchlist: publicWatchlist(watchlist),
            stateToken: encodeWatchToken(watchlist),
            nextStep: "check に name と state_token を渡すと新着公告を差分確認できます。",
            investmentDisclaimer: INVESTMENT_DISCLAIMER,
            attribution: createAttribution(),
          };
          return {
            content: [{ type: "text" as const, text: jsonText(result) }],
            structuredContent: result,
          };
        }
        if (args.action === "list") {
          const result = {
            action: "list" as const,
            watchlist: publicWatchlist(entries),
            stateToken: entries.length > 0 ? encodeWatchToken(entries) : encodeWatchToken([]),
            nextStep: "save で銘柄を追加し、check で新着を確認してください。",
            investmentDisclaimer: INVESTMENT_DISCLAIMER,
            attribution: createAttribution(),
          };
          return {
            content: [{ type: "text" as const, text: jsonText(result) }],
            structuredContent: result,
          };
        }
        if (!args.name) {
          throw new UserInputError("watch_listed_awards の check には name が必要です。");
        }
        const target = entries.find((entry) => entry.name === args.name);
        if (!target) {
          throw new UserInputError(
            `ウォッチ「${args.name}」がありません。save を先に実行するか state_token を渡してください。`,
          );
        }
        const searchQuery = target.query;
        const searchResult = await client.search({ Query: searchQuery, Count: 50 });
        const newBids = searchResult.bids.filter((bid) => !target.seenKeys.includes(bid.key));
        const updated: WatchEntry = {
          ...target,
          lastCheckedAt: new Date().toISOString(),
          seenKeys: [...new Set([...target.seenKeys, ...searchResult.bids.map((bid) => bid.key)])],
        };
        memory.set(updated.name, updated);
        const watchlist = upsert(entries, updated);
        const result = {
          action: "check" as const,
          watchlist: publicWatchlist(watchlist),
          newNoticesCount: newBids.length,
          newNotices: newBids.map((bid) => ({
            key: bid.key,
            projectName: bid.projectName,
            query: searchQuery,
            cftIssueDate: bid.cftIssueDate ?? null,
          })),
          stateToken: encodeWatchToken(watchlist),
          nextStep: "新着があれば公式公告を確認してください。本情報は投資助言ではありません。",
          investmentDisclaimer: INVESTMENT_DISCLAIMER,
          attribution: searchResult.attribution,
        };
        return {
          content: [{ type: "text" as const, text: jsonText(result) }],
          structuredContent: result,
        };
      } catch (error) {
        return toolError(
          error,
          "ウォッチリスト処理で一時的なエラーが発生しました。state_token を確認して再実行してください。",
        );
      }
    },
  );
}

function publicWatchlist(entries: WatchEntry[]) {
  return entries.map((entry) => ({
    name: entry.name,
    query: entry.query,
    ...(entry.code ? { code: entry.code } : {}),
    createdAt: entry.createdAt,
    lastCheckedAt: entry.lastCheckedAt,
  }));
}

function upsert(entries: WatchEntry[], next: WatchEntry): WatchEntry[] {
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  byName.set(next.name, next);
  return [...byName.values()];
}

function mergeEntries(token: WatchEntry[], memory: WatchEntry[]): WatchEntry[] {
  const byName = new Map<string, WatchEntry>();
  for (const entry of [...token, ...memory]) {
    byName.set(entry.name, entry);
  }
  return [...byName.values()];
}

function encodeWatchToken(entries: WatchEntry[]): string {
  return signJwt(
    {
      type: "listed_award_watch",
      watches: entries,
    },
    resolveStateTokenSecret(),
    30 * 24 * 3600,
  );
}

function decodeWatchToken(token: string | undefined): WatchEntry[] {
  if (!token) {
    return [];
  }
  const payload = verifyJwt(token, resolveStateTokenSecret());
  if (!payload || payload.type !== "listed_award_watch" || !Array.isArray(payload.watches)) {
    throw new UserInputError("ウォッチ state tokenが無効です。save を再実行してください。");
  }
  return payload.watches.map((entry) => WatchEntrySchema.parse(entry));
}

function resolveStateTokenSecret(): string {
  const secret = process.env.JP_BIDS_STATE_TOKEN_SECRET ?? process.env.JP_BIDS_OAUTH_SECRET;
  if (secret) {
    return secret;
  }
  if (process.env.K_SERVICE) {
    throw new Error("JP_BIDS_STATE_TOKEN_SECRET is required in production.");
  }
  return "local-dev-listed-award-watch-secret";
}
