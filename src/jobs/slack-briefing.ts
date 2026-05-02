import type { KkjClient, KkjSearchParams } from "../api/kkj-client.js";
import type { Bid, BidSearchResult } from "../domain/bid.js";
import { type Category, CategorySchema, categoryCodes } from "../domain/codes.js";
import { daysAgoDate, formatKkjDateRange, todayDate } from "../domain/date-range.js";
import { type PrefectureName, PrefectureNameSchema, toLgCode } from "../domain/prefectures.js";
import { postSlackMessage, type SlackMessageBlock } from "../lib/slack.js";

export interface SlackBriefingConfig {
  slackBotToken?: string;
  slackChannelId?: string;
  prefectures: PrefectureName[];
  category?: Category;
  queryTerms: string[];
  days: number;
  limit: number;
  dryRun: boolean;
}

export interface SlackBriefing {
  text: string;
  blocks: SlackMessageBlock[];
  result: BidSearchResult;
}

export function parseSlackBriefingConfig(env: NodeJS.ProcessEnv): SlackBriefingConfig {
  const dryRun = parseBoolean(env.JP_BIDS_SLACK_DRY_RUN);
  const prefectures = parsePrefectures(env.JP_BIDS_BRIEFING_PREFECTURES ?? "鹿児島県");
  const categoryValue = env.JP_BIDS_BRIEFING_CATEGORY;
  const category = categoryValue ? CategorySchema.parse(categoryValue) : undefined;

  return {
    ...(env.SLACK_BOT_TOKEN ? { slackBotToken: env.SLACK_BOT_TOKEN } : {}),
    ...(env.SLACK_CHANNEL_ID ? { slackChannelId: env.SLACK_CHANNEL_ID } : {}),
    prefectures,
    ...(category ? { category } : {}),
    queryTerms: parseCsv(env.JP_BIDS_BRIEFING_QUERIES ?? "システム,保守,クラウド,AI"),
    days: parsePositiveInt(env.JP_BIDS_BRIEFING_DAYS, 7, 1, 30),
    limit: parsePositiveInt(env.JP_BIDS_BRIEFING_LIMIT, 10, 1, 50),
    dryRun,
  };
}

export async function createSlackBriefing(
  client: KkjClient,
  config: SlackBriefingConfig,
  now = new Date(),
): Promise<SlackBriefing> {
  const since = daysAgoDate(config.days, now);
  const until = todayDate(now);
  const issueRange = formatKkjDateRange(since, until);
  const params: KkjSearchParams = {
    LG_Code: toLgCode(config.prefectures),
    Count: Math.min(config.limit * 3, 1000),
    ...(issueRange ? { CFT_Issue_Date: issueRange } : {}),
  };

  if (config.category) {
    params.Category = categoryCodes[config.category];
  }
  if (config.queryTerms.length > 0) {
    params.Query = config.queryTerms.join(" OR ");
  }

  const result = await client.search(params);
  const bids = dedupeBids(result.bids).slice(0, config.limit);
  const text = createPlainTextSummary(bids, result, config, since, until);
  const blocks = createSlackBlocks(bids, result, config, since, until);

  return {
    text,
    blocks,
    result: {
      ...result,
      bids,
      returnedCount: bids.length,
    },
  };
}

export async function sendSlackBriefing(briefing: SlackBriefing, config: SlackBriefingConfig) {
  if (config.dryRun) {
    console.error(briefing.text);
    return;
  }

  if (!config.slackBotToken || !config.slackChannelId) {
    throw new Error("SLACK_BOT_TOKEN and SLACK_CHANNEL_ID are required unless dry-run is enabled.");
  }

  await postSlackMessage({
    token: config.slackBotToken,
    channel: config.slackChannelId,
    text: briefing.text,
    blocks: briefing.blocks,
  });
}

function createPlainTextSummary(
  bids: Bid[],
  result: BidSearchResult,
  config: SlackBriefingConfig,
  since: string,
  until: string,
): string {
  const target = [
    config.prefectures.join(", "),
    config.category ?? "全カテゴリ",
    config.queryTerms.join(" / "),
  ].join(" | ");
  return `JP Bids MCP: ${since} - ${until} の新着候補 ${bids.length}件 / ${result.searchHits}件 (${target})`;
}

function createSlackBlocks(
  bids: Bid[],
  result: BidSearchResult,
  config: SlackBriefingConfig,
  since: string,
  until: string,
): SlackMessageBlock[] {
  const lines =
    bids.length === 0
      ? ["該当する新着候補はありません。"]
      : bids.map((bid, index) =>
          [
            `*${index + 1}. ${escapeSlack(bid.projectName)}*`,
            `機関: ${escapeSlack(bid.organizationName ?? "不明")} / 地域: ${escapeSlack(bid.prefectureName ?? "不明")}`,
            `公告: ${bid.cftIssueDate ?? "不明"} / 入札開始: ${bid.tenderSubmissionDeadline ?? "不明"} / 開札: ${bid.openingTendersEvent ?? "不明"}`,
            `Key: \`${escapeSlack(bid.key)}\``,
          ].join("\n"),
        );

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*JP Bids MCP Daily Briefing*`,
          `${since} - ${until}`,
          `地域: ${escapeSlack(config.prefectures.join(", "))}`,
          `カテゴリ: ${escapeSlack(config.category ?? "全カテゴリ")}`,
          `検索語: ${escapeSlack(config.queryTerms.join(" / ") || "未指定")}`,
          `取得: ${bids.length}件 / ヒット: ${result.searchHits}件`,
        ].join("\n"),
      },
    },
    ...lines.map((line) => ({
      type: "section",
      text: {
        type: "mrkdwn" as const,
        text: line,
      },
    })),
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `出典: ${escapeSlack(result.attribution.dataSource)}\n公式資料を確認してから入札判断をしてください。`,
      },
    },
  ];
}

function dedupeBids(bids: Bid[]): Bid[] {
  const seen = new Set<string>();
  return bids.filter((bid) => {
    if (seen.has(bid.key)) {
      return false;
    }
    seen.add(bid.key);
    return true;
  });
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parsePrefectures(value: string): PrefectureName[] {
  return parseCsv(value).map((item) => PrefectureNameSchema.parse(item));
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Expected integer between ${min} and ${max}, got ${value}`);
  }
  return parsed;
}

function parseBoolean(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function escapeSlack(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
