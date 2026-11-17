// tests/acceptance/verify-net-guard.mjs
// Dynamic full-API verification suite for tests/acceptance/net-guard.mjs (READINESS-V3-F01).
// Dynamically enumerates EVERY function on dns, dns.promises, dns.Resolver.prototype,
// and dns.promises.Resolver.prototype in the running Node process, installs zero-network
// stubs BEFORE importing net-guard.mjs, fails closed if any unclassified DNS method exists,
// and asserts 0 underlying stub calls for all blocked paths.

import assert from "node:assert/strict";
import dns from "node:dns";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const OUT_FILE = path.join(REPO_ROOT, "evidence", "f01-net-guard-probes-after.json");

const LOCAL_CONFIG_ALLOWLIST = new Set([
  "cancel",
  "constructor",
  "getDefaultResultOrder",
  "getServers",
  "setDefaultResultOrder",
  "setServers",
]);
const LOOPBACK_GUARDED = new Set(["lookup", "lookupService"]);
const NAMESPACE_OR_CTOR = new Set(["Resolver", "promises"]);

function expectedPolicy(method) {
  if (LOOPBACK_GUARDED.has(method)) return "LOOPBACK_GUARDED";
  if (LOCAL_CONFIG_ALLOWLIST.has(method)) return "LOCAL_CONFIG_ALLOWLIST";
  if (NAMESPACE_OR_CTOR.has(method)) return "NAMESPACE_OR_CTOR";
  if (/^(resolve|reverse)/.test(method)) return "BLOCKED_QUERY";
  return "UNCLASSIFIED";
}

function listFunctionNames(obj) {
  return Object.getOwnPropertyNames(obj)
    .filter((k) => typeof obj[k] === "function")
    .sort();
}

const surfaces = [
  { name: "dns", obj: dns, isPromises: false, makeTarget: () => dns },
  { name: "dns.promises", obj: dns.promises, isPromises: true, makeTarget: () => dns.promises },
  {
    name: "dns.Resolver.prototype",
    obj: dns.Resolver.prototype,
    isPromises: false,
    makeTarget: () => new dns.Resolver(),
  },
  {
    name: "dns.promises.Resolver.prototype",
    obj: dns.promises.Resolver.prototype,
    isPromises: true,
    makeTarget: () => new dns.promises.Resolver(),
  },
];

const stubCounts = {
  connect: 0,
  fetch: 0,
};
const enumeratedApis = [];

for (const surface of surfaces) {
  for (const method of listFunctionNames(surface.obj)) {
    const policy = expectedPolicy(method);
    assert.notEqual(
      policy,
      "UNCLASSIFIED",
      `Unclassified DNS API detected on ${surface.name}: ${method}`,
    );
    const fullName = `${surface.name}.${method}`;
    enumeratedApis.push({ surface: surface.name, method, fullName, policy });
    if (policy === "BLOCKED_QUERY" || policy === "LOOPBACK_GUARDED") {
      stubCounts[fullName] = 0;
      if (surface.isPromises) {
        surface.obj[method] = async function stubAsync() {
          stubCounts[fullName] += 1;
          return method === "lookup" ? { address: "127.0.0.1", family: 4 } : [];
        };
      } else {
        surface.obj[method] = function stubCb(...args) {
          stubCounts[fullName] += 1;
          const cb = args.find((a) => typeof a === "function");
          if (cb) {
            if (method === "lookup") cb(null, "127.0.0.1", 4);
            else if (method === "lookupService") cb(null, "localhost", "http");
            else cb(null, []);
          }
          return {};
        };
      }
    }
  }
}

net.Socket.prototype.connect = function stubConnect() {
  stubCounts.connect += 1;
  return this;
};
globalThis.fetch = async function stubFetch() {
  stubCounts.fetch += 1;
  return new Response("ok", { status: 200 });
};

await import(pathToFileURL(path.join(__dirname, "net-guard.mjs")).href);

const results = [];

async function expectAllowed(id, fn, getCount) {
  const before = getCount();
  await fn();
  const after = getCount();
  assert.equal(after, before + 1, `${id}: expected underlying stub to be called once`);
  results.push({ id, expected: "ALLOW", actual: "ALLOW", stubDelta: after - before, passed: true });
}

async function expectBlocked(id, fn, getCount) {
  const before = getCount();
  let errCode = null;
  try {
    await fn();
  } catch (err) {
    errCode = err?.code ?? "NO_CODE";
  }
  const after = getCount();
  assert.equal(errCode, "ENETUNREACH", `${id}: expected ENETUNREACH, got ${errCode}`);
  assert.equal(after, before, `${id}: underlying stub must NOT be called`);
  results.push({
    id,
    expected: "BLOCK_ENETUNREACH",
    actual: errCode,
    stubDelta: after - before,
    passed: true,
  });
}

