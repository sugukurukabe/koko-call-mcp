// tests/acceptance/net-guard.mjs
// Offline regression network guard with strict IP loopback validation and dynamic full-DNS interception.
// Dynamically enumerates and blocks ALL resolve*/reverse APIs across dns, dns.promises,
// dns.Resolver.prototype, and dns.promises.Resolver.prototype (fail-closed on unclassified APIs).
// All logs written to stderr (never stdout).

import dns from "node:dns";
import net from "node:net";

function isLoopback(host, { allowEmpty = false } = {}) {
  if (host === undefined || host === null || host === "") {
    return allowEmpty;
  }
  const raw = String(host).trim().toLowerCase();
  const h = raw.startsWith("[") && raw.endsWith("]") ? raw.slice(1, -1) : raw;
  if (h === "localhost") {
    return true;
  }
  if (net.isIPv4(h)) {
    return h.startsWith("127.");
  }
  if (net.isIPv6(h)) {
    if (h === "::1" || h === "0:0:0:0:0:0:0:1") {
      return true;
    }
    if (h.startsWith("::ffff:")) {
      const mapped = h.slice(7);
      return net.isIPv4(mapped) && mapped.startsWith("127.");
    }
  }
  return false;
}

function block(kind, target) {
  process.stderr.write(`[net-guard] BLOCKED ${kind} -> ${String(target)}\n`);
  const error = new Error(
    `net-guard: outbound ${kind} to ${String(target)} is blocked during tests`,
  );
  error.code = "ENETUNREACH";
  return error;
}

const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function guardedConnect(...args) {
  const flattened = Array.isArray(args[0]) ? [...args[0], ...args.slice(1)] : args;
  const first = flattened[0];
  let host;
  let ipcPath;
  if (typeof first === "object" && first !== null && !Array.isArray(first)) {
    host = first.host ?? first.hostname;
    ipcPath = first.path;
  } else if (typeof first === "number" || (typeof first === "string" && /^\d+$/.test(first))) {
    host = typeof flattened[1] === "string" ? flattened[1] : undefined;
  } else if (typeof first === "string") {
    ipcPath = first;
  }
  const isIpcPath = typeof ipcPath === "string" && ipcPath.length > 0;
  if (!isIpcPath && !isLoopback(host, { allowEmpty: true })) {
    const error = block("tcp", host);
    process.nextTick(() => this.destroy(error));
    return this;
  }
  return originalConnect.apply(this, args);
};

const originalLookup = dns.lookup;
dns.lookup = function guardedLookup(hostname, ...rest) {
  if (!isLoopback(hostname)) {
    const callback = rest.find((item) => typeof item === "function");
    const error = block("dns.lookup", hostname);
    if (callback) process.nextTick(() => callback(error));
    return {};
  }
  return originalLookup.call(this, hostname, ...rest);
};

const originalPromisesLookup = dns.promises.lookup;
dns.promises.lookup = async function guardedPromisesLookup(hostname, ...rest) {
  if (!isLoopback(hostname)) {
    throw block("dns.promises.lookup", hostname);
  }
  return originalPromisesLookup.call(this, hostname, ...rest);
};

const originalLookupService = dns.lookupService;
dns.lookupService = function guardedLookupService(address, port, callback) {
  if (!isLoopback(address)) {
    const error = block("dns.lookupService", address);
    if (typeof callback === "function") process.nextTick(() => callback(error));
    return;
  }
  return originalLookupService.call(this, address, port, callback);
};

const originalPromisesLookupService = dns.promises.lookupService;
dns.promises.lookupService = async function guardedPromisesLookupService(address, port) {
  if (!isLoopback(address)) {
    throw block("dns.promises.lookupService", address);
  }
  return originalPromisesLookupService.call(this, address, port);
};

export const DNS_LOCAL_CONFIG_ALLOWLIST = new Set([
  "cancel",
  "constructor",
  "getDefaultResultOrder",
  "getServers",
  "setDefaultResultOrder",
  "setServers",
]);

export const DNS_LOOPBACK_GUARDED = new Set(["lookup", "lookupService"]);
export const DNS_NAMESPACE_OR_CTOR = new Set(["Resolver", "promises"]);

export function classifyDnsMethod(name) {
  if (DNS_LOOPBACK_GUARDED.has(name)) return "LOOPBACK_GUARDED";
  if (DNS_LOCAL_CONFIG_ALLOWLIST.has(name)) return "LOCAL_CONFIG_ALLOWLIST";
  if (DNS_NAMESPACE_OR_CTOR.has(name)) return "NAMESPACE_OR_CTOR";
  if (/^(resolve|reverse)/.test(name)) return "BLOCKED_QUERY";
  return "UNCLASSIFIED_BLOCK";
}

function getAllFunctionNames(obj) {
  const names = new Set();
  for (const key of Object.getOwnPropertyNames(obj)) {
    if (typeof obj[key] === "function") {
      names.add(key);
    }
  }
  return [...names].sort();
}

const DNS_SURFACES = [
  { name: "dns", target: dns, isPromises: false },
  { name: "dns.promises", target: dns.promises, isPromises: true },
  { name: "dns.Resolver.prototype", target: dns.Resolver?.prototype, isPromises: false },
  {
    name: "dns.promises.Resolver.prototype",
    target: dns.promises.Resolver?.prototype,
    isPromises: true,
  },
];

for (const surface of DNS_SURFACES) {
  if (!surface.target) continue;
  for (const method of getAllFunctionNames(surface.target)) {
    const policy = classifyDnsMethod(method);
    if (policy === "BLOCKED_QUERY" || policy === "UNCLASSIFIED_BLOCK") {
      if (surface.isPromises) {
        surface.target[method] = async function blockedPromisesDnsMethod(target) {
          throw block(`${surface.name}.${method}`, target);
        };
      } else {
        surface.target[method] = function blockedCallbackDnsMethod(target, ...rest) {
          const callback = rest.find((item) => typeof item === "function");
          const error = block(`${surface.name}.${method}`, target);
          if (callback) process.nextTick(() => callback(error));
        };
      }
    }
  }
}

const originalFetch = globalThis.fetch;
if (typeof originalFetch === "function") {
  globalThis.fetch = async function guardedFetch(input, init) {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
    let host;
    try {
      host = new URL(String(raw)).hostname;
    } catch {
      host = undefined;
    }
    if (!isLoopback(host)) {
      throw block("fetch", raw);
    }
    return originalFetch.call(this, input, init);
  };
}
