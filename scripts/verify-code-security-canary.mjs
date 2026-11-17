import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSemgrepEnvironment } from "./semgrep-engine-env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const core = process.env.SEMGREP_CORE_PATH;
assert.ok(core && fs.existsSync(core), "SEMGREP_CORE_PATH is required");
const fixture = "security/semgrep/ssrf-canary.ts";
const lines = fs.readFileSync(path.join(root, fixture), "utf8").split("\n");
const expected = lines.flatMap((line, index) =>
  line.includes("// MUST-DETECT:") ? [index + 2] : [],
);
const forbidden = lines.flatMap((line, index) =>
  line.includes("// MUST-NOT-DETECT:") ? [index + 2] : [],
);
const engineEnvironment = createSemgrepEnvironment();
let run;
try {
  run = spawnSync(
    core,
    [
      "-rules",
      path.join(root, "security/semgrep/rules.yaml"),
      "-lang",
      "typescript",
      "-j",
      "1",
      "-json_nodots",
      fixture,
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 60000,
      maxBuffer: 8 * 1024 * 1024,
      env: engineEnvironment.env,
    },
  );
} finally {
  engineEnvironment.dispose();
}
assert.equal(run.status, 0, run.stderr);
const report = JSON.parse(run.stdout);
assert.deepEqual(report.errors, []);
const detected = report.results
  .filter((r) => r.check_id.endsWith(".mcp-ssrf-typescript"))
  .map((r) => r.start.line)
  .sort((a, b) => a - b);
assert.deepEqual(detected, expected);
assert.ok(forbidden.every((line) => !detected.includes(line)));
const output = path.join(root, "evidence/security/code-canary.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(
  output,
  `${JSON.stringify({ allPassed: true, expectedDetected: expected, actualDetected: detected, negativeLines: forbidden }, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    allPassed: true,
    positiveCases: expected.length,
    negativeCases: forbidden.length,
  }),
);
