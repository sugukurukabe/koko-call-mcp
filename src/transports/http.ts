import { randomBytes } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { KkjClient } from "../api/kkj-client.js";
import { parseProApiKeys, parseTier } from "../lib/auth.js";
import { authenticateMcpRequest } from "../lib/authn.js";
import { parsePortEnv, parsePositiveNumberEnv } from "../lib/env.js";
import { parseAllowedOrigins, validateOrigin } from "../lib/http.js";
import {
  getActiveProfile,
  isProductionEnvironment,
  resolveServerProfile,
  type ServerProfile,
} from "../lib/profile.js";
import { VERSION } from "../lib/version.js";
import { createJpBidsServer } from "../mcp.js";
import { createOAuthRouterWithStore } from "../oauth/router.js";
import { createOAuthStoreFromEnv } from "../oauth/store.js";

const LEGACY_SDK_PROTOCOL_VERSIONS = new Set(["2025-11-25"]);
const STATELESS_2026_PROTOCOL_VERSION = "2026-07-28";
const supportedProtocolVersions = new Set([
  ...LEGACY_SDK_PROTOCOL_VERSIONS,
  STATELESS_2026_PROTOCOL_VERSION,
]);

const NAME_TARGET_METHODS = new Set(["tools/call", "prompts/get"]);
const URI_TARGET_METHODS = new Set([
  "resources/read",
  "resources/subscribe",
  "resources/unsubscribe",
]);
const UNNAMED_METHODS = new Set([
  "tools/list",
  "resources/list",
  "resources/templates/list",
  "prompts/list",
  "completion/complete",
  "ping",
  "initialize",
  "notifications/initialized",
  "notifications/cancelled",
  "logging/setLevel",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readJsonRpcMethod(body: unknown): string | undefined {
  if (!isPlainObject(body)) return undefined;
  return readNonEmptyString(body.method);
}

type ExpectedMcpTarget =
  | { kind: "named"; source: "params.name" | "params.uri"; value: string | undefined }
  | { kind: "unnamed" };

function resolveExpectedMcpName(method: string | undefined, body: unknown): ExpectedMcpTarget {
  const params = isPlainObject(body) && isPlainObject(body.params) ? body.params : undefined;
  if (method && NAME_TARGET_METHODS.has(method)) {
    return { kind: "named", source: "params.name", value: readNonEmptyString(params?.name) };
  }
  if (method && URI_TARGET_METHODS.has(method)) {
    return { kind: "named", source: "params.uri", value: readNonEmptyString(params?.uri) };
  }
  if (!method || UNNAMED_METHODS.has(method)) {
    return { kind: "unnamed" };
  }
  const byName = readNonEmptyString(params?.name);
  if (byName) {
    return { kind: "named", source: "params.name", value: byName };
  }
  const byUri = readNonEmptyString(params?.uri);
  if (byUri) {
    return { kind: "named", source: "params.uri", value: byUri };
  }
  return { kind: "unnamed" };
}

const LOOPBACK_HOST_PATTERN = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;

function isAllowedLocalHostHeader(hostHeader: string, configuredBaseUrl?: string): boolean {
  const trimmed = hostHeader.trim();
  if (LOOPBACK_HOST_PATTERN.test(trimmed)) {
    return true;
  }
  if (configuredBaseUrl) {
    try {
      const parsed = new URL(configuredBaseUrl);
      const lower = trimmed.toLowerCase();
      if (lower === parsed.host.toLowerCase() || lower === parsed.hostname.toLowerCase()) {
        return true;
      }
    } catch {
      // Ignore malformed configuredBaseUrl; fall back to loopback check only
    }
  }
  return false;
}

function validateLocalHostHeader(allowedOrigins: ReadonlySet<string>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (allowedOrigins.size > 0) {
      next();
      return;
    }
    const hostHeader = req.header("host");
    if (!hostHeader || isAllowedLocalHostHeader(hostHeader, process.env.JP_BIDS_BASE_URL)) {
      next();
      return;
    }
    res.status(403).json({ error: "Host header is not allowed" });
  };
}

interface ProtocolContractOutcome {
  ok: boolean;
  effectiveVersion: "2026-07-28" | "legacy";
}

type JsonRpcId = string | number | undefined;

function extractJsonRpcId(body: unknown): JsonRpcId {
  if (!isPlainObject(body)) return undefined;
  const id = body.id;
  if (typeof id === "string" && id.length > 0) return id;
  if (typeof id === "number" && Number.isInteger(id)) return id;
  return undefined;
}

function sendMcpProtocolError(
  res: Response,
  req: Request,
  reason: string,
  message: string,
  extraData: Record<string, unknown> = {},
): void {
  const id = extractJsonRpcId(req.body);
  res.status(400).json({
    jsonrpc: "2.0",
    ...(id !== undefined ? { id } : {}),
    error: {
      code: -32020,
      message,
      data: {
        reason,
        ...extraData,
      },
    },
  });
}

type DecodedHeaderResult = { ok: true; value: string } | { ok: false };

function decodeMcpNameHeader(raw: string): DecodedHeaderResult {
  if (!raw.startsWith("=?base64?") || !raw.endsWith("?=")) {
    return { ok: true, value: raw };
  }
  const encoded = raw.slice("=?base64?".length, -"?=".length);
  if (encoded.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    return { ok: false };
  }
  const decodedBuffer = Buffer.from(encoded, "base64");
  if (decodedBuffer.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) {
    return { ok: false };
  }
  return { ok: true, value: decodedBuffer.toString("utf8") };
}

function validateMcpProtocolAndRoutingContract(
  req: Request,
  res: Response,
): ProtocolContractOutcome {
  const headerProtocolVersion = req.header("MCP-Protocol-Version");
  if (headerProtocolVersion && !supportedProtocolVersions.has(headerProtocolVersion)) {
    sendMcpProtocolError(
      res,
      req,
      "UnsupportedProtocolVersion",
      "Unsupported MCP protocol version",
      {
        protocol_version: headerProtocolVersion,
        supported: [...supportedProtocolVersions],
      },
    );
    return { ok: false, effectiveVersion: "legacy" };
  }

  const bodyParams =
    isPlainObject(req.body) && isPlainObject(req.body.params) ? req.body.params : undefined;
  const bodyMeta = bodyParams && isPlainObject(bodyParams._meta) ? bodyParams._meta : undefined;
  const metaProtocolVersionRaw = bodyMeta?.["io.modelcontextprotocol/protocolVersion"];

  if (metaProtocolVersionRaw !== undefined) {
    if (
      typeof metaProtocolVersionRaw !== "string" ||
      !supportedProtocolVersions.has(metaProtocolVersionRaw)
    ) {
      sendMcpProtocolError(
        res,
        req,
        "UnsupportedProtocolVersion",
        "Unsupported MCP protocol version in params._meta",
        {
          meta_protocol_version: metaProtocolVersionRaw ?? null,
          supported: [...supportedProtocolVersions],
        },
      );
      return { ok: false, effectiveVersion: "legacy" };
    }
    if (headerProtocolVersion && headerProtocolVersion !== metaProtocolVersionRaw) {
      sendMcpProtocolError(
        res,
        req,
        "HeaderMismatch",
        "MCP-Protocol-Version header does not match params._meta['io.modelcontextprotocol/protocolVersion']",
        {
          header_protocol_version: headerProtocolVersion,
          meta_protocol_version: metaProtocolVersionRaw,
        },
      );
      return { ok: false, effectiveVersion: "legacy" };
    }
  }

  const is2026Request =
    headerProtocolVersion === STATELESS_2026_PROTOCOL_VERSION ||
    metaProtocolVersionRaw === STATELESS_2026_PROTOCOL_VERSION;

  if (is2026Request) {
    if (!isPlainObject(req.body)) {
      sendMcpProtocolError(
        res,
        req,
        "InvalidBatchRequest",
        "MCP 2026-07-28 requires a single JSON-RPC object body (batch arrays are not supported)",
      );
      return { ok: false, effectiveVersion: "2026-07-28" };
    }
    if (!headerProtocolVersion) {
      sendMcpProtocolError(
        res,
        req,
        "MissingRequiredHeader",
        "MCP-Protocol-Version header is required for MCP 2026-07-28 requests",
        { required_header: "MCP-Protocol-Version" },
      );
      return { ok: false, effectiveVersion: "2026-07-28" };
    }
    if (req.header("Mcp-Session-Id")) {
      sendMcpProtocolError(
        res,
        req,
        "StatelessProtocolViolation",
        "Mcp-Session-Id header was removed in stateless MCP 2026-07-28",
      );
      return { ok: false, effectiveVersion: "2026-07-28" };
    }
    const bodyMethod = readJsonRpcMethod(req.body);
    if (!bodyMethod) {
      sendMcpProtocolError(res, req, "InvalidJsonRpcRequest", "JSON-RPC method is required");
      return { ok: false, effectiveVersion: "2026-07-28" };
    }
    if (bodyMethod === "initialize" || bodyMethod === "notifications/initialized") {
      sendMcpProtocolError(
        res,
        req,
        "StatelessProtocolViolation",
        `${bodyMethod} handshake was removed in stateless MCP 2026-07-28`,
      );
      return { ok: false, effectiveVersion: "2026-07-28" };
    }
    if (metaProtocolVersionRaw === undefined) {
      sendMcpProtocolError(
        res,
        req,
        "MissingProtocolMetadata",
        "MCP 2026-07-28 requests require params._meta['io.modelcontextprotocol/protocolVersion']",
      );
      return { ok: false, effectiveVersion: "2026-07-28" };
    }
    const clientInfo = bodyMeta?.["io.modelcontextprotocol/clientInfo"];
    if (clientInfo !== undefined) {
      if (
        !isPlainObject(clientInfo) ||
        !readNonEmptyString(clientInfo.name) ||
        typeof clientInfo.version !== "string"
      ) {
        sendMcpProtocolError(
          res,
          req,
          "InvalidProtocolMetadata",
          "Invalid io.modelcontextprotocol/clientInfo in params._meta",
        );
        return { ok: false, effectiveVersion: "2026-07-28" };
      }
    }
    const clientCapabilities = bodyMeta?.["io.modelcontextprotocol/clientCapabilities"];
    if (clientCapabilities !== undefined && !isPlainObject(clientCapabilities)) {
      sendMcpProtocolError(
        res,
        req,
        "InvalidProtocolMetadata",
        "Invalid io.modelcontextprotocol/clientCapabilities in params._meta",
      );
      return { ok: false, effectiveVersion: "2026-07-28" };
    }

    const headerMethod = req.header("Mcp-Method");
    if (!headerMethod) {
      sendMcpProtocolError(
        res,
        req,
        "MissingRequiredHeader",
        "Mcp-Method header is required for MCP 2026-07-28 HTTP requests",
        { required_header: "Mcp-Method" },
      );
      return { ok: false, effectiveVersion: "2026-07-28" };
    }
    if (headerMethod !== bodyMethod) {
      sendMcpProtocolError(
        res,
        req,
        "HeaderMismatch",
        "Mcp-Method header does not match JSON-RPC method",
        {
          header_method: headerMethod,
          body_method: bodyMethod,
        },
      );
      return { ok: false, effectiveVersion: "2026-07-28" };
    }

    const rawHeaderName = req.header("Mcp-Name");
    const expectedTarget = resolveExpectedMcpName(bodyMethod, req.body);
    if (expectedTarget.kind === "named") {
      if (!rawHeaderName) {
        sendMcpProtocolError(
          res,
          req,
          "MissingRequiredHeader",
          `Mcp-Name header is required for ${bodyMethod} in MCP 2026-07-28`,
          {
            required_header: "Mcp-Name",
            expected_source: expectedTarget.source,
          },
        );
        return { ok: false, effectiveVersion: "2026-07-28" };
      }
      const decodedHeaderName = decodeMcpNameHeader(rawHeaderName);
      if (!decodedHeaderName.ok) {
        sendMcpProtocolError(
          res,
          req,
          "HeaderMismatch",
          "Mcp-Name header contains malformed Base64 sentinel encoding",
          {
            header_name: rawHeaderName,
            expected_source: expectedTarget.source,
          },
        );
        return { ok: false, effectiveVersion: "2026-07-28" };
      }
      if (!expectedTarget.value || decodedHeaderName.value !== expectedTarget.value) {
        sendMcpProtocolError(
          res,
          req,
          "HeaderMismatch",
          `Mcp-Name header does not match JSON-RPC ${expectedTarget.source}`,
          {
            header_name: rawHeaderName,
            decoded_header_name: decodedHeaderName.value,
            body_target: expectedTarget.value ?? null,
            expected_source: expectedTarget.source,
          },
        );
        return { ok: false, effectiveVersion: "2026-07-28" };
      }
    } else if (rawHeaderName !== undefined) {
      sendMcpProtocolError(
        res,
        req,
        "HeaderMismatch",
        `Mcp-Name header must not be sent for unnamed method ${bodyMethod}`,
        {
          header_name: rawHeaderName,
          body_method: bodyMethod,
        },
      );
      return { ok: false, effectiveVersion: "2026-07-28" };
    }

    return { ok: true, effectiveVersion: "2026-07-28" };
  }

  // Legacy (2025-11-25 and earlier): Mcp-Method and Mcp-Name are optional, but validated when present
  const headerMethod = req.header("Mcp-Method");
  const rawHeaderName = req.header("Mcp-Name");
  if (!headerMethod && rawHeaderName === undefined) {
    return { ok: true, effectiveVersion: "legacy" };
  }

  const bodyMethod = readJsonRpcMethod(req.body);
  if (headerMethod && headerMethod !== bodyMethod) {
    sendMcpProtocolError(
      res,
      req,
      "HeaderMismatch",
      "Mcp-Method header does not match JSON-RPC method",
      {
        header_method: headerMethod,
        body_method: bodyMethod ?? null,
      },
    );
    return { ok: false, effectiveVersion: "legacy" };
  }

  if (rawHeaderName !== undefined) {
    const decodedHeaderName = decodeMcpNameHeader(rawHeaderName);
    if (!decodedHeaderName.ok) {
      sendMcpProtocolError(
        res,
        req,
        "HeaderMismatch",
        "Mcp-Name header contains malformed Base64 sentinel encoding",
        { header_name: rawHeaderName },
      );
      return { ok: false, effectiveVersion: "legacy" };
    }
    const expectedTarget = resolveExpectedMcpName(bodyMethod, req.body);
    if (expectedTarget.kind === "named") {
      if (!expectedTarget.value || decodedHeaderName.value !== expectedTarget.value) {
        sendMcpProtocolError(
          res,
          req,
          "HeaderMismatch",
          `Mcp-Name header does not match JSON-RPC ${expectedTarget.source}`,
          {
            header_name: rawHeaderName,
            decoded_header_name: decodedHeaderName.value,
            body_name:
              expectedTarget.source === "params.name" ? (expectedTarget.value ?? null) : null,
            body_target: expectedTarget.value ?? null,
            expected_source: expectedTarget.source,
          },
        );
        return { ok: false, effectiveVersion: "legacy" };
      }
    } else {
      sendMcpProtocolError(
        res,
        req,
        "HeaderMismatch",
        "Mcp-Name header does not match JSON-RPC params.name",
        {
          header_name: rawHeaderName,
          body_name: null,
        },
      );
      return { ok: false, effectiveVersion: "legacy" };
    }
  }

  return { ok: true, effectiveVersion: "legacy" };
}

function rewriteIncomingProtocolVersionHeader(req: Request, targetVersion: string): void {
  req.headers["mcp-protocol-version"] = targetVersion;
  if (Array.isArray(req.rawHeaders)) {
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      if (req.rawHeaders[i]?.toLowerCase() === "mcp-protocol-version") {
        req.rawHeaders[i + 1] = targetVersion;
      }
    }
  }
}

