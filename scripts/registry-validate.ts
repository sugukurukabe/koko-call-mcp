import { readFile } from "node:fs/promises";
import { VERSION } from "../src/lib/version.js";

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

interface WellKnownJson {
  version: string;
  repository?: string;
  transports?: string[];
}

interface AgentsJson {
  name: string;
  version: string;
  repository?: string;
  governance?: {
    sampling?: string;
    tasks?: string;
    authentication?: string;
  };
}

const packageJson = JSON.parse(await readFile("package.json", "utf8")) as PackageJson;
const serverJson = JSON.parse(await readFile("server.json", "utf8")) as ServerJson;
const wellKnownJson = JSON.parse(
  await readFile("public/.well-known/mcp-server.json", "utf8"),
) as WellKnownJson;
const agentsJson = JSON.parse(
  await readFile("public/.well-known/agents.json", "utf8"),
) as AgentsJson;
const serverCardJson = JSON.parse(
  await readFile("public/.well-known/mcp/server-card.json", "utf8"),
) as { serverInfo?: { version?: string } };
const smitheryManifestJson = JSON.parse(
  await readFile(".smithery/shttp/manifest.json", "utf8"),
) as { payload?: { serverCard?: { serverInfo?: { version?: string } } } };
const citationText = await readFile("CITATION.cff", "utf8");
const indexHtml = await readFile("public/index.html", "utf8");

const errors: string[] = [];

if (packageJson.mcpName !== serverJson.name) {
  errors.push(`mcpName mismatch: ${packageJson.mcpName} !== ${serverJson.name}`);
}

if (packageJson.version !== serverJson.version) {
  errors.push(`version mismatch: ${packageJson.version} !== ${serverJson.version}`);
}

if (packageJson.version !== VERSION) {
  errors.push(`src/lib/version.ts mismatch: ${packageJson.version} !== ${VERSION}`);
}

if (packageJson.version !== wellKnownJson.version) {
  errors.push(`well-known version mismatch: ${packageJson.version} !== ${wellKnownJson.version}`);
}

if (packageJson.version !== agentsJson.version) {
  errors.push(`agents.json version mismatch: ${packageJson.version} !== ${agentsJson.version}`);
}

if (packageJson.version !== serverCardJson.serverInfo?.version) {
  errors.push(
    `server-card version mismatch: ${packageJson.version} !== ${serverCardJson.serverInfo?.version}`,
  );
}

const smitheryVersion = smitheryManifestJson.payload?.serverCard?.serverInfo?.version;
if (packageJson.version !== smitheryVersion) {
  errors.push(`smithery manifest version mismatch: ${packageJson.version} !== ${smitheryVersion}`);
}

const citationVersion = /^version:\s*(.+)$/m.exec(citationText)?.[1]?.trim();
if (packageJson.version !== citationVersion) {
  errors.push(`CITATION.cff version mismatch: ${packageJson.version} !== ${citationVersion}`);
}

const softwareVersion = /"softwareVersion":\s*"([^"]+)"/.exec(indexHtml)?.[1];
if (packageJson.version !== softwareVersion) {
  errors.push(`JSON-LD softwareVersion mismatch: ${packageJson.version} !== ${softwareVersion}`);
}

const packageRepositoryUrl = packageJson.repository?.url
  ?.replace(/^git\+/, "")
  .replace(/\.git$/, "");
const serverRepositoryUrl = serverJson.repository?.url?.replace(/\.git$/, "");
if (!packageRepositoryUrl || !serverRepositoryUrl || packageRepositoryUrl !== serverRepositoryUrl) {
  errors.push(`repository URL mismatch: ${packageRepositoryUrl} !== ${serverRepositoryUrl}`);
}

const wellKnownRepositoryUrl = wellKnownJson.repository?.replace(/\.git$/, "");
if (!wellKnownRepositoryUrl || packageRepositoryUrl !== wellKnownRepositoryUrl) {
  errors.push(
    `well-known repository URL mismatch: ${packageRepositoryUrl} !== ${wellKnownRepositoryUrl}`,
  );
}

const agentsRepositoryUrl = agentsJson.repository?.replace(/\.git$/, "");
if (!agentsRepositoryUrl || packageRepositoryUrl !== agentsRepositoryUrl) {
  errors.push(
    `agents.json repository URL mismatch: ${packageRepositoryUrl} !== ${agentsRepositoryUrl}`,
  );
}

if (!agentsJson.governance?.sampling || !agentsJson.governance.tasks) {
  errors.push("agents.json must document sampling and tasks governance");
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
