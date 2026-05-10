// Gateway HTTP サーバーエントリポイント
// Gateway HTTP server entry point
// Titik masuk server HTTP Gateway

import { randomBytes } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import cors from "cors";
import express from "express";
import { createRequestId, recordAuditEvent } from "./audit/audit-logger.js";
import { extractBearerToken, hashActor, parseProApiKeys, parseTier } from "./lib/auth.js";
import { parsePortEnv } from "./lib/env.js";
import { VERSION } from "./lib/version.js";
import { createGatewayServer } from "./mcp.js";
import { getRegistryDeploymentStatus, loadRegistry } from "./registry/loader.js";
import { addToAuditBuffer } from "./tools/get-audit-events.js";

const SUPPORTED_PROTOCOL_VERSIONS = new Set(["2025-11-25"]);

function resolveGatewaySecret(): string {
  const explicit = process.env.GATEWAY_JWT_SECRET;
  if (explicit) return explicit;
  if (process.env.K_SERVICE) {
    throw new Error(
      "GATEWAY_JWT_SECRET is required in production. Refusing to start with an ephemeral signing key.",
    );
  }
  const generated = randomBytes(32).toString("hex");
  console.error("[info] GATEWAY_JWT_SECRET is unset. Generated an ephemeral local-dev key.");
  return generated;
}