function toChunkBuffer(chunk: unknown, encoding?: BufferEncoding): Buffer {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }
  return Buffer.from(String(chunk), encoding ?? "utf8");
}

function install2026MethodNotFoundHttpStatusAdapter(res: Response): void {
  const origWriteHead = res.writeHead.bind(res);
  const origWrite = res.write.bind(res);
  const origEnd = res.end.bind(res);

  let intercepted = false;
  let pendingStatus = 200;
  let pendingMessage: string | undefined;
  let pendingHeaders: Parameters<Response["writeHead"]>[1] | undefined;
  const chunks: Buffer[] = [];

  res.writeHead = ((
    statusCode: number,
    reasonOrHeaders?: string | Parameters<Response["writeHead"]>[1],
    maybeHeaders?: Parameters<Response["writeHead"]>[1],
  ) => {
    const headersObj = typeof reasonOrHeaders === "string" ? maybeHeaders : reasonOrHeaders;
    const contentType =
      headersObj && !Array.isArray(headersObj)
        ? String(
            (headersObj as Record<string, unknown>)["content-type"] ??
              (headersObj as Record<string, unknown>)["Content-Type"] ??
              "",
          )
        : String(res.getHeader("content-type") ?? "");

    if (statusCode === 200 && contentType.toLowerCase().includes("application/json")) {
      intercepted = true;
      pendingStatus = statusCode;
      pendingMessage = typeof reasonOrHeaders === "string" ? reasonOrHeaders : undefined;
      pendingHeaders = headersObj;
      return res;
    }

    if (typeof reasonOrHeaders === "string") {
      return origWriteHead(statusCode, reasonOrHeaders, maybeHeaders);
    }
    return origWriteHead(statusCode, reasonOrHeaders);
  }) as Response["writeHead"];

  res.write = ((
    chunk: unknown,
    encodingOrCb?: BufferEncoding | ((error: Error | null | undefined) => void),
    cb?: (error: Error | null | undefined) => void,
  ) => {
    if (!intercepted) {
      if (typeof encodingOrCb === "function") {
        return origWrite(chunk, encodingOrCb);
      }
      if (encodingOrCb !== undefined) {
        return origWrite(chunk, encodingOrCb, cb);
      }
      return origWrite(chunk);
    }
    const enc = typeof encodingOrCb === "string" ? encodingOrCb : undefined;
    chunks.push(toChunkBuffer(chunk, enc));
    if (typeof encodingOrCb === "function") encodingOrCb(null);
    else if (typeof cb === "function") cb(null);
    return true;
  }) as Response["write"];

  res.end = ((chunk?: unknown, encodingOrCb?: BufferEncoding | (() => void), cb?: () => void) => {
    if (!intercepted) {
      if (typeof chunk === "function") return origEnd(chunk);
      if (typeof encodingOrCb === "function") return origEnd(chunk, encodingOrCb);
      if (encodingOrCb !== undefined) return origEnd(chunk, encodingOrCb, cb);
      return origEnd(chunk);
    }
    if (chunk !== undefined && typeof chunk !== "function") {
      const enc = typeof encodingOrCb === "string" ? encodingOrCb : undefined;
      chunks.push(toChunkBuffer(chunk, enc));
    }
    const payload = Buffer.concat(chunks);
    let finalStatus = pendingStatus;
    try {
      const parsed = JSON.parse(payload.toString("utf8")) as unknown;
      if (isPlainObject(parsed) && isPlainObject(parsed.error) && parsed.error.code === -32601) {
        finalStatus = 404;
      }
    } catch {
      // Preserve original status if payload is not JSON
    }
    if (pendingMessage !== undefined) {
      origWriteHead(finalStatus, pendingMessage, pendingHeaders);
    } else if (pendingHeaders !== undefined) {
      origWriteHead(finalStatus, pendingHeaders);
    } else {
      origWriteHead(finalStatus);
    }
    const doneCb: (() => void) | undefined =
      typeof chunk === "function"
        ? (chunk as () => void)
        : typeof encodingOrCb === "function"
          ? encodingOrCb
          : cb;
    return doneCb ? origEnd(payload, doneCb) : origEnd(payload);
  }) as Response["end"];
}

