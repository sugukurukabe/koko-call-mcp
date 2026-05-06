// LLM フォールバックルーター — キーワードマッチが 0 件のときだけ Anthropic Haiku に問い合わせる（opt-in）
// LLM fallback router — query Anthropic Haiku only when keyword score is 0 (opt-in)
// Router fallback LLM — query Anthropic Haiku hanya saat skor kata kunci 0 (opt-in)
//
// 有効化: GATEWAY_ROUTER_LLM_FALLBACK=true, ANTHROPIC_API_KEY=<key>
// Enable: GATEWAY_ROUTER_LLM_FALLBACK=true, ANTHROPIC_API_KEY=<key>
// Aktifkan: GATEWAY_ROUTER_LLM_FALLBACK=true, ANTHROPIC_API_KEY=<key>

import { createHash } from "node:crypto";
import { get as cacheGet, set as cacheSet } from "../cache/tool-cache.js";
import type { ChildMcpServer } from "../registry/schema.js";
import type { RouterResult } from "./smart-router.js";

// LLM フォールバックのキャッシュ TTL: 1 時間
// LLM fallback cache TTL: 1 hour
// TTL cache fallback LLM: 1 jam
const LLM_CACHE_TTL_SECONDS = 3600;

/**
 * クエリ文字列の SHA-256 を使ったキャッシュキーを生成する
 * Generate cache key using SHA-256 of query string
 * Menghasilkan kunci cache menggunakan SHA-256 dari string kueri
 */
function buildLlmCacheKey(query: string): string {
  const hash = createHash("sha256").update(query).digest("hex").slice(0, 16);
  return `__llm_route__:${hash}`;
}

/**
 * Anthropic Haiku に最適なサーバーを問い合わせる
 * Query Anthropic Haiku for the best matching server
 * Tanya Anthropic Haiku untuk server yang paling cocok
 *
 * GATEWAY_ROUTER_LLM_FALLBACK が true でない場合は null を返す（no-op）
 * Returns null (no-op) if GATEWAY_ROUTER_LLM_FALLBACK is not true
 * Mengembalikan null (no-op) jika GATEWAY_ROUTER_LLM_FALLBACK bukan true
 */
export async function routeViaLlm(
  query: string,
  servers: readonly ChildMcpServer[],
): Promise<RouterResult | null> {
  if (process.env.GATEWAY_ROUTER_LLM_FALLBACK !== "true") {
    return null;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "[llm-fallback] ANTHROPIC_API_KEY not set. LLM routing disabled despite GATEWAY_ROUTER_LLM_FALLBACK=true.",
    );
    return null;
  }

  // キャッシュチェック（TTL 1 時間）
  // Cache check (TTL 1 hour)
  // Pemeriksaan cache (TTL 1 jam)
  const cacheKey = buildLlmCacheKey(query);
  const cached = cacheGet(cacheKey);
  if (cached !== null) {
    return cached as RouterResult;
  }

  const serverDescriptions = servers
    .map(
      (s) =>
        `- id: "${s.id}", name: "${s.display_name_en}", keywords: [${s.routing_keywords.slice(0, 6).join(", ")}]`,
    )
    .join("\n");

  const prompt =
    `You are a routing assistant for a Japanese MCP Gateway. ` +
    `Given the user query, select the single best server ID from the list below. ` +
    `Respond with ONLY the server ID string (e.g. "jp-bids"), nothing else. ` +
    `If no server matches, respond with "null".\n\n` +
    `Available servers:\n${serverDescriptions}\n\n` +
    `User query: "${query}"`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 32,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error(`[llm-fallback] Anthropic API error: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const rawText = data.content.find((c) => c.type === "text")?.text?.trim() ?? "";
    const serverId = rawText.replace(/^"(.+)"$/, "$1");

    if (!serverId || serverId === "null") {
      const result: RouterResult | null = null;
      cacheSet(cacheKey, result, LLM_CACHE_TTL_SECONDS);
      return null;
    }

    const matched = servers.find((s) => s.id === serverId);
    if (!matched) {
      console.error(`[llm-fallback] LLM returned unknown server ID: "${serverId}"`);
      return null;
    }

    const result: RouterResult = {
      serverId: matched.id,
      score: 1,
      reason: `llm-fallback: Claude Haiku selected "${matched.id}" for query`,
    };

    // キャッシュに保存
    // Save to cache
    // Simpan ke cache
    cacheSet(cacheKey, result, LLM_CACHE_TTL_SECONDS);
    return result;
  } catch (e) {
    console.error(
      `[llm-fallback] Error calling Anthropic API: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
}
