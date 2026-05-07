// 子 MCP への Streamable HTTP Proxy 呼び出し
// Streamable HTTP Proxy call to child MCPs
// Panggilan Proxy HTTP Streamable ke MCP anak

import * as toolCache from "../cache/tool-cache.js";
import { ProxyError } from "../lib/errors.js";
import type { ChildMcpServer } from "../registry/schema.js";

export interface ProxyCallParams {
  server: ChildMcpServer;
  toolName: string;
  toolArguments: Record<string, unknown>;
  bearerToken?: string | undefined;
  // bearer_oauth サーバー（freee・MoneyForward 等）に渡す OAuth アクセストークン
  // OAuth access token for bearer_oauth servers (freee, MoneyForward, etc.)
  // Token akses OAuth untuk server bearer_oauth (freee, MoneyForward, dll.)
  oauthToken?: string | undefined;
  // キャッシュをバイパスするか（デフォルト: false）
  // Whether to bypass cache (default: false)
  // Apakah melewati cache (default: false)
  bypassCache?: boolean | undefined;
}

export interface ProxyCallResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown> | undefined;
  isError?: boolean | undefined;
}

/**
 * 子 MCP サーバーのツールを JSON-RPC 2.0 で呼び出す（TTL キャッシュ付き）
 * Call a child MCP server's tool via JSON-RPC 2.0 (with TTL cache)
 * Memanggil alat server MCP anak melalui JSON-RPC 2.0 (dengan cache TTL)
 */
export async function proxyToolCall(params: ProxyCallParams): Promise<ProxyCallResult> {
  const { server, toolName, toolArguments, bearerToken, oauthToken, bypassCache = false } = params;

  // キャッシュ可否を判定: financial サーバーはキャッシュ禁止、TTL 未設定もキャッシュ禁止
  // Check cacheability: financial servers are never cached; servers without cache_ttl_seconds are not cached
  // Periksa kemampuan cache: server finansial tidak pernah di-cache; server tanpa cache_ttl_seconds tidak di-cache
  const ttl = server.cache_ttl_seconds;
  const isCacheable =
    !bypassCache && ttl !== undefined && ttl > 0 && server.risk_level !== "financial";

  if (isCacheable && ttl !== undefined) {
    const cacheKey = toolCache.buildCacheKey(server.id, toolName, toolArguments);
    const cached = toolCache.get(cacheKey);
    if (cached !== null) {
      toolCache.recordHit();
      return cached as ProxyCallResult;
    }
    toolCache.recordMiss();

    const result = await fetchFromChild({
      server,
      toolName,
      toolArguments,
      bearerToken,
      oauthToken,
    });
    toolCache.set(cacheKey, result, ttl);
    return result;
  }

  return fetchFromChild({ server, toolName, toolArguments, bearerToken, oauthToken });
}

/**
 * キャッシュなしで子 MCP を直接呼び出す内部関数
 * Internal function to call child MCP directly without cache
 * Fungsi internal untuk memanggil MCP anak langsung tanpa cache
 */
async function fetchFromChild(
  params: Omit<ProxyCallParams, "bypassCache">,
): Promise<ProxyCallResult> {
  const { server, toolName, toolArguments, bearerToken, oauthToken } = params;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "MCP-Protocol-Version": "2025-11-25",
    Accept: "application/json, text/event-stream",
  };

  if (server.auth_type === "bearer_apikey" && bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  } else if (server.auth_type === "bearer_oauth" && oauthToken) {
    headers.Authorization = `Bearer ${oauthToken}`;
  }

  // 子 MCP への tools/call JSON-RPC リクエスト
  // JSON-RPC request for tools/call to child MCP
  // Permintaan JSON-RPC untuk tools/call ke MCP anak
  const jsonRpcRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: toolName,
      arguments: toolArguments,
    },
  };

  let response: Response;
  try {
    response = await fetch(server.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(jsonRpcRequest),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw new ProxyError(server.id, e instanceof Error ? e.message : String(e));
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "(unreadable)");
    throw new ProxyError(server.id, `HTTP ${response.status}: ${body}`);
  }

  let data: unknown;
  try {
    data = await parseMcpHttpResponse(response);
  } catch (e) {
    throw new ProxyError(
      server.id,
      `Failed to parse JSON response: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  return extractToolResult(data, server.id, toolName);
}

async function parseMcpHttpResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  const trimmed = text.trim();

  if (
    contentType.includes("text/event-stream") ||
    trimmed.startsWith("event:") ||
    text.includes("\ndata:")
  ) {
    const dataLines = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .filter((line) => line.length > 0 && line !== "[DONE]");

    if (dataLines.length === 0) {
      throw new Error("SSE response did not contain data lines");
    }
    return JSON.parse(dataLines[dataLines.length - 1] ?? "{}");
  }

  return JSON.parse(trimmed);
}

function extractToolResult(data: unknown, serverId: string, toolName: string): ProxyCallResult {
  if (typeof data !== "object" || data === null) {
    throw new ProxyError(serverId, `Unexpected response shape for tool ${toolName}`);
  }

  const rpc = data as Record<string, unknown>;

  if ("error" in rpc) {
    const err = rpc.error as Record<string, unknown>;
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: err.message ?? "Unknown error from child MCP",
            server: serverId,
            tool: toolName,
          }),
        },
      ],
      isError: true,
    };
  }

  if ("result" in rpc) {
    const result = rpc.result as Record<string, unknown>;
    if (Array.isArray(result.content)) {
      return {
        content: (result.content as Array<{ type: string; text: string }>).map((c) => ({
          type: "text" as const,
          text: c.text ?? JSON.stringify(c),
        })),
        structuredContent:
          typeof result.structuredContent === "object" && result.structuredContent !== null
            ? (result.structuredContent as Record<string, unknown>)
            : undefined,
      };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  }

  throw new ProxyError(
    serverId,
    `Missing result or error in JSON-RPC response for tool ${toolName}`,
  );
}

/**
 * 子 MCP のツール一覧を取得する
 * Fetch tool list from child MCP
 * Ambil daftar alat dari MCP anak
 */
export async function fetchChildToolList(
  server: ChildMcpServer,
  bearerToken?: string,
  oauthToken?: string,
): Promise<Array<{ name: string; description?: string }>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "MCP-Protocol-Version": "2025-11-25",
    Accept: "application/json, text/event-stream",
  };

  if (server.auth_type === "bearer_apikey" && bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  } else if (server.auth_type === "bearer_oauth" && oauthToken) {
    headers.Authorization = `Bearer ${oauthToken}`;
  }

  const jsonRpcRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {},
  };

  try {
    const response = await fetch(server.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(jsonRpcRequest),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return [];
    const data = (await parseMcpHttpResponse(response)) as Record<string, unknown>;
    const result = data.result as Record<string, unknown> | undefined;
    const tools = result?.tools;
    if (!Array.isArray(tools)) return [];
    return tools as Array<{ name: string; description?: string }>;
  } catch {
    return [];
  }
}