export function createHttpApp(): express.Express {
  const app = express();
  resolveGatewaySecret();
  const proApiKeys = parseProApiKeys(process.env.GATEWAY_PRO_API_KEYS);
  if (process.env.K_SERVICE && proApiKeys.size === 0) {
    throw new Error("GATEWAY_PRO_API_KEYS is required in production.");
  }

  // gateway 起動時に registry を検証する
  // Validate registry at gateway startup
  // Validasi registry saat startup gateway
  loadRegistry();

  app.use(express.json({ limit: "1mb" }));
  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
        : true,
    }),
  );

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "Public MCP JP Gateway", version: VERSION });
  });

  app.get("/readyz", (_req, res) => {
    const registry = loadRegistry();
    const deployment = getRegistryDeploymentStatus();
    res.status(200).json({
      ok: true,
      service: "Public MCP JP Gateway",
      version: VERSION,
      connected_servers: registry.servers.map((s) => s.id),
      configured_server_count: deployment.configured_server_count,
      active_server_count: deployment.active_server_ids.length,
      omitted_local_servers: deployment.omitted_local_servers,
      required_endpoint_env_keys: deployment.required_endpoint_env_keys,
      production_ready:
        !deployment.production ||
        deployment.allow_local_child_endpoints ||
        deployment.omitted_local_servers.length === 0,
    });
  });

  // MCP Server Card discovery endpoint（SEP-2127 Draft / server.json 互換）
  // MCP Server Card discovery endpoint (SEP-2127 Draft / server.json compatible)
  // Endpoint penemuan MCP Server Card (SEP-2127 Draft / kompatibel server.json)
  const serverCard = {
    $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: "jp.mcp-gateway/public-mcp-jp-gateway",
    version: VERSION,
    title: "Public MCP JP Gateway",
    description:
      "日本の公的データMCP（入札・補助金・法人番号・農業統計・不動産・会計）を1回の接続で使えるFederation Gateway。7子MCPを統合。Japan public-data MCP federation gateway — JP Bids, J-Grants, Corporate Number, AgriOps, Real Estate Intel, MoneyForward Cloud Accounting, freee.",
    websiteUrl: "https://mcp-gateway.jp",
    repository: {
      url: "https://github.com/sugukurukabe/koko-call-mcp",
      source: "github",
      subfolder: "gateway",
    },
    remotes: [
      {
        transportType: "streamable-http",
        url: "https://mcp-gateway.jp/mcp",
        headers: {
          Authorization: "Bearer {api_key}",
        },
      },
    ],
  };

  app.get("/.well-known/mcp-server-card", (_req, res) => {
    res.status(200).json(serverCard);
  });

  app.get("/.well-known/mcp.json", (_req, res) => {
    res.status(200).json(serverCard);
  });

  app.get("/mcp", (_req, res) => {
    res.status(405).json({ error: "SSE GET is not supported. Use POST /mcp." });
  });

  app.post("/mcp", async (req, res) => {
    const requestId = createRequestId();
    const startedAt = Date.now();

    const protocolVersion = req.header("MCP-Protocol-Version");
    if (protocolVersion && !SUPPORTED_PROTOCOL_VERSIONS.has(protocolVersion)) {
      res.status(400).json({
        error: "Unsupported MCP protocol version",
        supported: [...SUPPORTED_PROTOCOL_VERSIONS],
      });
      return;
    }

    const authHeader = req.header("Authorization");
    const token = extractBearerToken(authHeader);
    const isOAuthAuthenticated = false; // JWT 検証は次フェーズで実装
    const tier = parseTier(authHeader, proApiKeys);
    const actorHash = token ? hashActor(token) : hashActor("anonymous");

    // X-Mcp-Child-Authorization-{server-id} ヘッダを抽出して子MCPのOAuthトークンを取得する
    // Extract X-Mcp-Child-Authorization-{server-id} headers for child MCP OAuth tokens
    // Ekstrak header X-Mcp-Child-Authorization-{server-id} untuk token OAuth MCP anak
    const childAuthHeaders: Record<string, string> = {};
    const prefix = "x-mcp-child-authorization-";
    for (const [headerName, headerValue] of Object.entries(req.headers)) {
      if (typeof headerName === "string" && headerName.toLowerCase().startsWith(prefix)) {
        const serverId = headerName.toLowerCase().slice(prefix.length);
        const childToken = extractBearerToken(
          Array.isArray(headerValue) ? headerValue[0] : headerValue,
        );
        if (serverId && childToken) {
          childAuthHeaders[serverId] = childToken;
        }
      }
    }

    const context = { tier, isOAuthAuthenticated, actorHash, childAuthHeaders };

    const gatewayServer = createGatewayServer({ context });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    } as unknown as ConstructorParameters<typeof StreamableHTTPServerTransport>[0]);

    res.on("close", () => {
      void transport.close();
      void gatewayServer.close();
    });

    try {
      await gatewayServer.connect(transport as Transport);
      await transport.handleRequest(req, res, req.body);

      // 完了後に監査ログを記録する
      // Record audit log after completion
      // Catat log audit setelah selesai
      const body = req.body as Record<string, unknown>;
      const toolName =
        typeof body.method === "string" && body.method === "tools/call"
          ? ((body.params as Record<string, unknown>)?.name as string | undefined)
          : undefined;

      if (toolName) {
        const event = recordAuditEvent({
          requestId,
          actorHash,
          selectedServer: "gateway",
          toolName,
          decision: "allowed",
          startedAt,
        });
        addToAuditBuffer({
          request_id: event.request_id,
          timestamp: event.timestamp,
          actor_hash: event.actor_hash,
          selected_server: event.selected_server,
          tool_name: event.tool_name,
          decision: event.decision,
          latency_ms: event.latency_ms,
        });
      }
    } catch (error) {
      console.error("[gateway] MCP request error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Gateway MCP request failed" });
      }
    }
  });

  return app;
}

export async function startHttpServer(): Promise<void> {
  const app = createHttpApp();
  const port = parsePortEnv(process.env.PORT, 8090);
  const host = process.env.HTTP_HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");

  app.listen(port, host, () => {
    console.error(`Public MCP JP Gateway listening on http://${host}:${port}/mcp`);
    console.error(
      `Registry: ${loadRegistry()
        .servers.map((s) => s.id)
        .join(", ")}`,
    );
  });
}

startHttpServer().catch((e) => {
  console.error("[gateway] Fatal startup error:", e);
  process.exit(1);
});
