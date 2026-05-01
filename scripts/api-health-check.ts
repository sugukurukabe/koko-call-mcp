import { readFile } from "node:fs/promises";
import { KkjClient, parseKkjXml } from "../src/api/kkj-client.js";

if (process.env.RUN_LIVE_KKJ_CHECK === "1") {
  const client = new KkjClient({ rateLimitPerSecond: 1 });
  const result = await client.search({ Query: "システム", LG_Code: "46", Count: 1 });
  console.error(`Live KKJ check passed: ${result.returnedCount}/${result.searchHits}`);
} else {
  const xml = await readFile("tests/fixtures/kkj-search.xml", "utf8");
  const result = parseKkjXml(xml, { Query: "システム", Count: 1 });
  if (result.returnedCount !== 1) {
    throw new Error("Fixture health check failed");
  }
  console.error("Fixture KKJ health check passed. Set RUN_LIVE_KKJ_CHECK=1 for upstream check.");
}
