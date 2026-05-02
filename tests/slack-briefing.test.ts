import { describe, expect, it } from "vitest";
import type { KkjClient } from "../src/api/kkj-client.js";
import { createAttribution } from "../src/domain/attribution.js";
import { createSlackBriefing, parseSlackBriefingConfig } from "../src/jobs/slack-briefing.js";
import { postSlackMessage } from "../src/lib/slack.js";

describe("Slack briefing", () => {
  it("parses briefing config from environment", () => {
    const config = parseSlackBriefingConfig({
      JP_BIDS_SLACK_DRY_RUN: "1",
      JP_BIDS_BRIEFING_PREFECTURES: "鹿児島県,宮崎県",
      JP_BIDS_BRIEFING_CATEGORY: "役務",
      JP_BIDS_BRIEFING_QUERIES: "システム,保守",
      JP_BIDS_BRIEFING_DAYS: "3",
      JP_BIDS_BRIEFING_LIMIT: "5",
    });

    expect(config).toMatchObject({
      dryRun: true,
      prefectures: ["鹿児島県", "宮崎県"],
      category: "役務",
      queryTerms: ["システム", "保守"],
      days: 3,
      limit: 5,
    });
  });

  it("creates a Slack briefing without leaking more than the configured limit", async () => {
    const client = {
      search: async () => ({
        searchHits: 2,
        returnedCount: 2,
        query: { Query: "システム", Count: 2 },
        attribution: createAttribution(),
        bids: [
          {
            resultId: 1,
            key: "A",
            projectName: "システム保守",
            organizationName: "鹿児島市",
            prefectureName: "鹿児島県",
            category: "役務",
          },
          {
            resultId: 2,
            key: "B",
            projectName: "クラウド基盤",
            organizationName: "宮崎県",
            prefectureName: "宮崎県",
            category: "役務",
          },
        ],
      }),
    } as Pick<KkjClient, "search"> as KkjClient;

    const briefing = await createSlackBriefing(
      client,
      {
        prefectures: ["鹿児島県"],
        category: "役務",
        queryTerms: ["システム"],
        days: 7,
        limit: 1,
        dryRun: true,
      },
      new Date("2026-05-02T00:00:00Z"),
    );

    expect(briefing.result.returnedCount).toBe(1);
    expect(briefing.text).toContain("新着候補 1件 / 2件");
    expect(JSON.stringify(briefing.blocks)).toContain("システム保守");
    expect(JSON.stringify(briefing.blocks)).not.toContain("クラウド基盤");
  });

  it("throws when Slack API returns an error", async () => {
    await expect(
      postSlackMessage({
        token: "xoxb-test",
        channel: "C123",
        text: "hello",
        fetchImpl: async () =>
          new Response(JSON.stringify({ ok: false, error: "channel_not_found" }), {
            status: 200,
          }),
      }),
    ).rejects.toThrow("channel_not_found");
  });
});