function resolveOAuthSecret(): string | undefined {
  const explicit = process.env.JP_BIDS_OAUTH_SECRET;
  if (explicit) return explicit;
  if (isProductionEnvironment()) {
    throw new Error(
      "JP_BIDS_OAUTH_SECRET is required in production. Refusing to start with an ephemeral OAuth signing key.",
    );
  }
  const generated = randomBytes(32).toString("hex");
  console.error("[info] JP_BIDS_OAUTH_SECRET is unset. Generated an ephemeral local-dev key.");
  return generated;
}

function assertProductionConfig(allowedOrigins: ReadonlySet<string>): void {
  if (!isProductionEnvironment()) return;

  if (!process.env.JP_BIDS_OAUTH_SECRET) {
    throw new Error(
      "JP_BIDS_OAUTH_SECRET is required in production. Refusing to start with an ephemeral OAuth signing key.",
    );
  }
  if (!process.env.JP_BIDS_BASE_URL) {
    throw new Error("JP_BIDS_BASE_URL is required in production.");
  }
  if (allowedOrigins.size === 0) {
    throw new Error(
      "ALLOWED_ORIGINS is required in production. Refusing to expose /mcp to all browser origins.",
    );
  }
  if (!process.env.JP_BIDS_PDF_ALLOWED_HOSTS) {
    throw new Error(
      "JP_BIDS_PDF_ALLOWED_HOSTS is required in production to avoid unrestricted document-fetch egress.",
    );
  }
}

