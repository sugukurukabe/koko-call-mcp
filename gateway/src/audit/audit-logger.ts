// 監査ロガー — request id・actor hash・decision のみを記録する
// Audit Logger — records only request id, actor hash, and decision
// Logger Audit — hanya mencatat request id, hash aktor, dan keputusan

import { randomUUID } from "node:crypto";
import type { PolicyDecision } from "../policy/policy-engine.js";

export interface AuditEvent {
  request_id: string;
  timestamp: string;
  // SHA-256 の先頭16文字のみ保存（元の値は不可逆）
  // Only first 16 chars of SHA-256 (irreversible)
  // Hanya 16 karakter pertama SHA-256 (tidak dapat dibalik)
  actor_hash: string;
  selected_server: string;
  tool_name: string;
  decision: PolicyDecision;
  reason?: string | undefined;
  attribution_url?: string | undefined;
  latency_ms: number;
}

/**
 * 監査イベントを JSON Lines 形式で stderr に出力する
 * (Cloud Run では Cloud Logging が自動的に stderr を取り込む)
 *
 * Output audit events in JSON Lines format to stderr
 * (Cloud Run automatically ingests stderr into Cloud Logging)
 *
 * Output event audit dalam format JSON Lines ke stderr
 * (Cloud Run secara otomatis menyerap stderr ke Cloud Logging)
 */
export function logAuditEvent(event: AuditEvent): void {
  const logEntry = {
    severity: event.decision === "allowed" ? "INFO" : "WARNING",
    ...event,
  };
  process.stderr.write(`${JSON.stringify(logEntry)}\n`);
}

export function createRequestId(): string {
  return randomUUID();
}

export function recordAuditEvent(params: {
  requestId: string;
  actorHash: string;
  selectedServer: string;
  toolName: string;
  decision: PolicyDecision;
  reason?: string;
  attributionUrl?: string;
  startedAt: number;
}): AuditEvent {
  const event: AuditEvent = {
    request_id: params.requestId,
    timestamp: new Date().toISOString(),
    actor_hash: params.actorHash,
    selected_server: params.selectedServer,
    tool_name: params.toolName,
    decision: params.decision,
    attribution_url: params.attributionUrl,
    latency_ms: Date.now() - params.startedAt,
  };
  if (params.reason && params.decision !== "allowed") {
    event.reason = params.reason;
  }
  logAuditEvent(event);
  return event;
}
