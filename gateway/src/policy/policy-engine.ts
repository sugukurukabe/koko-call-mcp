// Policy Engine — allowlist / risk_level / rate limit の判定
// Policy Engine — allowlist / risk_level / rate limit enforcement
// Mesin Kebijakan — penegakan allowlist / risk_level / rate limit

import type { Tier } from "../lib/auth.js";
import type { ChildMcpServer } from "../registry/schema.js";
import { verify } from "./approval-token.js";

export type PolicyDecision = "allowed" | "denied" | "rate_limited";

export interface PolicyResult {
  decision: PolicyDecision;
  reason: string;
}

// サーバーごとのリクエスト履歴（rate limit 用）
// Per-server request history for rate limiting
// Riwayat permintaan per server untuk rate limiting
const requestTimestamps = new Map<string, number[]>();

/**
 * Rate limit を評価する（1秒あたりのリクエスト数）
 * Evaluate rate limit (requests per second)
 * Evaluasi rate limit (permintaan per detik)
 */
function checkRateLimit(serverId: string, limitPerSecond: number): boolean {
  const now = Date.now();
  const windowStart = now - 1000;
  const timestamps = requestTimestamps.get(serverId) ?? [];
  const recent = timestamps.filter((t) => t > windowStart);
  if (recent.length >= limitPerSecond) return false;
  recent.push(now);
  requestTimestamps.set(serverId, recent);
  return true;
}

/**
 * ツール呼び出しのポリシーを評価する
 * Evaluate policy for a tool call
 * Evaluasi kebijakan untuk panggilan alat
 */
export function evaluate(params: {
  server: ChildMcpServer;
  toolName: string;
  tier: Tier;
  isOAuthAuthenticated: boolean;
  rateLimitPerSecond?: number;
  // required_approval 検証用の HMAC トークン（ADR-0019）/ HMAC token for required_approval (ADR-0019)
  approvalToken?: string;
  toolArguments?: Record<string, unknown>;
  // compliance_check 検証用のコンテキスト（ADR-0019）/ Context for compliance_check (ADR-0019)
  complianceContext?: Record<string, boolean>;
}): PolicyResult {
  const {
    server,
    toolName,
    tier,
    isOAuthAuthenticated,
    rateLimitPerSecond = 1,
    approvalToken,
    toolArguments = {},
    complianceContext = {},
  } = params;

  // financial リスクのサーバーは OAuth 認証が必須
  // Financial risk servers require OAuth authentication
  // Server risiko finansial memerlukan autentikasi OAuth
  if (server.risk_level === "financial" && !isOAuthAuthenticated) {
    return {
      decision: "denied",
      reason: `Server "${server.id}" (risk_level: financial) requires OAuth authentication. API key is not sufficient.`,
    };
  }

  // Pro tier が必要なサーバーへの free tier からの呼び出しを拒否
  // Deny free tier from calling financial servers
  // Tolak tier gratis memanggil server finansial
  if (server.risk_level === "financial" && tier === "free") {
    return {
      decision: "denied",
      reason: `Server "${server.id}" requires Pro tier. Upgrade to Pro to access financial data.`,
    };
  }

  // Tool allowlist チェック（空 = 全許可）
  // Tool allowlist check (empty = allow all)
  // Pemeriksaan allowlist alat (kosong = izinkan semua)
  if (server.tool_allowlist.length > 0 && !server.tool_allowlist.includes(toolName)) {
    return {
      decision: "denied",
      reason: `Tool "${toolName}" is not in the allowlist for server "${server.id}". Allowed tools: ${server.tool_allowlist.join(", ")}`,
    };
  }

  // Rate limit チェック
  // Rate limit check
  // Pemeriksaan rate limit
  if (!checkRateLimit(server.id, rateLimitPerSecond)) {
    return {
      decision: "rate_limited",
      reason: `Rate limit exceeded for server "${server.id}". Max ${rateLimitPerSecond} request(s) per second.`,
    };
  }

  // ツール単位ポリシーの評価（ADR-0019）
  // Per-tool policy evaluation (ADR-0019)
  // Evaluasi kebijakan per alat (ADR-0019)
  const toolPolicy = server.tool_policies?.[toolName];
  if (toolPolicy) {
    // required_approval チェック
    // required_approval check
    // Pemeriksaan required_approval
    if (toolPolicy.required_approval) {
      if (!approvalToken) {
        return {
          decision: "denied",
          reason:
            `Tool "${toolName}" on server "${server.id}" requires an approval token. ` +
            `Call "issue_approval_token" first to obtain a signed token, then pass it as "approval_token".`,
        };
      }
      const verifyResult = verify(approvalToken, server.id, toolName, toolArguments);
      if (!verifyResult.ok) {
        return {
          decision: "denied",
          reason:
            `Approval token verification failed for tool "${toolName}": ${verifyResult.reason}. ` +
            `Obtain a fresh token via "issue_approval_token".`,
        };
      }
    }

    // compliance_check チェック
    // compliance_check check
    // Pemeriksaan compliance_check
    if (toolPolicy.compliance_check && toolPolicy.compliance_check.length > 0) {
      const failedChecks = toolPolicy.compliance_check.filter((key) => !complianceContext[key]);
      if (failedChecks.length > 0) {
        return {
          decision: "denied",
          reason:
            `Compliance check failed for tool "${toolName}". ` +
            `Required checks not satisfied: ${failedChecks.join(", ")}. ` +
            `Pass "compliance_context" with these keys set to true after performing your checks.`,
        };
      }
    }
  }

  return { decision: "allowed", reason: "ok" };
}
