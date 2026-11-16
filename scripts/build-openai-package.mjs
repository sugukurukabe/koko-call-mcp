// Local structural/asset validation. This does NOT submit or approve an OpenAI listing.
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const toolingPkgPath = path.join(root, "tooling", "package.json");
const rootPkgPath = path.join(root, "package.json");
const requireFromPkg = createRequire(fs.existsSync(toolingPkgPath) ? toolingPkgPath : rootPkgPath);

function dependency(name) {
  try {
    return requireFromPkg(name);
  } catch (error) {
    if (process.env.JP_BIDS_TOOLING_MODULES) {
      return createRequire(path.join(process.env.JP_BIDS_TOOLING_MODULES, "_resolve.cjs"))(name);
    }
    throw new Error(
      `Missing tool dependency ${name}. See README-FIRST.md; nothing was installed automatically.`,
      { cause: error },
    );
  }
}

function optionalDependency(name) {
  try {
    return dependency(name);
  } catch {
    return null;
  }
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const pngjsModule = optionalDependency("pngjs");

function decodeAndVerifyPng(bytes) {
  if (pngjsModule?.PNG) {
    return pngjsModule.PNG.sync.read(bytes, { checkCRC: true });
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) {
    throw new Error("Invalid PNG file signature");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let seenIhdr = false;
  let seenIend = false;
  const idatChunks = [];

  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) {
      throw new Error("Truncated PNG chunk header");
    }
    const chunkLength = bytes.readUInt32BE(offset);
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const chunkType = typeBytes.toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;
    const crcOffset = dataEnd;
    if (crcOffset + 4 > bytes.length) {
      throw new Error(`Truncated PNG chunk body: ${chunkType}`);
    }
    const chunkData = bytes.subarray(dataStart, dataEnd);
    const expectedCrc = bytes.readUInt32BE(crcOffset);
    const actualCrc = crc32(Buffer.concat([typeBytes, chunkData]));
    if (actualCrc !== expectedCrc) {
      throw new Error(`PNG chunk CRC mismatch in ${chunkType}`);
    }

    if (!seenIhdr && chunkType !== "IHDR") {
      throw new Error("First PNG chunk must be IHDR");
    }

    if (chunkType === "IHDR") {
      if (seenIhdr || chunkLength !== 13) {
        throw new Error("Invalid PNG IHDR chunk");
      }
      seenIhdr = true;
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData.readUInt8(8);
      colorType = chunkData.readUInt8(9);
      const compression = chunkData.readUInt8(10);
      const filter = chunkData.readUInt8(11);
      interlace = chunkData.readUInt8(12);
      if (width === 0 || height === 0 || compression !== 0 || filter !== 0 || interlace > 1) {
        throw new Error("Unsupported or invalid PNG IHDR parameters");
      }
    } else if (chunkType === "IDAT") {
      idatChunks.push(chunkData);
    } else if (chunkType === "IEND") {
      if (chunkLength !== 0) {
        throw new Error("Invalid non-empty PNG IEND chunk");
      }
      seenIend = true;
      offset = crcOffset + 4;
      break;
    }

    offset = crcOffset + 4;
  }

  if (!seenIhdr || !seenIend || offset !== bytes.length || idatChunks.length === 0) {
    throw new Error("Incomplete or trailing-byte PNG stream");
  }

  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
  const channelsByColorType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByColorType[colorType];
  if (!channels) {
    throw new Error(`Invalid PNG colorType: ${colorType}`);
  }
  if (interlace === 0) {
    const scanlineBytes = 1 + Math.ceil((width * channels * bitDepth) / 8);
    if (decompressed.length !== height * scanlineBytes) {
      throw new Error("Decompressed PNG scanline byte length mismatch");
    }
    for (let row = 0; row < height; row++) {
      const filterType = decompressed[row * scanlineBytes];
      if (filterType === undefined || filterType > 4) {
        throw new Error(`Invalid PNG scanline filter type at row ${row}`);
      }
    }
  }

  return { width, height };
}

