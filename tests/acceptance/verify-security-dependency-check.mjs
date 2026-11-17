import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const parent = fs.realpathSync(os.tmpdir());
const scratch = fs.mkdtempSync(path.join(parent, "jp-bids-security-probes-"));
const stub = path.join(scratch, "npm-stub.cjs");
fs.writeFileSync(
  stub,
  `
const fs = require('node:fs');
if (process.env.NPM_TOKEN || process.env.GITHUB_TOKEN) throw Error('Credential inherited');
const argv = process.argv.slice(2);
if (!argv.includes('--package-lock-only') || !argv.includes('--ignore-scripts') || argv.includes('fix')) throw Error('Unsafe audit command');
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const mode = p.__securityProbeMode;
if (mode === 'invalid-json') { process.stdout.write('not json'); process.exit(0); }
if (mode === 'api-error') { console.log(JSON.stringify({error:{message:'fixture registry failure'}})); process.exit(1); }
if (mode === 'mutation') fs.appendFileSync('package-lock.json', ' ');
const critical = mode === 'critical' ? 1 : 0;
const low = mode === 'low' ? 1 : 0;
console.log(JSON.stringify({auditReportVersion:2,vulnerabilities:{},metadata:{vulnerabilities:{info:0,low,moderate:0,high:0,critical,total:critical+low}}}));
process.exit(critical || low ? 1 : 0);
`,
);
const originalRoot = fs.readFileSync(path.join(root, "package.json"));
// Run the real checker in a minimal copied repository so source manifests stay untouched.
const fixture = path.join(scratch, "repo");
fs.mkdirSync(path.join(fixture, "scripts"), { recursive: true });
fs.mkdirSync(path.join(fixture, "gateway"));
fs.copyFileSync(
  path.join(root, "scripts/security-dependency-check.mjs"),
  path.join(fixture, "scripts/security-dependency-check.mjs"),
);
const results = [];
try {
  for (const [mode, expected] of [
    ["clean", 0],
    ["low", 0],
    ["critical", 1],
    ["api-error", 1],
    ["invalid-json", 1],
    ["mutation", 1],
  ]) {
    for (const scope of [fixture, path.join(fixture, "gateway")]) {
      fs.writeFileSync(
        path.join(scope, "package.json"),
        JSON.stringify({ name: "security-probe", version: "1.0.0", __securityProbeMode: mode }),
      );
      fs.writeFileSync(
        path.join(scope, "package-lock.json"),
        JSON.stringify({
          name: "security-probe",
          version: "1.0.0",
          lockfileVersion: 3,
          packages: { "": { name: "security-probe", version: "1.0.0" } },
        }),
      );
    }
    const output = path.join(scratch, `${mode}.json`);
    const run = spawnSync(
      process.execPath,
      [path.join(fixture, "scripts/security-dependency-check.mjs"), "--output", output],
      {
        cwd: fixture,
        env: {
          ...process.env,
          npm_execpath: stub,
          NPM_TOKEN: "must-not-be-inherited",
          GITHUB_TOKEN: "must-not-be-inherited",
        },
        encoding: "utf8",
        timeout: 15000,
      },
    );
    assert.equal(run.status, expected, `${mode}: ${run.stderr}`);
    const report = JSON.parse(fs.readFileSync(output, "utf8"));
    assert.equal(report.allPassed, expected === 0);
    results.push({ mode, expected, actual: run.status, allPassed: report.allPassed });
  }
  assert.deepEqual(fs.readFileSync(path.join(root, "package.json")), originalRoot);
} finally {
  const resolved = fs.realpathSync(scratch);
  assert.equal(path.dirname(resolved), parent);
  assert.ok(path.basename(resolved).startsWith("jp-bids-security-probes-"));
  fs.rmSync(resolved, { recursive: true, force: true });
}
const output = path.join(root, "evidence/security/dependency-probes.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify({ allPassed: true, results }, null, 2)}\n`);
console.log(JSON.stringify({ allPassed: true, cases: results.length, liveRegistryCalls: 0 }));
