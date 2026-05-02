import { completable } from "@modelcontextprotocol/sdk/server/completable.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CategorySchema } from "../domain/codes.js";
import { PrefectureNameSchema, prefectureEntries } from "../domain/prefectures.js";

const prefectureCompletable = completable(PrefectureNameSchema, (value) =>
  prefectureEntries
    .map((entry) => entry.name)
    .filter((name) => name.includes(String(value)))
    .slice(0, 20),
);

const categoryCompletable = completable(CategorySchema, (value) =>
  (["物品", "工事", "役務"] as const).filter((category) => category.includes(String(value))),
);

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "morning_bid_briefing",
    {
      title: "朝の入札ブリーフィング",
      description: "指定地域・カテゴリの直近入札を営業朝会向けに要約する。",
      argsSchema: {
        prefecture: prefectureCompletable.optional(),
        category: categoryCompletable.optional(),
        days: z.number().int().min(1).max(30).optional().describe("確認する日数。未指定なら7日。"),
      },
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `list_recent_bids を使って、${args.prefecture ?? "全国"} の ${args.category ?? "全カテゴリ"} について、直近 ${args.days ?? "7"} 日の官公需入札を営業向けに要約してください。締切が近い案件、自治体提案につながる案件、確認すべき添付資料を分けてください。`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "competitor_radar",
    {
      title: "競合・発注機関レーダー",
      description: "発注機関名を軸に過去案件の傾向を整理する。",
      argsSchema: {
        organization_name: z.string().min(1),
        since: z.string().optional().describe("YYYY-MM-DD。未指定なら過去1年。"),
      },
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `summarize_bids_by_org を使って ${args.organization_name} の ${args.since ?? "過去1年"} 以降の発注傾向を分析してください。カテゴリ別、入札方式別、直近案件、営業仮説を分けてください。`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "bid_due_alert",
    {
      title: "締切間近の入札確認",
      description: "来週までに入札開始・締切が近い案件を洗い出す。",
      argsSchema: {
        prefecture: prefectureCompletable.optional(),
        category: categoryCompletable.optional(),
        query: z.string().optional(),
      },
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `search_bids を使って、${args.prefecture ?? "全国"} の ${args.category ?? "全カテゴリ"} から、${args.query ?? "自社に関係しそうな"} 締切間近の官公需入札を確認してください。案件名、機関、締切、必要資格、次アクションを表で整理してください。`,
          },
        },
      ],
    }),
  );
}