// 1. Allowed loopback & IPC controls
await expectAllowed(
  "N01_allow_fetch_127_0_0_1",
  () => fetch("http://127.0.0.1:8080/health"),
  () => stubCounts.fetch,
);
await expectAllowed(
  "N01_allow_fetch_localhost",
  () => fetch("http://localhost:8080/health"),
  () => stubCounts.fetch,
);
await expectAllowed(
  "N01_allow_fetch_ipv6_loopback",
  () => fetch("http://[::1]:8080/health"),
  () => stubCounts.fetch,
);
await expectAllowed(
  "N01_allow_tcp_127_0_0_1",
  () => {
    const s = new net.Socket();
    s.connect({ host: "127.0.0.1", port: 8080 });
  },
  () => stubCounts.connect,
);
await expectAllowed(
  "N01_allow_tcp_ipc_pipe",
  () => {
    const s = new net.Socket();
    s.connect("\\\\.\\pipe\\jp-bids-local-test");
  },
  () => stubCounts.connect,
);

// 2. Non-loopback & prefix-bypass & invalid URL rejections
await expectBlocked(
  "N02_block_fetch_example_com",
  () => fetch("https://example.com/"),
  () => stubCounts.fetch,
);
await expectBlocked(
  "N02_block_fetch_invalid_url",
  () => fetch("not-a-valid-url"),
  () => stubCounts.fetch,
);
await expectBlocked(
  "N02_block_tcp_example_com",
  () =>
    new Promise((_resolve, reject) => {
      const s = new net.Socket();
      s.on("error", reject);
      s.connect({ host: "example.com", port: 443 });
    }),
  () => stubCounts.connect,
);
await expectBlocked(
  "N03_block_lookup_127_audit_invalid",
  () =>
    new Promise((resolve, reject) => {
      dns.lookup("127.audit.invalid", (err) => (err ? reject(err) : resolve()));
    }),
  () => stubCounts["dns.lookup"],
);
await expectBlocked(
  "N04_block_promises_lookup_127_audit_invalid",
  () => dns.promises.lookup("127.audit.invalid"),
  () => stubCounts["dns.promises.lookup"],
);
await expectBlocked(
  "N05_block_fetch_127_audit_invalid",
  () => fetch("http://127.audit.invalid/test"),
  () => stubCounts.fetch,
);
await expectBlocked(
  "N06_block_tcp_127_audit_invalid",
  () =>
    new Promise((_resolve, reject) => {
      const s = new net.Socket();
      s.on("error", reject);
      s.connect({ host: "127.audit.invalid", port: 80 });
    }),
  () => stubCounts.connect,
);
await expectBlocked(
  "N07_block_dns_lookupService_external",
  () =>
    new Promise((resolve, reject) => {
      dns.lookupService("203.0.113.77", 53, (err) => (err ? reject(err) : resolve()));
    }),
  () => stubCounts["dns.lookupService"],
);
await expectBlocked(
  "N07_block_dns_promises_lookupService_external",
  () => dns.promises.lookupService("203.0.113.77", 53),
  () => stubCounts["dns.promises.lookupService"],
);

// 3. Dynamic full-API probe for EVERY resolve* and reverse method across all 4 DNS surfaces
for (const surface of surfaces) {
  for (const method of listFunctionNames(surface.obj)) {
    if (expectedPolicy(method) !== "BLOCKED_QUERY") continue;
    const fullName = `${surface.name}.${method}`;
    const input = method === "reverse" ? "203.0.113.77" : "outside.audit.invalid";
    await expectBlocked(
      `DNS_BLOCK_${fullName}`,
      () => {
        const target = surface.makeTarget();
        if (surface.isPromises) {
          return target[method](input);
        }
        return new Promise((resolve, reject) => {
          target[method](input, (err) => (err ? reject(err) : resolve()));
        });
      },
      () => stubCounts[fullName],
    );
  }
}

const report = {
  schemaVersion: "jp-bids-net-guard-probes-v2",
  generatedAt: new Date().toISOString(),
  findingId: "READINESS-V3-F01",
  nodeVersion: process.version,
  externalNetworkCalls: 0,
  enumeratedDnsApiCount: enumeratedApis.length,
  blockedQueryApiCount: enumeratedApis.filter((a) => a.policy === "BLOCKED_QUERY").length,
  enumeratedApis,
  totalChecks: results.length,
  passedChecks: results.filter((r) => r.passed).length,
  allPassed: results.every((r) => r.passed),
  results,
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stderr.write(
  `[verify-net-guard] PASS ${report.passedChecks}/${report.totalChecks} checks (${report.blockedQueryApiCount} blocked DNS APIs on ${process.version}) -> ${OUT_FILE}\n`,
);
