// get_audit_events — 監査ログの取得（Pro tier、自分のリクエストのみ）
// get_audit_events — Retrieve audit log entries (Pro tier, own requests only)
// get_audit_events — Mengambil entri log audit (tier Pro, hanya permintaan sendiri)

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext } from "./register-tools.js";

// インメモリ監査イベントバッファ（本番では Cloud Logging / DB に移行する）
// In-memory audit event buffer (move to Cloud Logging / DB in production)
// Buffer event audit in-memory (pindahkan ke Cloud Logging / DB di produksi)
const auditBuffer: Array<{
  request_id: string;
  timestamp: string;
  actor_hash: string;
  selected_server: string;
  tool_name: string;
  decision: string;
  latency_ms: number;
}> = [];

export function addToAuditBuffer(event: (typeof auditBuffer)[number]): void {
  auditBuffer.unshift(event);
  // 直近1000件のみ保持
  if (auditBuffer.length > 1000) auditBuffer.pop();
}

export function registerGetAuditEvents(server: McpServer, context: ToolContext): void {
  server.registerTool(
    "get_audit_events",
    {
      title: "監査ログ取得",
      description:
        "Gateway が記録した監査ログを取得する（Pro tier）。自分のリクエストのみ返す。USE THIS WHEN: どのMCPがいつ呼ばれたか、拒否されたリクエストがあったかを確認したいとき。DO NOT USE WHEN: データ検索や分析をしたいとき（専用ツールを使う）。Retrieves recorded audit log entries for the current actor. Mengambil entri log audit yang dicatat untuk aktor saat ini.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .default(20)
          .describe(
            "取得件数（デフォルト: 20、最大: 100）。Number of entries to retrieve (default: 20, max: 100). Jumlah entri yang diambil.",
          ),
        server_id: z
          .string()
          .optional()
          .describe(
            "特定サーバーのみ絞り込む場合のサーバーID。Filter by specific server ID. Filter berdasarkan ID server tertentu.",
          ),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async (args) => {
      const { limit = 20, server_id } = args;

      let events = auditBuffer.filter((e) => e.actor_hash === context.actorHash);
      if (server_id) {
        events = events.filter((e) => e.selected_server === server_id);
      }
      events = events.slice(0, limit);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total_in_buffer: auditBuffer.length,
                returned: events.length,
                events,
                note: "監査ログは actor_hash（元の値は保存されていません）・selected_server・tool_name・decision・latency_ms のみを含みます。個人情報・入力全文・財務データは保存されません。Audit logs contain only actor_hash (original value not stored), selected_server, tool_name, decision, and latency_ms. No personal data, full input text, or financial data is stored.",
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
