import { createHash, timingSafeEqual } from "node:crypto";
import type { Response } from "express";

export const EDGE_AUTH_HEADER = "x-jpbids-edge-auth";
export const EDGE_CLIENT_IP_HASH_HEADER = "x-jpbids-client-ip-hash";
export const TELEMETRY_RPC_METHOD_HEADER = "X-Jpbids-Rpc-Method";
export const TELEMETRY_TARGET_NAME_HEADER = "X-Jpbids-Target-Name";
export const TELEMETRY_MODE_HEADER = "X-Jpbids-Mode";
export const TELEMETRY_OUTCOME_HEADER = "X-Jpbids-Outcome";
export const TELEMETRY_RETURNED_COUNT_HEADER = "X-Jpbids-Returned-Count";

const SAFE_HEADER_TOKEN = /^[A-Za-z0-9_.:/@-]{1,128}$/;
const VALID_IP_HASH = /^[a-f0-9]{16,64}$/i;

export type McpExecutionMode = "search" | "selection_bid_refs" | "bid_ref" | "bid_key" | "n/a";

export type McpTelemetryOutcome =
  | "ok"
  | "zero_hits"
  | "user_input_error"
  | "upstream_kkj_error"
  | "protocol_error";

export interface McpRequestTelemetry {
  rpcMethod: string;
  targetName: string;
  executionMode: McpExecutionMode;
}

