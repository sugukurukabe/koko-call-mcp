// Registry JSON の読み込みと検証
// Registry JSON loading and validation
// Pemuatan dan validasi Registry JSON

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type ChildMcpServer, type Registry, RegistrySchema } from "./schema.js";

let cachedRegistry: Registry | null = null;

export interface OmittedLocalServer {
  id: string;
  display_name: string;
  endpoint: string;
  endpoint_env_key: string;
}

export interface RegistryDeploymentStatus {
  production: boolean;
  allow_local_child_endpoints: boolean;
  configured_server_count: number;
  active_server_ids: string[];
  omitted_local_servers: OmittedLocalServer[];
  required_endpoint_env_keys: string[];
}

function endpointEnvKey(serverId: string): string {
  return `GATEWAY_CHILD_ENDPOINT_${serverId.toUpperCase().replace(/-/g, "_")}`;
}

function isLocalEndpoint(endpoint: string): boolean {
  return endpoint.startsWith("http://localhost") || endpoint.startsWith("http://127.0.0.1");
}

function readRegistry(registryPath?: string): Registry {
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

  return result.data;
}

function applyEndpointOverrides(servers: ChildMcpServer[]): ChildMcpServer[] {
  return servers.map((server) => {
    const endpointOverride = process.env[endpointEnvKey(server.id)];
    return endpointOverride ? { ...server, endpoint: endpointOverride } : server;
  });
}

/**
 * gateway/config/registry.json を読み込んで検証する
 * Load and validate gateway/config/registry.json
 * Memuat dan memvalidasi gateway/config/registry.json
 */
export function loadRegistry(registryPath?: string): Registry {
  if (cachedRegistry) return cachedRegistry;

  const registry = readRegistry(registryPath);
  const allowLocalChildEndpoints = process.env.GATEWAY_ALLOW_LOCAL_CHILD_ENDPOINTS === "true";
  const servers = applyEndpointOverrides(registry.servers).filter((server) => {
    if (!process.env.K_SERVICE || allowLocalChildEndpoints) return true;
    return !isLocalEndpoint(server.endpoint);
  });

  cachedRegistry = {
    ...registry,
    servers,
  };
  return cachedRegistry;
}

export function getRegistryDeploymentStatus(registryPath?: string): RegistryDeploymentStatus {
  const registry = readRegistry(registryPath);
  const production = Boolean(process.env.K_SERVICE);
  const allowLocalChildEndpoints = process.env.GATEWAY_ALLOW_LOCAL_CHILD_ENDPOINTS === "true";
  const servers = applyEndpointOverrides(registry.servers);
  const activeServers =
    production && !allowLocalChildEndpoints
      ? servers.filter((server) => !isLocalEndpoint(server.endpoint))
      : servers;
  const omittedLocalServers =
    production && !allowLocalChildEndpoints
      ? servers
          .filter((server) => isLocalEndpoint(server.endpoint))
          .map((server) => ({
            id: server.id,
            display_name: server.display_name,
            endpoint: server.endpoint,
            endpoint_env_key: endpointEnvKey(server.id),
          }))
      : [];

  return {
    production,
    allow_local_child_endpoints: allowLocalChildEndpoints,
    configured_server_count: registry.servers.length,
    active_server_ids: activeServers.map((server) => server.id),
    omitted_local_servers: omittedLocalServers,
    required_endpoint_env_keys: omittedLocalServers.map((server) => server.endpoint_env_key),
  };
}

export function resetRegistryCache(): void {
  cachedRegistry = null;
}
