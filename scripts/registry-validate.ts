import { readFile } from "node:fs/promises";

interface PackageJson {
  name: string;
  version: string;
  mcpName: string;
  repository?: {
    url?: string;
  };
}

interface ServerJson {
  name: string;
  version: string;
  repository?: {
    url?: string;
  };
  packages?: Array<{
    identifier: string;
    version: string;
    transport: { type: string };
  }>;
  remotes?: Array<{
    type: string;
    url: string;
  }>;
}

const packageJson = JSON.parse(await readFile("package.json", "utf8")) as PackageJson;
const serverJson = JSON.parse(await readFile("server.json", "utf8")) as ServerJson;

const errors: string[] = [];

if (packageJson.mcpName !== serverJson.name) {
  errors.push(`mcpName mismatch: ${packageJson.mcpName} !== ${serverJson.name}`);
}

if (packageJson.version !== serverJson.version) {
  errors.push(`version mismatch: ${packageJson.version} !== ${serverJson.version}`);
}

const packageRepositoryUrl = packageJson.repository?.url
  ?.replace(/^git\+/, "")
  .replace(/\.git$/, "");
const serverRepositoryUrl = serverJson.repository?.url?.replace(/\.git$/, "");
if (!packageRepositoryUrl || !serverRepositoryUrl || packageRepositoryUrl !== serverRepositoryUrl) {
  errors.push(`repository URL mismatch: ${packageRepositoryUrl} !== ${serverRepositoryUrl}`);
}

const npmPackage = serverJson.packages?.find((entry) => entry.identifier === packageJson.name);
if (!npmPackage) {
  errors.push(`server.json does not reference npm package ${packageJson.name}`);
} else {
  if (npmPackage.version !== packageJson.version) {
    errors.push(`npm package version mismatch: ${npmPackage.version} !== ${packageJson.version}`);
  }
  if (npmPackage.transport.type !== "stdio") {
    errors.push(`expected stdio package transport, got ${npmPackage.transport.type}`);
  }
}

const remote = serverJson.remotes?.find((entry) => entry.type === "streamable-http");
if (remote && !remote.url.startsWith("https://")) {
  errors.push(`remote URL must be HTTPS: ${remote.url}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}

console.error("Registry metadata validation passed.");
