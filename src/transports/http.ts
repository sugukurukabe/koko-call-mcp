import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import cors from "cors";
import express from "express";
import { KkjClient } from "../api/kkj-client.js";
import { parsePortEnv, parsePositiveNumberEnv } from "../lib/env.js";
import { parseAllowedOrigins, validateOrigin } from "../lib/http.js";
import { createJpBidsServer } from "../mcp.js";

const supportedProtocolVersions = new Set(["2025-11-25"]);

export function createHttpApp(): express.Express {
  const app = express();
  const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  const sharedKkjClient = new KkjClient({
    rateLimitPerSecond: parsePositiveNumberEnv(
      process.env.JP_BIDS_RATE_LIMIT_PER_SECOND ?? process.env.KOKO_CALL_RATE_LIMIT_PER_SECOND,
      1,
    ),
  });

  app.use(express.json({ limit: "1mb" }));
  app.use(cors({ origin: allowedOrigins.size === 0 ? true : [...allowedOrigins] }));
  app.use(validateOrigin(allowedOrigins));
  app.use("/.well-known", express.static("public/.well-known"));

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true, service: "JP Bids MCP" });
  });

  app.get("/readyz", (_req, res) => {
    res.status(200).json({ ok: true, service: "JP Bids MCP" });
  });

  app.get("/mcp", (_req, res) => {
    res.status(405).json({ error: "SSE GET is not enabled for this stateless server" });
  });

  app.post("/mcp", async (req, res) => {
    const protocolVersion = req.header("MCP-Protocol-Version");
    if (protocolVersion && !supportedProtocolVersions.has(protocolVersion)) {
      res.status(400).json({
        error: "Unsupported MCP protocol version",
        supported: [...supportedProtocolVersions],
      });
      return;
    }

    const server = createJpBidsServer({ kkjClient: sharedKkjClient });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    } as unknown as ConstructorParameters<typeof StreamableHTTPServerTransport>[0]);
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport as Transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) {
        res.status(500).json({ error: "MCP request failed" });
      }
    }
  });

  return app;
}

export async function startHttpServer(): Promise<void> {
  const app = createHttpApp();
  const port = parsePortEnv(process.env.PORT, 8080);
  const host = process.env.HTTP_HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");
  const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);

  if (allowedOrigins.size === 0) {
    if (process.env.K_SERVICE) {
      console.error(
        "[warning] ALLOWED_ORIGINS is unset. Browser requests from any Origin can reach this MCP endpoint. Set ALLOWED_ORIGINS to a comma-separated allowlist before exposing publicly.",
      );
    } else {
      console.error(
        "[info] ALLOWED_ORIGINS is unset. Local development allows any Origin. Set ALLOWED_ORIGINS for staging or production.",
      );
    }
  }

  app.listen(port, host, () => {
    console.error(`JP Bids MCP listening on http://${host}:${port}/mcp`);
  });
}
