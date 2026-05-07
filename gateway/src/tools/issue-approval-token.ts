// issue_approval_token — 書込み系ツール呼び出し前の HMAC Approval Token 発行（Pro tier）
// issue_approval_token — Issue HMAC Approval Token before write tool calls (Pro tier)
// issue_approval_token — Menerbitkan Token Persetujuan HMAC sebelum panggilan alat tulis (Pro tier)

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Tier } from "../lib/auth.js";
import { issue } from "../policy/approval-token.js";
import { loadRegistry } from "../registry/loader.js";

/**
 * issue_approval_token ツールを登録する
 * Register the issue_approval_token tool
 * Mendaftarkan alat issue_approval_token
 *
 * エージェントのフロー:
 * 1. 会計・財務データを確認して承認判断
 * 2. issue_approval_token で HMAC トークンを取得
 * 3. ユーザーに最終確認（任意・推奨）
 * 4. call_registered_mcp に approval_token を渡して実行
 *
 * Agent flow:
 * 1. Check accounting/financial data to make approval decision
 * 2. Obtain HMAC token via issue_approval_token
 * 3. Final confirmation with user (optional, recommended)
 * 4. Execute via call_registered_mcp passing approval_token
 *
 * Alur agen:
 * 1. Periksa data akuntansi/keuangan untuk membuat keputusan persetujuan
 * 2. Dapatkan token HMAC melalui issue_approval_token
 * 3. Konfirmasi akhir dengan pengguna (opsional, disarankan)
 * 4. Eksekusi melalui call_registered_mcp dengan meneruskan approval_token
 */
export function registerIssueApprovalToken(server: McpServer, context: { tier: Tier }): void {
  server.registerTool(
    "issue_approval_token",
    {
      title: "書込み系ツールの Approval Token 発行",
      description:
        "required_approval が設定されたツール（MoneyForwardの仕訳作成/更新 等）を呼び出す前に、" +
        "HMAC 署名付き Approval Token を発行する（Pro tier 専用）。" +
        "トークンは 5 分間有効。call_registered_mcp に approval_token として渡すこと。" +
        "Issue a HMAC-signed Approval Token before calling tools that require approval " +
        "(e.g. MoneyForward write tools). Token is valid for 5 minutes. Pass it as approval_token " +
        "to call_registered_mcp. " +
        "Menerbitkan Token Persetujuan bertanda tangan HMAC sebelum memanggil alat yang memerlukan " +
        "persetujuan (mis. alat tulis MoneyForward). Token berlaku 5 menit.",
      inputSchema: {
        server_id: z
          .string()
          .describe(
            "ツールが属する子 MCP サーバー ID（例: moneyforward-ca）。" +
              "Child MCP server ID that owns the tool (e.g. moneyforward-ca). " +
              "ID server MCP anak yang memiliki alat.",
          ),
        tool_name: z
          .string()
          .describe(
            "Approval Token を発行するツール名（例: create_journal_entry）。" +
              "Tool name to issue approval for (e.g. create_journal_entry). " +
              "Nama alat yang akan diterbitkan persetujuannya.",
          ),
        tool_arguments: z
          .record(z.string(), z.unknown())
          .optional()
          .default({})
          .describe(
            "実際に渡す予定のツール引数（JSON）。トークンはこの引数に対してのみ有効。" +
              "Exact arguments you plan to pass. Token is only valid for these arguments. " +
              "Argumen persis yang akan diteruskan. Token hanya berlaku untuk argumen ini.",
          ),
        ttl_seconds: z
          .number()
          .int()
          .min(60)
          .max(600)
          .optional()
          .default(300)
          .describe(
            "トークンの有効期限（秒）。デフォルト 300 秒（5 分）。最大 600 秒。" +
              "Token TTL in seconds. Default 300s (5 min). Max 600s. " +
              "TTL token dalam detik. Default 300 detik (5 menit). Maks 600 detik.",
          ),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: false,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async (args) => {
      if (context.tier !== "pro") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error:
                  "issue_approval_token requires Pro tier. Upgrade to access financial tool approval.",
              }),
            },
          ],
          isError: true,
        };
      }

      const { server_id, tool_name, tool_arguments = {}, ttl_seconds = 300 } = args;

      const registry = loadRegistry();
      const childServer = registry.servers.find((s) => s.id === server_id);
      if (!childServer) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `Server "${server_id}" is not registered. Available: ${registry.servers.map((s) => s.id).join(", ")}`,
              }),
            },
          ],
          isError: true,
        };
      }

      const toolPolicy = childServer.tool_policies?.[tool_name];
      if (!toolPolicy?.required_approval) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error:
                  `Tool "${tool_name}" on server "${server_id}" does not require approval. ` +
                  `Call it directly via call_registered_mcp.`,
              }),
            },
          ],
          isError: true,
        };
      }

      let token: string;
      try {
        token = issue(server_id, tool_name, tool_arguments as Record<string, unknown>, ttl_seconds);
      } catch (e) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error:
                  `Failed to issue approval token: ${e instanceof Error ? e.message : String(e)}. ` +
                  `Ensure GATEWAY_APPROVAL_HMAC_SECRET is set.`,
              }),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              approval_token: token,
              expires_in_seconds: ttl_seconds,
              server_id,
              tool_name,
              instructions:
                "Pass this approval_token to call_registered_mcp to execute the tool. " +
                "Token expires in the specified seconds. " +
                "Confirm the exact amount, account, journal date, and target company with the user before proceeding.",
            }),
          },
        ],
      };
    },
  );
}
