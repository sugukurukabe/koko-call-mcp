import { randomBytes } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import cors from "cors";
import express from "express";
import { KkjClient } from "../api/kkj-client.js";
import { parseProApiKeys, parseTier } from "../lib/auth.js";
import { parsePortEnv, parsePositiveNumberEnv } from "../lib/env.js";
import { parseAllowedOrigins, validateOrigin } from "../lib/http.js";
import { createJpBidsServer } from "../mcp.js";
import { verifyJwt } from "../oauth/jwt.js";
import { VERSION } from "../lib/version.js";
import { createOAuthRouter } from "../oauth/router.js";

const supportedProtocolVersions = new Set(["2025-11-25"]);

function resolveOAuthSecret(): string | undefined {
  const explicit = process.env.JP_BIDS_OAUTH_SECRET;
  if (explicit) return explicit;
  if (process.env.K_SERVICE) {
    const generated = randomBytes(32).toString("hex");
    console.error(
      "[warning] JP_BIDS_OAUTH_SECRET is unset. Generated an ephemeral key. OAuth tokens will not survive restarts or work across instances. Set this variable in production.",
    );
    return generated;
  }
  return undefined;
}

export function createHttpApp(): express.Express {
  const app = express();
  const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  const proApiKeys = parseProApiKeys(process.env.JP_BIDS_PRO_API_KEYS);
  const oauthSecret = resolveOAuthSecret();
  const sharedKkjClient = new KkjClient({
    rateLimitPerSecond: parsePositiveNumberEnv(
      process.env.JP_BIDS_RATE_LIMIT_PER_SECOND ?? process.env.KOKO_CALL_RATE_LIMIT_PER_SECOND,
      1,
    ),
  });

  if (proApiKeys.size === 0 && process.env.K_SERVICE) {
    console.error(
      "[warning] JP_BIDS_PRO_API_KEYS is unset. All HTTP requests will be treated as Pro tier. Set this variable in production to enable Free/Pro tier separation.",
    );
  }

  app.use(express.json({ limit: "1mb" }));
  app.use(cors({ origin: allowedOrigins.size === 0 ? true : [...allowedOrigins] }));
  app.use(validateOrigin(allowedOrigins));

  if (oauthSecret) {
    app.use(createOAuthRouter(oauthSecret));
  }

  app.use("/.well-known", express.static("public/.well-known"));

  app.get("/ogp.png", (_req, res) => {
    res.sendFile("ogp.png", { root: "public" });
  });

  app.get("/favicon.ico", (_req, res) => {
    res.sendFile("favicon.ico", { root: "public" });
  });

  app.get("/favicon.png", (_req, res) => {
    res.sendFile("favicon.png", { root: "public" });
  });

  app.get("/privacy", (_req, res) => {
    res.sendFile("privacy.html", { root: "public" });
  });

  app.get("/terms", (_req, res) => {
    res.sendFile("terms.html", { root: "public" });
  });

  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").sendFile("robots.txt", { root: "public" });
  });

  app.get("/llms.txt", (_req, res) => {
    res.type("text/markdown; charset=utf-8").sendFile("llms.txt", { root: "public" });
  });

  app.get("/llms-full.txt", (_req, res) => {
    res.type("text/markdown; charset=utf-8").sendFile("llms-full.txt", { root: "public" });
  });

  app.get("/", (_req, res) => {
    res.sendFile("index.html", { root: "public" });
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "JP Bids MCP" });
  });

  // 利用統計: 買い手がトラクションを確認できるエンドポイント
  // Usage stats: endpoint for acquirers to verify traction
  // Statistik penggunaan: endpoint bagi pembeli untuk memverifikasi traksi
  let requestCount = 0;
  const startedAt = new Date().toISOString();
  app.use("/mcp", (_req, _res, next) => {
    requestCount++;
    next();
  });
  app.get("/stats", (_req, res) => {
    res.status(200).json({
      service: "JP Bids MCP",
      version: VERSION,
      startedAt,
      uptimeSeconds: Math.floor(process.uptime()),
      mcpRequestCount: requestCount,
      nodeVersion: process.version,
    });
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

    // OAuth有効時: Bearerトークンがなければ401を返してOAuthフローを起動する
    // When OAuth is enabled: return 401 without Bearer token to trigger OAuth flow
    // Saat OAuth aktif: kembalikan 401 tanpa Bearer token untuk memulai alur OAuth
    const authHeader = req.header("Authorization");
    if (oauthSecret && !authHeader) {
      const proto = req.header("x-forwarded-proto") || req.protocol;
      const host = req.header("x-forwarded-host") || req.header("host") || "localhost:8080";
      const base = `${proto}://${host}`;
      res
        .status(401)
        .set(
          "WWW-Authenticate",
          `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/mcp"`,
        )
        .json({ error: "unauthorized" });
      return;
    }

    // JWT（OAuth）またはAPIキーのどちらでも受け付ける
    // Accept either JWT (OAuth) or API key
    // Terima JWT (OAuth) atau API key
    if (oauthSecret && authHeader) {
      const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
      const token = match?.[1];
      if (token?.includes(".")) {
        const jwt = verifyJwt(token, oauthSecret);
        if (!jwt) {
          res.status(401).json({ error: "invalid_token" });
          return;
        }
      }
    }

    const tier = parseTier(authHeader, proApiKeys);
    const server = createJpBidsServer({ kkjClient: sharedKkjClient, tier });
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
