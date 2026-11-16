import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const requireGitClean = process.env.REQUIRE_GIT_CLEAN === "1";

function runCommand(command: string, args: readonly string[]): void {
  if (command === "npm") {
    const npmExecPath = process.env.npm_execpath;
    if (npmExecPath && existsSync(npmExecPath)) {
      execFileSync(process.execPath, [npmExecPath, ...args], { stdio: "inherit" });
      return;
    }
    if (process.platform === "win32") {
      const bundledNpmCli = join(
        dirname(process.execPath),
        "node_modules",
        "npm",
        "bin",
        "npm-cli.js",
      );
      if (existsSync(bundledNpmCli)) {
        execFileSync(process.execPath, [bundledNpmCli, ...args], { stdio: "inherit" });
        return;
      }
      execFileSync("npm.cmd", [...args], { stdio: "inherit", shell: true });
      return;
    }
  }
  execFileSync(command, [...args], { stdio: "inherit" });
}

const commands: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["npm", ["run", "release:parity"]],
  ["npm", ["run", "check"]],
  ["npm", ["run", "bench"]],
  ["npm", ["run", "docs:api"]],
  ...(requireGitClean ? ([["git", ["diff", "--exit-code", "docs/api"]]] as const) : []),
  ["npm", ["run", "server-card:generate"]],
  ...(requireGitClean
    ? ([["git", ["diff", "--exit-code", "public/.well-known/mcp/server-card.json"]]] as const)
    : []),
  ["npm", ["run", "api:health"]],
  ["npm", ["run", "registry:validate"]],
  ["npm", ["run", "build:repro"]],
  ["npm", ["run", "sbom"]],
  ["npm", ["pack", "--dry-run", "--json"]],
];

for (const [command, args] of commands) {
  console.error(`Running: ${command} ${args.join(" ")}`);
  runCommand(command, args);
}

console.error("Release gate passed.");
