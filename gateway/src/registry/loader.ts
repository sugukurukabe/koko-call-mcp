// Registry JSON の読み込みと検証
// Registry JSON loading and validation
// Pemuatan dan validasi Registry JSON

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Registry, RegistrySchema } from "./schema.js";

let cachedRegistry: Registry | null = null;

/**
 * gateway/config/registry.json を読み込んで検証する
 * Load and validate gateway/config/registry.json
 * Memuat dan memvalidasi gateway/config/registry.json
 */
export function loadRegistry(registryPath?: string): Registry {
  if (cachedRegistry) return cachedRegistry;

  const dir = dirname(fileURLToPath(import.meta.url));
  const defaultPath = join(dir, "../../config/registry.json");
  const path = registryPath ?? defaultPath;

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(
      `Failed to read registry at ${path}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const result = RegistrySchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid registry.json: ${result.error.message}`);
  }

  const allowLocalChildEndpoints = process.env.GATEWAY_ALLOW_LOCAL_CHILD_ENDPOINTS === "true";
  const servers = result.data.servers
    .map((server) => {
      const envKey = `GATEWAY_CHILD_ENDPOINT_${server.id.toUpperCase().replace(/-/g, "_")}`;
      const endpointOverride = process.env[envKey];
      return endpointOverride ? { ...server, endpoint: endpointOverride } : server;
    })
    .filter((server) => {
      if (!process.env.K_SERVICE || allowLocalChildEndpoints) return true;
      return !server.endpoint.startsWith("http://localhost");
    });

  cachedRegistry = {
    ...result.data,
    servers,
  };
  return cachedRegistry;
}

export function resetRegistryCache(): void {
  cachedRegistry = null;
}
