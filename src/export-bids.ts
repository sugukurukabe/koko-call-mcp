#!/usr/bin/env node
import { KkjClient } from "./api/kkj-client.js";
import { exportBids, parseExportBidsConfig } from "./jobs/export-bids.js";
import { parsePositiveNumberEnv } from "./lib/env.js";

const config = parseExportBidsConfig(process.argv.slice(2), process.env);
const client = new KkjClient({
  rateLimitPerSecond: parsePositiveNumberEnv(process.env.JP_BIDS_RATE_LIMIT_PER_SECOND, 1),
});

const { output } = await exportBids(client, config);
process.stdout.write(`${output}\n`);
