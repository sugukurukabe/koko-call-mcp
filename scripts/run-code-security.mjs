import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateSecurityScan } from "./code-security-review.mjs";
import { createSemgrepEnvironment } from "./semgrep-engine-env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputArg = process.argv.indexOf("--output");
const output = path.resolve(
  root,
  outputArg < 0 ? "evidence/security/code-security.json" : process.argv[outputArg + 1],
);
const core = process.env.SEMGREP_CORE_PATH;
if (!core || !fs.existsSync(core)) {
  throw new Error(
    "Set SEMGREP_CORE_PATH to the engine installed from security/semgrep/requirements.txt",
  );
}
const engineEnvironment = createSemgrepEnvironment();
const { env } = engineEnvironment;
try {
  const version = spawnSync(core, ["-version"], { encoding: "utf8", env, timeout: 10000 });
  if (version.status !== 0 || !/\b1\.185\.0\b/.test(version.stdout)) {
    throw new Error(`Expected Semgrep CE engine 1.185.0: ${version.stderr || version.stdout}`);
  }
  const config = path.join(root, "security/semgrep/rules.yaml");
  const bundle = JSON.parse(
    fs.readFileSync(path.join(root, "security/semgrep/bundle-manifest.json"), "utf8"),
  );
  const configHash = createHash("sha256").update(fs.readFileSync(config)).digest("hex");
  if (configHash !== bundle.sha256) throw new Error("Security rule bundle hash mismatch");
  const ruleIds = new Set(
    [...fs.readFileSync(config, "utf8").matchAll(/^- id:[ \t]*(?:\r?\n[ \t]+)?(\S+)[ \t]*$/gm)].map(
      (m) => m[1],
    ),
  );
  if (ruleIds.size !== bundle.rules) throw new Error("Cannot account for every bundled rule");
  const reviewPath = path.join(root, "security/semgrep/reviewed-nonissues.json");
  const reviewBytes = fs.readFileSync(reviewPath);
  const reviewHash = createHash("sha256").update(reviewBytes).digest("hex");
  const reviewDocument = JSON.parse(reviewBytes.toString("utf8"));
  const groups = { typescript: [], javascript: [] };
  function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Unexpected source link: ${absolute}`);
      if (entry.isDirectory()) collect(absolute);
      else if (/\.(?:ts|tsx|mts|cts)$/.test(entry.name))
        groups.typescript.push(path.relative(root, absolute));
      else if (/\.(?:js|jsx|mjs|cjs)$/.test(entry.name))
        groups.javascript.push(path.relative(root, absolute));
    }
  }
  for (const directory of ["src", "ui", "gateway/src", "scripts"])
    collect(path.join(root, directory));
  const expectedTargets = Object.values(groups)
    .flat()
    .map((p) => p.replaceAll("\\", "/"))
    .sort();
  const sourceSnapshots = Object.fromEntries(
    expectedTargets.map((p) => {
      const bytes = fs.readFileSync(path.join(root, p));
      return [
        p,
        {
          sha256: createHash("sha256").update(bytes).digest("hex"),
          lines: bytes.toString("utf8").split("\n").length,
        },
      ];
    }),
  );
  const findings = [];
  const errors = [];
  const scanned = new Set();
  for (const [language, files] of Object.entries(groups)) {
    files.sort();
    for (let offset = 0; offset < files.length; offset++) {
      // The engine's direct interface accepts one explicit target with -lang.
      // Avoid the Windows RPC transport and keep every target/accounting explicit.
      const batch = files.slice(offset, offset + 1);
      const result = spawnSync(
        core,
        ["-rules", config, "-lang", language, "-j", "1", "-json_nodots", ...batch],
        {
          cwd: root,
          encoding: "utf8",
          env,
          timeout: 120000,
          maxBuffer: 32 * 1024 * 1024,
        },
      );
      if (result.status !== 0 || result.error) {
        errors.push({
          language,
          message: result.error?.message || result.stderr || `Engine exit ${result.status}`,
        });
        continue;
      }
      try {
        const report = JSON.parse(result.stdout);
        findings.push(...(report.results || []));
        errors.push(...(report.errors || []));
        for (const file of report.paths?.scanned || []) scanned.add(file.replaceAll("\\", "/"));
      } catch (error) {
        errors.push({ language, message: error.message });
      }
    }
  }
  for (const [p, snapshot] of Object.entries(sourceSnapshots)) {
    if (
      createHash("sha256")
        .update(fs.readFileSync(path.join(root, p)))
        .digest("hex") !== snapshot.sha256
    )
      errors.push({ message: "Source input changed during scan", path: p });
  }
  for (const [p, expected] of [
    [config, configHash],
    [reviewPath, reviewHash],
  ]) {
    if (createHash("sha256").update(fs.readFileSync(p)).digest("hex") !== expected)
      errors.push({ message: "Security configuration changed during scan" });
  }
  const evaluated = evaluateSecurityScan({
    findings,
    reviewDocument,
    sourceSnapshots,
    ruleIds,
    ruleBundleSha256: configHash,
    scannedTargets: [...scanned],
    engineErrors: errors,
  });
  const { reviewedNonissues, blockingFindings, unreportedReviews, missingTargets } = evaluated;
  const report = {
    version: 1,
    engine: version.stdout.trim(),
    platform: process.platform,
    ruleCount: bundle.rules,
    ruleBundleSha256: configHash,
    reviewDocumentSha256: reviewHash,
    sourceScope: ["src", "ui", "gateway/src", "scripts"],
    expectedTargets,
    sourceSnapshots,
    scannedTargets: [...scanned].sort(),
    missingTargets,
    findings,
    reviewedNonissues,
    blockingFindings,
    unreportedReviews,
    errors: evaluated.errors,
    allPassed: evaluated.allPassed,
    sourceUpload: false,
    metricsOrRemoteRuleLookup: false,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.error(
    JSON.stringify({
      rules: bundle.rules,
      targets: expectedTargets.length,
      scanned: scanned.size,
      findings: findings.length,
      reviewedNonissues: reviewedNonissues.length,
      blockingFindings: blockingFindings.length,
      unreportedReviews: unreportedReviews.length,
      errors: evaluated.errors.length,
      missing: missingTargets.length,
    }),
  );
  if (!evaluated.allPassed) process.exitCode = 1;
} finally {
  engineEnvironment.dispose();
}
