// tests/acceptance/verify-ci-secret-check.mjs
// Verification suite for the exact CI secret-check step in .github/workflows/ci.yml (READINESS-V2-F02).
// Runs in isolated temp directories (never writes synthetic secret fixtures into the repo or readiness dir)
// and verifies:
//   S01: benign evidence with required files -> exit 0
//   S02: synthetic secret -> exit 1 AND synthetic string NEVER appears in stdout/stderr
//   S03: missing evidence/ dir -> exit 2
//   S04: unreadable/scan EACCES error -> exit 2
//   S05: missing required fresh evidence file -> exit 2

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extractSecretCheckCommand } from "./ci-secret-command.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const CI_YML_PATH = path.join(REPO_ROOT, ".github", "workflows", "ci.yml");
const SCANNER_SRC = path.join(REPO_ROOT, "scripts", "ci-verify-no-secrets.mjs");
const OUT_FILE = path.join(REPO_ROOT, "evidence", "f02-ci-secret-check-after.json");

const ciYml = fs.readFileSync(CI_YML_PATH, "utf8");
const extractedCommand = extractSecretCheckCommand(ciYml);
const ciDefinitionSha256 = createHash("sha256").update(ciYml).digest("hex");
const cmdParts = extractedCommand.split(/\s+/).slice(1);
const scannerArgs = cmdParts.slice(1);

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "jp-bids-f02-ci-check-"));
const bashSafeJoin = (p) => p;

function setupRepoShell(caseName, { createEvidence = true, requiredFiles = true } = {}) {
  const caseDir = path.join(tmpRoot, caseName);
  fs.mkdirSync(path.join(caseDir, "scripts"), { recursive: true });
  fs.copyFileSync(SCANNER_SRC, path.join(caseDir, "scripts", "ci-verify-no-secrets.mjs"));
  if (createEvidence) {
    fs.mkdirSync(path.join(caseDir, "evidence", "gate1"), { recursive: true });
    if (requiredFiles) {
      fs.writeFileSync(
        path.join(caseDir, "evidence", "gate1", "gate1-summary.json"),
        '{"ok":true}\n',
        "utf8",
      );
      fs.writeFileSync(
        path.join(caseDir, "evidence", "f01-child-cleanup-probes-after.json"),
        '{"allPassed":true}\n',
        "utf8",
      );
      fs.writeFileSync(
        path.join(caseDir, "evidence", "cloudshell-offline-sim-results.json"),
        '{"ok":true}\n',
        "utf8",
      );
    }
  }
  return caseDir;
}

function runCiScanner(cwd, extraEnv = {}) {
  return spawnSync(
    process.execPath,
    [bashSafeJoin("scripts/ci-verify-no-secrets.mjs"), ...scannerArgs],
    {
      cwd,
      encoding: "utf8",
      env: { ...process.env, ...extraEnv },
    },
  );
}

const results = [];

try {
  // S01: Benign evidence with all required files -> exit 0
  const s01Dir = setupRepoShell("s01");
  const s01Res = runCiScanner(s01Dir);
  assert.equal(s01Res.status, 0, `S01 expected exit 0, got ${s01Res.status}: ${s01Res.stderr}`);
  results.push({
    id: "S01_benign_evidence",
    expectedExit: 0,
    actualExit: s01Res.status,
    passed: true,
  });

  // S02: Synthetic secret -> exit 1, zero secret value leakage in stdout/stderr
  const s02Dir = setupRepoShell("s02");
  const synthSecret = `ghp_${"A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"}`;
  fs.writeFileSync(
    path.join(s02Dir, "evidence", "synthetic-fixture.txt"),
    `TOKEN=${synthSecret}\n`,
    "utf8",
  );
  const s02Res = runCiScanner(s02Dir);
  const combinedOut = `${s02Res.stdout ?? ""}\n${s02Res.stderr ?? ""}`;
  const leaked = combinedOut.includes(synthSecret);
  assert.equal(s02Res.status, 1, `S02 expected exit 1, got ${s02Res.status}`);
  assert.equal(leaked, false, "S02 must NEVER print matched secret value to stdout/stderr");
  results.push({
    id: "S02_synthetic_secret_no_leak",
    expectedExit: 1,
    actualExit: s02Res.status,
    leakedValueToOutput: leaked,
    passed: true,
  });

  // S03: Missing evidence directory -> exit 2 (fail-closed)
  const s03Dir = setupRepoShell("s03", { createEvidence: false });
  const s03Res = runCiScanner(s03Dir);
  assert.equal(s03Res.status, 2, `S03 expected exit 2, got ${s03Res.status}`);
  results.push({
    id: "S03_missing_evidence_dir",
    expectedExit: 2,
    actualExit: s03Res.status,
    passed: true,
  });

  // S04: Unreadable / scan EACCES error -> exit 2 (fail-closed)
  const s04Dir = setupRepoShell("s04");
  const eaccesHookPath = path.join(tmpRoot, "eacces-hook.mjs");
  fs.writeFileSync(
    eaccesHookPath,
    `import fs from "node:fs";
const origRead = fs.readFileSync;
fs.readFileSync = function (p, ...rest) {
  if (String(p).includes("cloudshell-offline-sim-results.json")) {
    const err = new Error("EACCES: simulated read error");
    err.code = "EACCES";
    throw err;
  }
  return origRead.call(this, p, ...rest);
};
`,
    "utf8",
  );
  const s04Res = runCiScanner(s04Dir, {
    NODE_OPTIONS: `--import ${pathToFileURL(eaccesHookPath).href}`,
  });
  assert.equal(s04Res.status, 2, `S04 expected exit 2, got ${s04Res.status}`);
  results.push({
    id: "S04_scan_eacces_error",
    expectedExit: 2,
    actualExit: s04Res.status,
    passed: true,
  });

  // S05: Missing required fresh evidence file -> exit 2 (fail-closed)
  const s05Dir = setupRepoShell("s05", { createEvidence: true, requiredFiles: false });
  fs.writeFileSync(
    path.join(s05Dir, "evidence", "gate1", "gate1-summary.json"),
    '{"ok":true}\n',
    "utf8",
  );
  const s05Res = runCiScanner(s05Dir);
  assert.equal(s05Res.status, 2, `S05 expected exit 2, got ${s05Res.status}`);
  results.push({
    id: "S05_missing_required_fresh_file",
    expectedExit: 2,
    actualExit: s05Res.status,
    passed: true,
  });

  const report = {
    schemaVersion: "jp-bids-ci-secret-check-probes-v1",
    generatedAt: new Date().toISOString(),
    findingId: "READINESS-V2-F02",
    ciCommandVerified: extractedCommand,
    ciDefinitionSha256,
    unmaskedSyntheticSecretsStored: 0,
    allPassed: results.every((r) => r.passed),
    results,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stderr.write(
    `[verify-ci-secret-check] PASS ${results.length}/${results.length} checks -> ${OUT_FILE}\n`,
  );
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
