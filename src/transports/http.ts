import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import cors from "cors";
import express from "express";
import { parseAllowedOrigins, validateOrigin } from "../lib/http.js";
import { createKokoCallServer } from "../mcp.js";

export function createHttpApp(): express.Express {
  const app = express();
  const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);

  app.use(express.json({ limit: "1mb" }));
  app.use(cors({ origin: allowedOrigins.size === 0 ? true : [...allowedOrigins] }));
  app.use(validateOrigin(allowedOrigins));
  app.use("/.well-known", express.static("public/.well-known"));

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true, service: "KokoCallMCP" });
  });

  app.get("/mcp", (_req, res) => {
    res.status(405).json({ error: "SSE GET is not enabled for this stateless server" });
  });

  app.post("/mcp", async (req, res) => {
    const server = createKokoCallServer({
      kkjClientOptions: {
        rateLimitPerSecond: Number(process.env.KOKO_CALL_RATE_LIMIT_PER_SECOND ?? 1),
      },
    });
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
  const port = Number(process.env.PORT ?? 8080);

  app.listen(port, "0.0.0.0", () => {
    console.error(`KokoCallMCP listening on http://0.0.0.0:${port}/mcp`);
  });
}
