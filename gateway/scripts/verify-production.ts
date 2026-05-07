#!/usr/bin/env node
// Public MCP JP Gateway の本番公開状態を検証する
// Verify the production exposure state of Public MCP JP Gateway
// Memverifikasi status paparan produksi Public MCP JP Gateway

const DEFAULT_GATEWAY_URL = "https://public-mcp-jp-gateway-397249937286.asia-northeast1.run.app";
const DEFAULT_GMO_URL = "https://gmo-bank-mcp-397249937286.asia-northeast1.run.app";

const EXPECTED_PUBLIC_SERVERS = [
  "jp-bids",
  "jgrants",
  "moneyforward-ca",
  "agriops",
  "freee",
  "houjin-bangou",
  // "real-estate-intel" は Cloud Run デプロイ完了後に追加（現在は localhost のため omitted）
] as const;

interface ReadyzResponse {
  ok: boolean;
  connected_servers: string[];
  configured_server_count: number;
  active_server_count: number;
  omitted_local_servers: unknown[];
  required_endpoint_env_keys: string[];
  production_ready: boolean;
}

function fail(message: string): never {
  console.error(`[verify-production] FAIL: ${message}`);
  process.exit(1);
}

function pass(message: string): void {
  console.error(`[verify-production] PASS: ${message}`);
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    fail(`${url} returned HTTP ${response.status}: ${body}`);
  }
  return response.json();
}

function assertReadyzShape(payload: unknown): ReadyzResponse {
  const body = payload as Partial<ReadyzResponse>;
  if (
    typeof body.ok !== "boolean" ||
    !Array.isArray(body.connected_servers) ||
    typeof body.configured_server_count !== "number" ||
    typeof body.active_server_count !== "number" ||
    !Array.isArray(body.omitted_local_servers) ||
    !Array.isArray(body.required_endpoint_env_keys) ||
    typeof body.production_ready !== "boolean"
  ) {
    fail(`Unexpected /readyz response shape: ${JSON.stringify(payload)}`);
  }
  return body as ReadyzResponse;
}

async function verifyGateway(gatewayBaseUrl: string): Promise<ReadyzResponse> {
  const readyzUrl = new URL("/readyz", gatewayBaseUrl).toString();
  const readyz = assertReadyzShape(await fetchJson(readyzUrl));

  if (!readyz.ok) fail("/readyz ok is false");
  if (!readyz.production_ready) fail("/readyz production_ready is false");
  if (readyz.configured_server_count !== EXPECTED_PUBLIC_SERVERS.length) {
    fail(
      `configured_server_count expected ${EXPECTED_PUBLIC_SERVERS.length}, got ${readyz.configured_server_count}`,
    );
  }
  if (readyz.active_server_count !== EXPECTED_PUBLIC_SERVERS.length) {
    fail(
      `active_server_count expected ${EXPECTED_PUBLIC_SERVERS.length}, got ${readyz.active_server_count}`,
    );
  }
  if (readyz.required_endpoint_env_keys.length > 0) {
    fail(
      `required_endpoint_env_keys must be empty: ${readyz.required_endpoint_env_keys.join(", ")}`,
    );
  }
  if (readyz.omitted_local_servers.length > 0) {
    fail(`omitted_local_servers must be empty: ${JSON.stringify(readyz.omitted_local_servers)}`);
  }

  const actual = new Set(readyz.connected_servers);
  for (const serverId of EXPECTED_PUBLIC_SERVERS) {
    if (!actual.has(serverId)) fail(`missing public child MCP: ${serverId}`);
  }
  if (actual.has("gmo-bank")) {
    fail("gmo-bank must not be exposed in the public Gateway");
  }
  if (actual.size !== EXPECTED_PUBLIC_SERVERS.length) {
    fail(`unexpected connected_servers: ${readyz.connected_servers.join(", ")}`);
  }

  pass(`Gateway /readyz exposes ${readyz.connected_servers.join(", ")}`);
  return readyz;
}

async function verifyGmoIsNotPublic(gmoBaseUrl: string): Promise<number> {
  const healthUrl = new URL("/health", gmoBaseUrl).toString();
  const response = await fetch(healthUrl, { signal: AbortSignal.timeout(10_000) });

  if (response.status === 200) {
    fail("gmo-bank-mcp /health returned 200 from the public internet");
  }
  if (![403, 404].includes(response.status)) {
    fail(`gmo-bank-mcp /health expected 403 or 404, got ${response.status}`);
  }

  pass(`gmo-bank-mcp public /health is blocked with HTTP ${response.status}`);
  return response.status;
}

async function main(): Promise<void> {
  const gatewayBaseUrl = process.env.GATEWAY_PUBLIC_URL ?? DEFAULT_GATEWAY_URL;
  const gmoBaseUrl = process.env.GMO_BANK_MCP_URL ?? DEFAULT_GMO_URL;

  const readyz = await verifyGateway(gatewayBaseUrl);
  const gmoHealthStatus = await verifyGmoIsNotPublic(gmoBaseUrl);

  const summary = {
    verified_at: new Date().toISOString(),
    gateway_url: gatewayBaseUrl,
    gmo_url: gmoBaseUrl,
    production_ready: readyz.production_ready,
    connected_servers: readyz.connected_servers,
    gmo_health_http_status: gmoHealthStatus,
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
