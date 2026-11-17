// scripts/ci-verify-no-secrets.mjs
// Fail-closed, non-leaking secret scanner for generated CI evidence directories (READINESS-V2-F02).
// Exit codes:
//   0 = targetDir exists, >=1 file scanned, all --require files present & non-empty, 0 secret matches
//   1 = >=1 secret pattern matched (prints ONLY counts, rule IDs, and relative filenames; NEVER values)
//   2 = missing targetDir, missing/empty --require file, 0 files scanned, or read/scan error

import fs from "node:fs";
import path from "node:path";

const SECRET_RULES = [
  { id: "PEM_PRIVATE_KEY", regex: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/ },
  { id: "GOOGLE_API_KEY", regex: /AIza[0-9A-Za-z_-]{35}/ },
  { id: "STRIPE_LIVE_KEY", regex: /sk_live_[0-9A-Za-z]{16,}/ },
  { id: "GITHUB_PAT", regex: /ghp_[0-9A-Za-z]{36}/ },
  { id: "GITHUB_FINE_GRAINED_PAT", regex: /github_pat_[0-9A-Za-z_]{22,}/ },
  { id: "AWS_ACCESS_KEY_ID", regex: /AKIA[0-9A-Z]{16}/ },
];

const args = process.argv.slice(2);
const targetArg = args.find((a) => !a.startsWith("--"));
const requiredRelPaths = args
  .filter((a) => a.startsWith("--require="))
  .map((a) => a.slice("--require=".length))
  .filter(Boolean);

if (!targetArg) {
  process.stderr.write("[ci-verify-no-secrets] ERROR: missing target directory argument\n");
  process.exit(2);
}

const targetDir = path.resolve(targetArg);

let rootStat;
try {
  rootStat = fs.statSync(targetDir);
} catch (err) {
  process.stderr.write(
    `[ci-verify-no-secrets] SCAN_ERROR: cannot access target directory (${err?.code ?? "ERR"})\n`,
  );
  process.exit(2);
}

if (!rootStat.isDirectory()) {
  process.stderr.write("[ci-verify-no-secrets] SCAN_ERROR: target path is not a directory\n");
  process.exit(2);
}

const missingRequired = [];
for (const rel of requiredRelPaths) {
  const full = path.join(targetDir, rel);
  try {
    const st = fs.statSync(full);
    if (!st.isFile() || st.size <= 0) {
      missingRequired.push(rel);
    }
  } catch {
    missingRequired.push(rel);
  }
}

if (missingRequired.length > 0) {
  process.stderr.write(
    `[ci-verify-no-secrets] MISSING_REQUIRED_EVIDENCE: ${missingRequired.join(", ")}\n`,
  );
  process.exit(2);
}

const filesToScan = [];
function walkDir(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    process.stderr.write(
      `[ci-verify-no-secrets] SCAN_ERROR: unreadable directory (${err?.code ?? "ERR"})\n`,
    );
    process.exit(2);
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile()) {
      filesToScan.push(fullPath);
    } else {
      process.stderr.write(
        `[ci-verify-no-secrets] SCAN_ERROR: unsupported entry type at ${path.relative(targetDir, fullPath)}\n`,
      );
      process.exit(2);
    }
  }
}

walkDir(targetDir);

if (filesToScan.length === 0) {
  process.stderr.write("[ci-verify-no-secrets] SCAN_ERROR: 0 files found in target directory\n");
  process.exit(2);
}

const findings = [];
for (const filePath of filesToScan) {
  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    process.stderr.write(
      `[ci-verify-no-secrets] SCAN_ERROR: failed to read ${path.relative(targetDir, filePath)} (${err?.code ?? "ERR"})\n`,
    );
    process.exit(2);
  }
  const relPath = path.relative(targetDir, filePath).replace(/\\/g, "/");
  for (const rule of SECRET_RULES) {
    if (rule.regex.test(content)) {
      findings.push({ file: relPath, rule: rule.id });
    }
  }
}

if (findings.length > 0) {
  process.stderr.write(
    `[ci-verify-no-secrets] SECRET_MATCH_DETECTED: count=${findings.length} files=${findings.map((f) => `${f.file}[${f.rule}]`).join(",")}\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `[ci-verify-no-secrets] PASS: scanned=${filesToScan.length} required=${requiredRelPaths.length} matches=0\n`,
);