const Ajv = dependency("ajv/dist/2020.js").default;
const addFormats = dependency("ajv-formats").default;
const YAML = dependency("yaml");
const source = path.join(root, "plugins", "jp-bids-mcp");
const expectedFiles = [
  "README.md",
  "assets/composer-icon.png",
  "assets/logo.png",
  "mcp.json",
  "plugin.json",
  "skills/search-bids/SKILL.md",
].sort();
const tools = [
  "search_bids",
  "list_recent_bids",
  "get_bid_detail",
  "rank_bids",
  "extract_bid_requirements",
  "export_bid_shortlist",
  "search_bids_app",
];
const records = [];
const warnings = [];
function check(condition, label) {
  if (!condition) throw new Error(`FAIL: ${label}`);
  records.push(label);
  console.error(`PASS: ${label}`);
}
function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
}
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
for (const name of ["plugin", "mcp"]) {
  const schema = readJson(`schemas/${name}.schema.json`);
  const validate = ajv.compile(schema);
  const document = readJson(`plugins/jp-bids-mcp/${name}.json`);
  if (name === "mcp") {
    // OpenAI's documented auth extension is rejected by the retrieved core MCP schema.
    // Retain that result; validate the base projection separately, never claim full conformance.
    const fullValid = validate(document);
    if (!fullValid) {
      warnings.push({
        code: "CORE_MCP_OPENAI_EXTENSION_MISMATCH",
        fullDocumentSchemaErrors: structuredClone(validate.errors),
      });
    }
    const baseProjection = structuredClone(document);
    for (const server of Object.values(baseProjection.mcpServers ?? {})) {
      delete server.extensions;
    }
    check(
      validate(baseProjection),
      "MCP base projection passes bundled core schema (OpenAI extensions removed for this check only)",
    );
  } else {
    check(
      validate(document),
      `${name}.json passes bundled core schema: ${JSON.stringify(validate.errors)}`,
    );
  }
}
const plugin = readJson("plugins/jp-bids-mcp/plugin.json");
const mcp = readJson("plugins/jp-bids-mcp/mcp.json");
const ext = plugin.extensions?.["com.openai"];
const iface = ext?.interface;
check(
  Object.keys(ext).every((k) => ["interface", "review"].includes(k)),
  "OpenAI manifest extension uses only the intended fields",
);
const rootPkg = readJson("package.json");
check(
  plugin.name === "jp-bids" && (plugin.version === rootPkg.version || plugin.version === "1.0.0"),
  `Package identity/version valid (${plugin.version})`,
);
for (const [key, max] of Object.entries({
  displayName: 30,
  shortDescription: 30,
  longDescription: 4000,
  developerName: 80,
})) {
  check(
    typeof iface?.[key] === "string" &&
      iface[key].trim().length > 0 &&
      [...iface[key]].length <= max,
    `${key} exists and meets documented length limit`,
  );
  if (key !== "longDescription") {
    check(!/[\r\n]/.test(iface[key]), `${key} is single-line`);
  }
}
check(iface.category === "Business & Operations", "Documented listing category");
for (const key of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]) {
  const url = new URL(iface[key]);
  check(
    url.protocol === "https:" && !url.username && !url.password && iface[key].length <= 1024,
    `${key} HTTPS syntax (availability not tested)`,
  );
}
check(
  iface.defaultPrompt.length <= 3 &&
    new Set(iface.defaultPrompt).size === iface.defaultPrompt.length,
  "At most three distinct starter prompts",
);
for (const p of iface.defaultPrompt) {
  check(
    typeof p === "string" && [...p].length <= 128 && !/[\r\n@]/.test(p),
    "Starter prompt format",
  );
}
const server = mcp.mcpServers?.["jp-bids"];
check(
  Object.keys(mcp.mcpServers).length === 1 &&
    server?.type === "streamable-http" &&
    server.url === "https://mcp.bid-jp.com/mcp",
  "One production Streamable HTTP endpoint",
);
const auth = server.extensions?.["com.openai"]?.auth;
check(
  auth?.type === "oauth" &&
    auth.client?.mode === "dcr" &&
    JSON.stringify(auth.baseScopes) === '["mcp:read"]',
  "OpenAI OAuth extension/DCR/read scope; no credentials",
);
check(!("tools" in server), "Tool definitions are obtained from server, not a custom tools array");
check(
  Object.keys(auth).every((k) => ["type", "client", "baseScopes"].includes(k)) &&
    Object.keys(auth.client).length === 1,
  "No secret or extra authentication fields",
);
const cases = ext.review?.test_cases;
check(
  cases?.positive?.length === 5 && cases?.negative?.length === 3,
  "Review design has five positive and three negative cases (not executed)",
);
const covered = new Set(
  cases.positive.flatMap((c) => c.tools_triggered.split(",").map((v) => v.trim())),
);
check(
  tools.every((t) => covered.has(t)),
  "Five scenario designs cover seven tools",
);

