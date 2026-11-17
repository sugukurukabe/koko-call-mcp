import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const output = path.resolve(root, option("--output", "evidence/security/dependency-audit.json"));
const baseSha = option("--base", "");
if (baseSha && !/^[a-f0-9]{40}$/.test(baseSha)) throw new Error("Invalid base commit SHA");
const npmCli = process.env.npm_execpath;
if (!npmCli || !fs.existsSync(npmCli)) throw new Error("Run through npm run security:dependencies");
const hash = (data) => createHash("sha256").update(data).digest("hex");
const tempParent = fs.realpathSync(os.tmpdir());
const temporary = fs.mkdtempSync(path.join(tempParent, "jp-bids-dependency-audit-"));
const baseEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|USERPROFILE|APPDATA|LOCALAPPDATA|TMPDIR|TMP|TEMP|HOME)$/i.test(
      key,
    ),
  ),
);
const userConfig = path.join(temporary, "user.npmrc");
const globalConfig = path.join(temporary, "global.npmrc");
fs.writeFileSync(userConfig, "");
fs.writeFileSync(globalConfig, "");
const reports = [];
let failed = false;
let cleanupError = null;
function cleanupGeneratedAuditDirectory() {
  const resolved = fs.realpathSync(temporary);
  if (
    path.dirname(resolved) !== tempParent ||
    !path.basename(resolved).startsWith("jp-bids-dependency-audit-")
  ) {
    throw new Error("Refusing cleanup outside the generated audit directory");
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}
try {
  for (const scope of ["root", "gateway"]) {
    const source = scope === "root" ? root : path.join(root, "gateway");
    const target = path.join(temporary, scope);
    fs.mkdirSync(target);
    const inputs = {};
    for (const name of ["package.json", "package-lock.json"]) {
      const data = fs.readFileSync(path.join(source, name));
      fs.writeFileSync(path.join(target, name), data);
      inputs[name] = { sha256: hash(data), bytes: data.length };
    }
    const env = {
      ...baseEnv,
      npm_config_userconfig: userConfig,
      npm_config_globalconfig: globalConfig,
      npm_config_cache: path.join(temporary, "cache"),
      npm_config_logs_dir: path.join(temporary, scope, "logs"),
      npm_config_update_notifier: "false",
      npm_config_fetch_retries: "0",
      npm_config_fetch_timeout: "60000",
      npm_config_registry: "https://registry.npmjs.org",
    };
    const audit = spawnSync(
      process.execPath,
      [
        npmCli,
        "audit",
        "--json",
        "--package-lock-only",
        "--ignore-scripts",
        "--registry=https://registry.npmjs.org",
        "--fetch-retries=0",
        "--loglevel=verbose",
      ],
      {
        cwd: target,
        env,
        encoding: "utf8",
        timeout: 180000,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    const item = { scope, inputs, exitCode: audit.status, baseCommit: baseSha || null };
    try {
      const report = JSON.parse(audit.stdout);
      if (
        audit.error ||
        ![0, 1].includes(audit.status) ||
        report.error ||
        report.auditReportVersion !== 2
      ) {
        throw new Error(report.error?.message || audit.error?.message || "Audit failed");
      }
      const counts = report.metadata.vulnerabilities;
      for (const level of ["info", "low", "moderate", "high", "critical", "total"]) {
        if (!Number.isInteger(counts[level]) || counts[level] < 0)
          throw new Error("Invalid audit counts");
      }
      if (
        counts.total !==
        counts.info + counts.low + counts.moderate + counts.high + counts.critical
      ) {
        throw new Error("Inconsistent audit counts");
      }
      if (
        /audit error|npm error|\b(?:ENOTFOUND|EAI_AGAIN|ECONN\w*|ETIMEDOUT)\b|fetch (?:GET|POST) [345]\d\d/i.test(
          audit.stderr,
        )
      ) {
        throw new Error("Registry/client error in audit log");
      }
      for (const [name, expected] of Object.entries(inputs)) {
        if (
          hash(fs.readFileSync(path.join(source, name))) !== expected.sha256 ||
          hash(fs.readFileSync(path.join(target, name))) !== expected.sha256
        ) {
          throw new Error(`Audit input changed: ${scope}/${name}`);
        }
      }
      item.audit = report;
      item.policyPassed = counts.critical + counts.high + counts.moderate === 0;
      if (baseSha) {
        const lockPath = scope === "root" ? "package-lock.json" : "gateway/package-lock.json";
        const previous = spawnSync(
          "git",
          [
            "-c",
            `safe.directory=${root.replaceAll("\\", "/")}`,
            "-c",
            "core.fsmonitor=false",
            "show",
            `${baseSha}:${lockPath}`,
          ],
          {
            cwd: root,
            encoding: "utf8",
            env: baseEnv,
          },
        );
        if (previous.status !== 0) throw new Error("Cannot read base lockfile");
        const before = JSON.parse(previous.stdout).packages;
        const after = JSON.parse(
          fs.readFileSync(path.join(source, "package-lock.json"), "utf8"),
        ).packages;
        item.baseLockSha256 = hash(previous.stdout);
        item.lockChanges = [...new Set([...Object.keys(before), ...Object.keys(after)])]
          .sort()
          .filter(
            (location) =>
              location &&
              (before[location]?.version !== after[location]?.version ||
                before[location]?.license !== after[location]?.license),
          )
          .map((location) => ({
            location,
            before: before[location]
              ? { version: before[location].version, license: before[location].license }
              : null,
            after: after[location]
              ? { version: after[location].version, license: after[location].license }
              : null,
          }));
      }
      if (!item.policyPassed) failed = true;
    } catch (error) {
      item.policyPassed = false;
      item.error = error.message;
      failed = true;
    }
    reports.push(item);
    if (item.error) break;
  }
} finally {
  try {
    cleanupGeneratedAuditDirectory();
  } catch (error) {
    cleanupError = error.message;
    failed = true;
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(
    output,
    `${JSON.stringify(
      {
        version: 1,
        strategy: "FULL_HEAD_AUDIT_WITH_LOCK_DIFF",
        client: {
          node: process.version,
          npm: /\bnpm\/([\d.]+)/.exec(process.env.npm_config_user_agent || "")?.[1] || null,
        },
        policy: {
          failOnSeverity: "moderate",
          includeDevelopmentAndOptionalDependencies: true,
          maximumHttpRetries: 0,
          automaticFix: false,
        },
        registry: "https://registry.npmjs.org",
        reports,
        cleanupError,
        allPassed: !failed && reports.length === 2,
      },
      null,
      2,
    )}\n`,
  );
}
console.log(
  JSON.stringify({
    scopes: reports.length,
    allPassed: !failed && reports.length === 2,
    counts: reports.map((r) => ({
      scope: r.scope,
      vulnerabilities: r.audit?.metadata?.vulnerabilities,
      error: r.error,
    })),
  }),
);
if (failed || reports.length !== 2) process.exitCode = 1;
