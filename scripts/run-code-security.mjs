import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  const expectedTargets = Object.values(groups)
    .flat()
    .map((p) => p.replaceAll("\\", "/"))
    .sort();
  const missingTargets = expectedTargets.filter((p) => !scanned.has(p));
  const reviewPath = path.join(root, "security/semgrep/reviewed-nonissues.json");
  const reviews = fs.existsSync(reviewPath) ? JSON.parse(fs.readFileSync(reviewPath, "utf8")) : [];
  const reviewedNonissues = [];
  const blockingFindings = [];
  for (const finding of findings) {
    const normalized = finding.path.replaceAll("\\", "/");
    if (!expectedTargets.includes(normalized)) {
      errors.push({ message: "Unexpected finding target", path: normalized });
      continue;
    }
    const sourceHash = createHash("sha256")
      .update(fs.readFileSync(path.join(root, normalized)))
      .digest("hex");
    const review = reviews.find(
      (r) =>
        r.rule === finding.check_id &&
        r.path === normalized &&
        r.line === finding.start.line &&
        r.sourceSha256 === sourceHash,
    );
    if (review) reviewedNonissues.push({ finding, review });
    else blockingFindings.push(finding);
  }
  const staleReviews = reviews.filter(
    (r) => !reviewedNonissues.some((entry) => entry.review === r),
  );
  if (staleReviews.length)
    errors.push({ message: "Stale nonissue review requires explicit update", staleReviews });
  const report = {
    version: 1,
    engine: version.stdout.trim(),
    ruleCount: bundle.rules,
    ruleBundleSha256: configHash,
    sourceScope: ["src", "ui", "gateway/src", "scripts"],
    expectedTargets,
    scannedTargets: [...scanned].sort(),
    missingTargets,
    findings,
    reviewedNonissues,
    blockingFindings,
    errors,
    sourceUpload: false,
    metricsOrRemoteRuleLookup: false,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({
      rules: bundle.rules,
      targets: expectedTargets.length,
      scanned: scanned.size,
      findings: findings.length,
      reviewedNonissues: reviewedNonissues.length,
      blockingFindings: blockingFindings.length,
      errors: errors.length,
      missing: missingTargets.length,
    }),
  );
  if (blockingFindings.length || errors.length || missingTargets.length) process.exitCode = 1;
} finally {
  engineEnvironment.dispose();
}
