import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8")) as PackageJson;
const packageLock = JSON.parse(await readFile("package-lock.json", "utf8")) as PackageLockJson;
const serverJson = JSON.parse(await readFile("server.json", "utf8")) as ServerJson;
const serverCard = JSON.parse(
  await readFile("public/.well-known/mcp/server-card.json", "utf8"),
) as ServerCardJson;
const versionSource = await readFile("src/lib/version.ts", "utf8");
const license = await readFile("LICENSE", "utf8");

const version = packageJson.version;
assert(
  versionSource.includes(`export const VERSION = "${version}"`),
  "src/lib/version.ts mismatch",
);
assert(packageLock.version === version, "package-lock top-level version mismatch");
assert(packageLock.packages[""].version === version, "package-lock root package version mismatch");
assert(serverJson.version === version, "server.json version mismatch");
assert(
  serverJson.packages.every((pkg) => pkg.version === version),
  "server.json package version mismatch",
);
assert(serverCard.serverInfo.version === version, "server-card version mismatch");
assert(
  license.includes("TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION"),
  "LICENSE is not full Apache-2.0 text",
);

if (process.env.REQUIRE_RELEASE_TAG === "1") {
  const tags = execFileSync("git", ["tag", "--points-at", "HEAD"], { encoding: "utf8" })
    .split(/\s+/)
    .filter(Boolean);
  assert(tags.includes(`v${version}`), `HEAD is not tagged v${version}`);
}

if (process.env.REQUIRE_NPM_UNPUBLISHED === "1") {
  const published = execFileSync("npm", ["view", packageJson.name, "version", "--json"], {
    encoding: "utf8",
  }).trim();
  assert(
    published !== JSON.stringify(version),
    `${packageJson.name}@${version} is already published`,
  );
}

console.error(`Release parity passed for v${version}.`);

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

interface PackageJson {
  name: string;
  version: string;
}

interface PackageLockJson {
  version: string;
  packages: {
    "": {
      version: string;
    };
  };
}

interface ServerJson {
  version: string;
  packages: Array<{
    version: string;
  }>;
}

interface ServerCardJson {
  serverInfo: {
    version: string;
  };
}
