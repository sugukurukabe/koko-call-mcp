// get_gateway_demo — Gateway の勝ち筋デモと次の一手を返す
// get_gateway_demo — Return the Gateway's best demo flow and next actions
// get_gateway_demo — Mengembalikan alur demo terbaik Gateway dan langkah berikutnya

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerGetGatewayDemo(server: McpServer): void {
  server.registerTool(
    "get_gateway_demo",
    {
      title: "Gatewayデモ導線",
      description:
        "Public MCP JP Gateway の最初の使い方、勝ち筋デモ、必要な認証ヘッダ、推奨ツール順を返す。USE THIS FIRST WHEN: Gatewayで何ができるか知りたいとき、初回デモを始めたいとき、入札・補助金・銀行・会計を1つの会話で試したいとき。Returns the best first-run demo and recommended tool sequence for the Gateway. Mengembalikan demo awal terbaik dan urutan alat yang disarankan untuk Gateway.",
      inputSchema: {
        scenario: z
          .enum(["quick_start", "monthly_close", "connection_check"])
          .optional()
          .default("monthly_close")
          .describe(
            "見たいデモシナリオ。quick_start / monthly_close / connection_check。Demo scenario to show. Skenario demo yang ditampilkan.",
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
      const scenario = args.scenario ?? "monthly_close";

      const common = {
        gateway_name: "Public MCP JP Gateway",
        connected_domains: [
          "JP Bids: 官公需入札 / government procurement",
          "J-Grants: 補助金・助成金 / subsidies and grants",
          "GMO Aozora Net Bank: 残高・入出金・振込 / banking and transfers",
          "MoneyForward Cloud Accounting: 仕訳・試算表 / journal entries and trial balance",
        ],
        auth_notes: [
          "MoneyForward Cloud Accounting requires the X-Mcp-Child-Authorization-moneyforward-ca header.",
          "Financial write tools require issue_approval_token before call_registered_mcp.",
          "The Gateway stores audit metadata only; OAuth child tokens are forwarded and not logged.",
        ],
      };

      const scenarios = {
        quick_start: {
          user_prompt:
            "鹿児島県のIT関連入札を探し、同時に使えるDX補助金も教えてください。出典も必ず付けてください。",
          recommended_tool_sequence: [
            "search_public_opportunities(keyword: 'IT システム開発', prefecture: '鹿児島県')",
            "list_connected_servers(include_tools: false)",
          ],
          expected_outcome:
            "入札候補と補助金候補を1回で確認し、次に会計・銀行確認へ進む材料を得る。",
        },
        monthly_close: {
          user_prompt:
            "鹿児島県の農業/IT案件を探して、使える補助金を確認し、GMOの残高を見て、MoneyForwardに仕訳候補を作るところまで案内してください。実行前に承認が必要な操作は止めて確認してください。",
          recommended_tool_sequence: [
            "search_public_opportunities(keyword: '農業 IT システム', prefecture: '鹿児島県')",
            "call_registered_mcp(server_id: 'gmo-bank', tool_name: 'gmo_bank_get_balance', mode: 'financial_check')",
            "list_connected_servers(mode: 'financial_check')",
            "call_registered_mcp(server_id: 'moneyforward-ca', tool_name: '<discovered read tool>', mode: 'financial_check')",
            "issue_approval_token(...) before any MoneyForward write tool",
            "call_registered_mcp(..., approval_token, compliance_context: { accounting_period_open: true })",
          ],
          expected_outcome:
            "案件探索から補助金、銀行残高、会計反映の入口までを1つの会話で確認する。",
        },
        connection_check: {
          user_prompt:
            "どのMCPサーバーに接続されていますか？MoneyForwardのOAuthヘッダが必要な操作も含めて、使える範囲を教えてください。",
          recommended_tool_sequence: [
            "get_gateway_demo(scenario: 'connection_check')",
            "list_connected_servers(include_tools: true)",
          ],
          expected_outcome: "登録済み子MCP、認証が必要な子MCP、次に使うべきツールを把握する。",
        },
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                ...common,
                scenario,
                ...scenarios[scenario],
                safety:
                  "振込・仕訳作成などの書き込み系操作は、必ず内容確認後に approval token を発行して実行してください。",
                attribution:
                  "Use tool results' attribution fields for JP Bids, J-Grants, GMO, and MoneyForward outputs.",
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
