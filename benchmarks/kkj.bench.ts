import { readFile } from "node:fs/promises";
import { Bench } from "tinybench";
import { parseKkjXml } from "../src/api/kkj-client.js";
import { toLgCode } from "../src/domain/prefectures.js";

const xml = await readFile("tests/fixtures/kkj-search.xml", "utf8");
const bench = new Bench({ time: 500 });

bench
  .add("parse single-result KKJ XML", () => {
    parseKkjXml(xml, { Query: "システム", Count: 1 });
  })
  .add("convert prefecture names", () => {
    toLgCode(["東京都", "大阪府", "鹿児島県"]);
  });

await bench.run();

for (const task of bench.tasks) {
  const result = task.result;
  if (result.state !== "completed") {
    console.error(`${task.name}: ${result.state}`);
    continue;
  }
  const hz = result.throughput.mean.toFixed(2);
  const meanMs = result.latency.mean.toFixed(4);
  const p99Ms = result.latency.p99.toFixed(4);
  console.error(`${task.name}: ${hz} ops/sec, mean ${meanMs} ms, p99 ${p99Ms} ms`);
}
