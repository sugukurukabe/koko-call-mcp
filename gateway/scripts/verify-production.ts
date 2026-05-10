#!/usr/bin/env node
// Public MCP JP Gateway の本番公開状態を検証する
// Verify the production exposure state of Public MCP JP Gateway
// Memverifikasi status paparan produksi Public MCP JP Gateway

const DEFAULT_GATEWAY_URL = "https://mcp-gateway.jp";
const DEFAULT_GMO_URL = "https://gmo-bank-mcp-397249937286.asia-northeast1.run.app";

const EXPECTED_PUBLIC_SERVERS = [
  "jp-bids",
  "jgrants",
  "moneyforward-ca",
  "agriops",
  "freee",
  "houjin-bangou",
  "real-estate-intel",
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

async function verifyDiscovery(gatewayBaseUrl: string): Promise<void> {
  // MCP Server Card discovery endpoint（SEP-2127 Draft）の検証
  // Verify MCP Server Card discovery endpoint (SEP-2127 Draft)
  // Verifikasi endpoint penemuan MCP Server Card (SEP-2127 Draft)
  const cardUrl = new URL("/.well-known/mcp-server-card", gatewayBaseUrl).toString();
  const card = (await fetchJson(cardUrl)) as Record<string, unknown>;

  if (typeof card.name !== "string" || !card.name.includes("public-mcp-jp-gateway")) {
    fail(`/.well-known/mcp-server-card missing expected name: ${JSON.stringify(card.name)}`);
  }
  if (!Array.isArray(card.remotes) || card.remotes.length === 0) {
    fail(`/.well-known/mcp-server-card remotes must be a non-empty array`);
  }
  const remote = card.remotes[0] as Record<string, unknown>;
  if (remote.transportType !== "streamable-http") {
    fail(
      `mcp-server-card remotes[0].transportType expected "streamable-http", got ${remote.transportType}`,
    );
  }

  pass(`/.well-known/mcp-server-card returns valid server card (name: ${card.name})`);
}

async function verifyMcpInitialize(gatewayBaseUrl: string): Promise<void> {
  // POST /mcp initialize が正常に通ることを確認
  // Verify that POST /mcp initialize succeeds
  // Verifikasi bahwa POST /mcp initialize berhasil
  const mcpUrl = new URL("/mcp", gatewayBaseUrl).toString();
  const response = await fetch(mcpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "verify-production", version: "0.1.0" },
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    fail(`POST /mcp initialize returned HTTP ${response.status}`);
  }
  const body = (await response.json()) as Record<string, unknown>;
  const result = body.result as Record<string, unknown> | undefined;
  if (!result?.serverInfo) {
    fail(`POST /mcp initialize missing result.serverInfo: ${JSON.stringify(body)}`);
  }
  pass(
    `POST /mcp initialize succeeded (server: ${(result.serverInfo as Record<string, unknown>).name})`,
  );
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
  await verifyDiscovery(gatewayBaseUrl);
  await verifyMcpInitialize(gatewayBaseUrl);
  const gmoHealthStatus = await verifyGmoIsNotPublic(gmoBaseUrl);

  const summary = {
    verified_at: new Date().toISOString(),
    gateway_url: gatewayBaseUrl,
    gmo_url: gmoBaseUrl,
    production_ready: readyz.production_ready,
    connected_servers: readyz.connected_servers,
    discovery_endpoint: `${gatewayBaseUrl}/.well-known/mcp-server-card`,
    mcp_endpoint: `${gatewayBaseUrl}/mcp`,
    gmo_health_http_status: gmoHealthStatus,
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
