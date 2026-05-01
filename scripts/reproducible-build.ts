import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function collectFiles(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((entry) => {
      const path = join(directory, entry);
      const stat = statSync(path);
      return stat.isDirectory() ? collectFiles(path) : [path];
    })
    .sort();
}

function distHash(): string {
  const hash = createHash("sha256");
  for (const file of collectFiles("dist")) {
    hash.update(relative("dist", file));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

function buildAndHash(): string {
  rmSync("dist", { recursive: true, force: true });
  execFileSync("npm", ["run", "build"], { stdio: "inherit" });
  return distHash();
}

const first = buildAndHash();
const second = buildAndHash();

if (first !== second) {
  console.error(`Reproducible build check failed: ${first} !== ${second}`);
  process.exit(1);
}

console.error(`Reproducible build hash: ${first}`);
