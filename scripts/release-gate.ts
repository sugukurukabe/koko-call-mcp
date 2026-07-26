import { execFileSync } from "node:child_process";

const requireGitClean = process.env.REQUIRE_GIT_CLEAN === "1";

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
  execFileSync(command, [...args], { stdio: "inherit" });
}

console.error("Release gate passed.");