function list(dir, prefix = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix + entry.name;
    check(!entry.isSymbolicLink(), `No symlink: ${rel}`);
    if (entry.isDirectory()) return list(path.join(dir, entry.name), `${rel}/`);
    check(entry.isFile(), `Regular file: ${rel}`);
    return [rel];
  });
}
check(
  JSON.stringify(list(source).sort()) === JSON.stringify(expectedFiles),
  "Exact six-file package allowlist; no unexpected files",
);
for (const key of ["logo", "composerIcon"]) {
  const rel = iface[key];
  check(
    typeof rel === "string" &&
      rel.startsWith("./") &&
      !rel.includes("\\") &&
      !rel.split("/").includes(".."),
    `${key} is a safe relative POSIX path`,
  );
  check(expectedFiles.includes(rel.slice(2)), `${key} references an included file`);
  const bytes = fs.readFileSync(path.join(source, rel));
  check(bytes.length <= 5 * 1024 * 1024, `${key} is at most 5 MiB`);
  const decoded = decodeAndVerifyPng(bytes);
  check(
    decoded.width === decoded.height && decoded.width >= 48 && decoded.width <= 4096,
    `${key} fully decodes; square ${decoded.width}x${decoded.height}, within documented limits`,
  );
}
const skill = fs.readFileSync(path.join(source, "skills/search-bids/SKILL.md"), "utf8");
const header = skill.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
check(Boolean(header), "Skill has delimited YAML frontmatter");
const meta = YAML.parse(header[1], { uniqueKeys: true });
check(
  meta.name === "search-bids" &&
    typeof meta.description === "string" &&
    meta.description.trim().length > 0,
  "Skill name and description parsed as YAML",
);
check(
  tools.every((t) => skill.includes(`\`${t}\``)),
  "Skill names all seven tools (content review remains separate)",
);

// Dependency-free ZIP STORE writer. ASCII package paths always use forward slashes.
function makeZip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const n = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(0x0800, 6);
    h.writeUInt16LE(33, 12);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(data.length, 18);
    h.writeUInt32LE(data.length, 22);
    h.writeUInt16LE(n.length, 26);
    local.push(h, n, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(33, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, n);
    offset += h.length + n.length + data.length;
  }
  const body = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(body.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, body, end]);
}
const entries = expectedFiles.map((name) => [name, fs.readFileSync(path.join(source, name))]);
const archive = makeZip(entries);
const out = process.env.JP_BIDS_OPENAI_OUT_DIR ?? path.join(root, "artifacts", "openai-package");
fs.mkdirSync(out, { recursive: true });
const file = path.join(out, "jp-bids-submission-candidate-20261022.zip");
const temporary = `${file}.tmp`;
fs.writeFileSync(temporary, archive);
// Read ZIP back and compare local entries and their CRC/data to the exact source allowlist.
const readback = fs.readFileSync(temporary);
let cursor = 0;
for (const [name, data] of entries) {
  check(readback.readUInt32LE(cursor) === 0x04034b50, `ZIP header: ${name}`);
  const len = readback.readUInt32LE(cursor + 18);
  const nl = readback.readUInt16LE(cursor + 26);
  const xl = readback.readUInt16LE(cursor + 28);
  const storedName = readback.subarray(cursor + 30, cursor + 30 + nl).toString("utf8");
  const bytes = readback.subarray(cursor + 30 + nl + xl, cursor + 30 + nl + xl + len);
  check(
    storedName === name &&
      bytes.equals(data) &&
      readback.readUInt32LE(cursor + 14) === crc32(bytes),
    `ZIP path, CRC and bytes match: ${name}`,
  );
  cursor += 30 + nl + xl + len;
}
fs.renameSync(temporary, file);
const report = {
  status: "LOCAL_PARTIAL_VALIDATION_WITH_SCHEMA_WARNING_NOT_SUBMITTED",
  schemaCoverage:
    "Full plugin core schema; MCP base projection only; explicit partial OpenAI checks. Full MCP document fails retrieved core schema because of documented OpenAI auth extension. Portal compatibility is unverified.",
  zip: path.basename(file),
  sha256: createHash("sha256").update(archive).digest("hex"),
  bytes: archive.length,
  checks: records,
  warnings,
  outstanding: [
    "Resolve/confirm documented OpenAI extension vs core MCP schema mismatch in official portal",
    "Publisher verification",
    "KKJ terms basis",
    "Production ChatGPT tests",
    "Privacy deployment settings",
    "Domain challenge",
    "Current production tool/skill scans",
    "Demo recording and review completion",
    "Existing draft/package identity check",
  ],
};
fs.writeFileSync(path.join(out, "validation-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.error(
  JSON.stringify(
    { status: report.status, zip: file, sha256: report.sha256, bytes: report.bytes },
    null,
    2,
  ),
);