export interface McpResponseTelemetry {
  outcome: McpTelemetryOutcome;
  returnedCount: number | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeHeaderToken(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return SAFE_HEADER_TOKEN.test(value) ? value : fallback;
}

function sha256Buffer(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function isVerifiedEdgeAuth(
  provided: string | undefined,
  expectedSecret: string | undefined,
): boolean {
  if (!provided || !expectedSecret || expectedSecret.trim().length === 0) {
    return false;
  }
  return timingSafeEqual(sha256Buffer(provided), sha256Buffer(expectedSecret));
}

export interface RateLimitRequestLike {
  ip?: string | undefined;
  header(name: string): string | string[] | undefined;
}

export function resolveOAuthRateLimitKey(
  req: RateLimitRequestLike,
  expectedSecret: string | undefined = process.env.JP_BIDS_EDGE_AUTH_SECRET,
): string {
  const rawEdgeAuth = req.header(EDGE_AUTH_HEADER);
  const rawIpHash = req.header(EDGE_CLIENT_IP_HASH_HEADER);
  const edgeAuth = typeof rawEdgeAuth === "string" ? rawEdgeAuth : undefined;
  const ipHash = typeof rawIpHash === "string" ? rawIpHash : undefined;
  if (isVerifiedEdgeAuth(edgeAuth, expectedSecret) && ipHash && VALID_IP_HASH.test(ipHash)) {
    return `oauth:edge:${ipHash.toLowerCase()}`;
  }
  return `oauth:${req.ip ?? "unknown"}`;
}

export function extractMcpRequestTelemetry(body: unknown): McpRequestTelemetry {
  if (!isPlainObject(body)) {
    return { rpcMethod: "invalid", targetName: "none", executionMode: "n/a" };
  }
  const rawMethod = typeof body.method === "string" ? body.method : "unknown";
  const rpcMethod = sanitizeHeaderToken(rawMethod, "unknown");
  const params = isPlainObject(body.params) ? body.params : undefined;

  let rawTarget: string | undefined;
  if (typeof params?.name === "string") {
    rawTarget = params.name;
  } else if (typeof params?.uri === "string") {
    rawTarget = params.uri;
  }
  const targetName = sanitizeHeaderToken(rawTarget, "none");

  let executionMode: McpExecutionMode = "n/a";
  if (rpcMethod === "tools/call" && isPlainObject(params?.arguments)) {
    const args = params.arguments;
    if (Array.isArray(args.bid_refs) && args.bid_refs.length > 0) {
      executionMode = "selection_bid_refs";
    } else if (typeof args.bid_ref === "string" && args.bid_ref.length > 0) {
      executionMode = "bid_ref";
    } else if (typeof args.key === "string" && args.key.length > 0) {
      executionMode = "bid_key";
    } else {
      executionMode = "search";
    }
  }

  return { rpcMethod, targetName, executionMode };
}

function extractReturnedCount(structured: Record<string, unknown>): number | null {
  for (const field of ["bids", "cards", "ranked", "rows", "notices"]) {
    const value = structured[field];
    if (Array.isArray(value)) {
      return value.length;
    }
  }
  if (typeof structured.returnedCount === "number" && Number.isFinite(structured.returnedCount)) {
    return structured.returnedCount;
  }
  if (typeof structured.count === "number" && Number.isFinite(structured.count)) {
    return structured.count;
  }
  return null;
}

export function classifyMcpResponseTelemetry(payload: unknown): McpResponseTelemetry {
  if (!isPlainObject(payload)) {
    return { outcome: "protocol_error", returnedCount: null };
  }
  if (isPlainObject(payload.error)) {
    return { outcome: "protocol_error", returnedCount: null };
  }
  const result = isPlainObject(payload.result) ? payload.result : undefined;
  if (!result) {
    return { outcome: "ok", returnedCount: null };
  }
  if (result.isError === true) {
    const content = Array.isArray(result.content) ? result.content : [];
    const firstText = content
      .map((item) => (isPlainObject(item) && typeof item.text === "string" ? item.text : ""))
      .join(" ");
    if (
      firstText.includes("kkj.go.jp") ||
      firstText.includes("KKJ portal") ||
      firstText.includes("HTTP 5")
    ) {
      return { outcome: "upstream_kkj_error", returnedCount: 0 };
    }
    return { outcome: "user_input_error", returnedCount: 0 };
  }

  const structured = isPlainObject(result.structuredContent) ? result.structuredContent : undefined;
  if (structured) {
    const returnedCount = extractReturnedCount(structured);
    if (returnedCount === 0) {
      return { outcome: "zero_hits", returnedCount: 0 };
    }
    return { outcome: "ok", returnedCount };
  }

  return { outcome: "ok", returnedCount: null };
}

function toBuffer(chunk: unknown, encoding?: BufferEncoding): Buffer {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }
  return Buffer.from(String(chunk), encoding ?? "utf8");
}

export function installEdgeTelemetryResponseAdapter(
  res: Response,
  reqTelemetry: McpRequestTelemetry,
): void {
  res.setHeader(TELEMETRY_RPC_METHOD_HEADER, reqTelemetry.rpcMethod);
  res.setHeader(TELEMETRY_TARGET_NAME_HEADER, reqTelemetry.targetName);
  res.setHeader(TELEMETRY_MODE_HEADER, reqTelemetry.executionMode);

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

    if (contentType.toLowerCase().includes("application/json")) {
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
      if (typeof encodingOrCb === "function") return origWrite(chunk, encodingOrCb);
      if (encodingOrCb !== undefined) return origWrite(chunk, encodingOrCb, cb);
      return origWrite(chunk);
    }
    const enc = typeof encodingOrCb === "string" ? encodingOrCb : undefined;
    chunks.push(toBuffer(chunk, enc));
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
      chunks.push(toBuffer(chunk, enc));
    }
    const payload = Buffer.concat(chunks);
    try {
      const parsed = JSON.parse(payload.toString("utf8")) as unknown;
      const responseTelemetry = classifyMcpResponseTelemetry(parsed);
      res.setHeader(TELEMETRY_OUTCOME_HEADER, responseTelemetry.outcome);
      if (responseTelemetry.returnedCount !== null) {
        res.setHeader(TELEMETRY_RETURNED_COUNT_HEADER, String(responseTelemetry.returnedCount));
      }
    } catch {
      res.setHeader(TELEMETRY_OUTCOME_HEADER, "protocol_error");
    }

    if (pendingMessage !== undefined) {
      origWriteHead(pendingStatus, pendingMessage, pendingHeaders);
    } else if (pendingHeaders !== undefined) {
      origWriteHead(pendingStatus, pendingHeaders);
    } else {
      origWriteHead(pendingStatus);
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
