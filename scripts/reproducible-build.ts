import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

function runNpmBuild(): void {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && existsSync(npmExecPath)) {
    execFileSync(process.execPath, [npmExecPath, "run", "build"], { stdio: "inherit" });
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
      execFileSync(process.execPath, [bundledNpmCli, "run", "build"], { stdio: "inherit" });
      return;
    }
    execFileSync("npm.cmd", ["run", "build"], { stdio: "inherit", shell: true });
    return;
  }
  execFileSync("npm", ["run", "build"], { stdio: "inherit" });
}

function collectFiles(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((entry) => {
      const path = join(directory, entry);
      const stat = statSync(path);
      return stat.isDirectory() ? collectFiles(path) : [path];
    })
    .map((path) => path.replaceAll("\\", "/"))
    .sort();
}

function distHash(): string {
  const hash = createHash("sha256");
  for (const file of collectFiles("dist")) {
    hash.update(relative("dist", file).replaceAll("\\", "/"));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

function buildAndHash(): string {
  rmSync("dist", { recursive: true, force: true });
  runNpmBuild();
  return distHash();
}

const first = buildAndHash();
const second = buildAndHash();

if (first !== second) {
  console.error(`Reproducible build check failed: ${first} !== ${second}`);
  process.exit(1);
}

console.error(`Reproducible build hash: ${first}`);
