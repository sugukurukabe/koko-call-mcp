import { execFileSync } from "node:child_process";

const commands: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["npm", ["run", "check"]],
  ["npm", ["run", "bench"]],
  ["npm", ["run", "docs:api"]],
  ["npm", ["run", "api:health"]],
  ["npm", ["run", "registry:validate"]],
  ["npm", ["run", "sbom"]],
  ["npm", ["publish", "--dry-run", "--access", "public", "--ignore-scripts"]],
];

for (const [command, args] of commands) {
  console.error(`Running: ${command} ${args.join(" ")}`);
  execFileSync(command, [...args], { stdio: "inherit" });
}

console.error("Release gate passed.");
