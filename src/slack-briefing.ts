#!/usr/bin/env node
import { KkjClient } from "./api/kkj-client.js";
import {
  createSlackBriefing,
  parseSlackBriefingConfig,
  sendSlackBriefing,
} from "./jobs/slack-briefing.js";

const config = parseSlackBriefingConfig(process.env);
const client = new KkjClient({
  rateLimitPerSecond: Number(process.env.JP_BIDS_RATE_LIMIT_PER_SECOND ?? 1),
});

const briefing = await createSlackBriefing(client, config);
await sendSlackBriefing(briefing, config);

console.error("Slack briefing completed.");
