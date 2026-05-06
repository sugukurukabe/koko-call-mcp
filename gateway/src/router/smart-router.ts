// Smart Router — キーワードスコアリング + LLM フォールバックによるルーティング（v0.2）
// Smart Router — Keyword scoring + LLM fallback routing (v0.2)
// Smart Router — Perutean berbasis penilaian kata kunci + fallback LLM (v0.2)

import type { ChildMcpServer, RiskLevel } from "../registry/schema.js";
import { routeViaLlm } from "./llm-fallback.js";

export interface RouterContext {
  query: string;
  explicitServerId?: string;
}

export interface RouterResult {
  serverId: string;
  score: number;
  reason: string;
}

const RISK_PRIORITY: Record<RiskLevel, number> = {
  read_only: 0,
  read_write: 1,
  financial: 2,
};

/**
 * クエリテキストに対してキーワードマッチング数でスコアを計算し、最適なサーバーを選択する。
 * スコアが 0 の場合、GATEWAY_ROUTER_LLM_FALLBACK=true のとき LLM に問い合わせる（ADR-0020）。
 *
 * Score each server by keyword matches and select the best match.
 * When score is 0, query LLM if GATEWAY_ROUTER_LLM_FALLBACK=true (ADR-0020).
 *
 * Menilai setiap server berdasarkan kecocokan kata kunci dan memilih yang terbaik.
 * Saat skor 0, tanya LLM jika GATEWAY_ROUTER_LLM_FALLBACK=true (ADR-0020).
 */
export async function route(
  context: RouterContext,
  servers: readonly ChildMcpServer[],
): Promise<RouterResult | null> {
  if (servers.length === 0) return null;

  // 明示指定があれば無条件で使う
  // If server_id is explicitly specified, use it unconditionally
  // Jika server_id ditentukan secara eksplisit, gunakan tanpa syarat
  if (context.explicitServerId) {
    const found = servers.find((s) => s.id === context.explicitServerId);
    if (found) {
      return {
        serverId: found.id,
        score: 1000,
        reason: `explicit server_id: ${found.id}`,
      };
    }
    return null;
  }

  const queryLower = context.query.toLowerCase();

  const scored = servers.map((server) => {
    const matchCount = server.routing_keywords.filter((kw) =>
      queryLower.includes(kw.toLowerCase()),
    ).length;
    return { server, score: matchCount };
  });

  const maxScore = Math.max(...scored.map((s) => s.score));

  // スコア 0 のとき LLM フォールバックを試みる（opt-in、ADR-0020）
  // When score is 0, try LLM fallback (opt-in, ADR-0020)
  // Saat skor 0, coba fallback LLM (opt-in, ADR-0020)
  if (maxScore === 0) {
    return routeViaLlm(context.query, servers);
  }

  const topCandidates = scored.filter((s) => s.score === maxScore);

  // スコア同点の場合は risk_level が低いサーバーを優先する
  // When tied, prefer the server with lower risk_level
  // Saat seri, utamakan server dengan risk_level lebih rendah
  topCandidates.sort(
    (a, b) => RISK_PRIORITY[a.server.risk_level] - RISK_PRIORITY[b.server.risk_level],
  );

  const winner = topCandidates[0];
  if (!winner) return null;

  return {
    serverId: winner.server.id,
    score: winner.score,
    reason: `keyword match: ${winner.score} keyword(s) matched in "${winner.server.id}"`,
  };
}