function getBaseUrl(req: Request): string {
  if (process.env.JP_BIDS_BASE_URL) return process.env.JP_BIDS_BASE_URL;
  const proto = req.header("x-forwarded-proto") || req.protocol;
  const host = req.header("x-forwarded-host") || req.header("host") || "localhost:8080";
  return `${proto}://${host}`;
}

export function createHttpApp(): express.Express {
  const app = express();
  app.set("trust proxy", 1);
  const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  assertProductionConfig(allowedOrigins);
  const proApiKeys = parseProApiKeys(process.env.JP_BIDS_PRO_API_KEYS);
  const oauthSecret = resolveOAuthSecret();
  const oauthStore = oauthSecret ? createOAuthStoreFromEnv() : undefined;
  const sharedKkjClient = new KkjClient({
    rateLimitPerSecond: parsePositiveNumberEnv(
      process.env.JP_BIDS_RATE_LIMIT_PER_SECOND ?? process.env.KOKO_CALL_RATE_LIMIT_PER_SECOND,
      1,
    ),
    timeoutMs: parsePositiveNumberEnv(process.env.JP_BIDS_KKJ_TIMEOUT_MS, 15_000),
    rememberRecentBids: false,
  });

  const startupProfile = resolveServerProfile();
  if (startupProfile !== "public_mvp" && proApiKeys.size === 0 && process.env.K_SERVICE) {
    console.error(
      "[warning] JP_BIDS_PRO_API_KEYS is unset. All HTTP requests will be treated as Pro tier. Set this variable in production to enable Free/Pro tier separation.",
    );
  }

  app.use(express.json({ limit: "1mb" }));
  app.use(cors({ origin: allowedOrigins.size === 0 ? true : [...allowedOrigins] }));
  app.use(validateLocalHostHeader(allowedOrigins));
  app.use(validateOrigin(allowedOrigins));

  if (oauthSecret) {
    app.use(createOAuthRouterWithStore(oauthSecret, oauthStore ?? createOAuthStoreFromEnv()));
  }

  app.use("/.well-known", express.static("public/.well-known"));

  // OpenAI ChatGPT Apps ドメイン所有確認用（提出フォームがトークンを発行した時だけ設定する）
  // OpenAI ChatGPT Apps domain ownership challenge (only set when the submission form issues a token)
  // Tantangan verifikasi domain OpenAI ChatGPT Apps (hanya diatur saat formulir submission menerbitkan token)
  app.get("/.well-known/openai-apps-challenge", (_req, res) => {
    const token = process.env.OPENAI_APPS_CHALLENGE_TOKEN;
    if (!token) {
      res.status(404).type("text/plain").send("not configured");
      return;
    }
    res.status(200).type("text/plain").send(token);
  });

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

  // 利用統計: 運用者が疎通と負荷傾向を確認するエンドポイント
  // Usage stats: endpoint for operators to verify service health and traffic trends
  // Statistik penggunaan: endpoint bagi operator untuk memverifikasi kesehatan layanan dan tren trafik
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

  app.delete("/mcp", (_req, res) => {
    res.status(405).json({ error: "Session termination is not enabled for this stateless server" });
  });

  app.post("/mcp", async (req, res) => {
    const contract = validateMcpProtocolAndRoutingContract(req, res);
    if (!contract.ok) return;

    // OAuth有効時: Bearerトークンがなければ401を返してOAuthフローを起動する
    // When OAuth is enabled: return 401 without Bearer token to trigger OAuth flow
    // Saat OAuth aktif: kembalikan 401 tanpa Bearer token untuk memulai alur OAuth
    const authHeader = req.header("Authorization");
    const base = getBaseUrl(req);

    if (oauthSecret && !authHeader) {
      res
        .status(401)
        .set(
          "WWW-Authenticate",
          `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/mcp"`,
        )
        .json({ error: "unauthorized" });
      return;
    }

    const authResult = authenticateMcpRequest(authHeader, {
      serviceKeys: proApiKeys,
      oauthSecret,
      baseUrl: base,
    });

    if (authResult.status === "missing_header") {
      res
        .status(401)
        .set(
          "WWW-Authenticate",
          `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/mcp"`,
        )
        .json({ error: "unauthorized" });
      return;
    }

    if (authResult.status === "invalid_token" || authResult.status === "invalid_format") {
      res
        .status(401)
        .set(
          "WWW-Authenticate",
          'Bearer error="invalid_token", error_description="The access token is invalid or expired"',
        )
        .json({ error: "invalid_token" });
      return;
    }

    if (authResult.status === "insufficient_scope") {
      res
        .status(403)
        .set("WWW-Authenticate", 'Bearer error="insufficient_scope", scope="mcp:read"')
        .json({ error: "insufficient_scope" });
      return;
    }

    const isOAuthAuthenticated = authResult.subject.kind === "oauth_user";
    const tier = isOAuthAuthenticated
      ? parseOAuthTier(proApiKeys)
      : parseTier(authHeader, proApiKeys);

    const resolvedProfile = resolveServerProfile();
    const activeProfile: ServerProfile =
      resolvedProfile === "public_mvp"
        ? "public_mvp"
        : tier === "free"
          ? "public_mvp"
          : "full_local";
    const server = createJpBidsServer({
      kkjClient: sharedKkjClient,
      profile: activeProfile,
      tier,
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
      if (contract.effectiveVersion === "2026-07-28") {
        // @modelcontextprotocol/sdk 1.32.2 implements MCP 2025-11-25 natively.
        // After enforcing the 2026-07-28 stateless request contract above, adapt the
        // internal SDK header to 2025-11-25, emit MCP-Protocol-Version: 2026-07-28,
        // and map JSON-RPC -32601 (Method not found) to HTTP 404.
        rewriteIncomingProtocolVersionHeader(req, "2025-11-25");
        res.setHeader("MCP-Protocol-Version", STATELESS_2026_PROTOCOL_VERSION);
        install2026MethodNotFoundHttpStatusAdapter(res);
      }
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

function parseOAuthTier(proApiKeys: ReadonlySet<string>): "free" | "pro" {
  // ベータ期間中はOAuth利用者にもPro相当の公開ベータ体験を提供する
  // During beta, OAuth users receive the public Pro-equivalent beta experience
  // Selama beta, pengguna OAuth mendapat pengalaman beta setara Pro
  return parseTier(undefined, proApiKeys);
}

export async function startHttpServer(): Promise<void> {
  const app = createHttpApp();
  const port = parsePortEnv(process.env.PORT, 8080);
  const profile = getActiveProfile();
  const host = process.env.HTTP_HOST ?? (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");

  if (profile === "full_local" && host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`full_local profile must bind strictly to 127.0.0.1. Requested host: ${host}`);
  }
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
