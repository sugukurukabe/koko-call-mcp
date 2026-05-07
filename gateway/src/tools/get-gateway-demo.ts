// get_gateway_demo — Gateway の勝ち筋デモと次の一手を返す
// get_gateway_demo — Return the Gateway's best demo flow and next actions
// get_gateway_demo — Mengembalikan alur demo terbaik Gateway dan langkah berikutnya

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const SCENARIO_KEYS = [
  "quick_start",
  "monthly_close",
  "connection_check",
  "dx_subsidy_hunt",
  "multi_agent_split",
  "cash_flow_alert",
  "cross_data_research",
] as const;

type ScenarioKey = (typeof SCENARIO_KEYS)[number];

export function registerGetGatewayDemo(server: McpServer): void {
  server.registerTool(
    "get_gateway_demo",
    {
      title: "Gatewayデモ導線",
      description:
        "Public MCP JP Gateway の最初の使い方、勝ち筋デモ、必要な認証ヘッダ、推奨ツール順を返す。USE THIS FIRST WHEN: Gatewayで何ができるか知りたいとき、初回デモを始めたいとき、入札・補助金・銀行・会計を1つの会話で試したいとき。Returns the best first-run demo and recommended tool sequence for the Gateway. Mengembalikan demo awal terbaik dan urutan alat yang disarankan untuk Gateway.",
      inputSchema: {
        scenario: z
          .enum(SCENARIO_KEYS)
          .optional()
          .default("quick_start")
          .describe(
            "見たいデモシナリオ。quick_start / monthly_close / connection_check / dx_subsidy_hunt / multi_agent_split / cash_flow_alert / cross_data_research。Demo scenario to show. Skenario demo yang ditampilkan.",
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
      const scenario: ScenarioKey = args.scenario ?? "quick_start";

      const common = {
        gateway_name: "Public MCP JP Gateway",
        connected_domains: [
          "JP Bids: 官公需入札 / government procurement",
          "J-Grants: 補助金・助成金 / subsidies and grants",
          "AgriOps: 農業・自治体統計 / agriculture and municipality stats",
          "Real Estate Intel: 不動産投資分析（地価・取引・災害・人流・10都道府県） / real estate investment analysis",
          "MoneyForward Cloud Accounting: 仕訳・試算表 / journal entries and trial balance",
          "freee: 会計・請求書 / accounting and invoicing",
        ],
        available_prompts: [
          "investigate_opportunity: 入札+補助金の同時調査",
          "financial_health_check: 会計データ中心の資金繰り確認",
          "bid_to_close_workflow: 入札→補助金→会計確認の一気通貫",
          "cross_mcp_comparison: 子MCP横断比較",
          "gateway_quick_tour: Gatewayの機能紹介ツアー",
        ],
        available_resources: [
          "gateway://registry/summary: 子MCPレジストリの概要",
          "gateway://modes/reference: 動的モードの一覧と構成",
          "gateway://samples/queries: すぐに試せるサンプルクエリ集",
          "gateway://attribution/all: 全子MCPの出典情報",
        ],
        auth_notes: [
          "MoneyForward Cloud Accounting requires the X-Mcp-Child-Authorization-moneyforward-ca header.",
          "GMO banking APIs are not exposed in the public Gateway; they are planned as a future private connector after permission and API access are obtained.",
          "Financial write tools require issue_approval_token before call_registered_mcp.",
          "The Gateway stores audit metadata only; OAuth child tokens are forwarded and not logged.",
        ],
      };

      const scenarios: Record<
        ScenarioKey,
        {
          user_prompt: string;
          recommended_tool_sequence: string[];
          expected_outcome: string;
        }
      > = {
        quick_start: {
          user_prompt:
            "IT関連の入札を探し、同時に使えるDX補助金も教えてください。出典も必ず付けてください。",
          recommended_tool_sequence: [
            "search_public_opportunities(keyword: 'IT システム開発')",
            "list_connected_servers(include_tools: false)",
          ],
          expected_outcome:
            "入札候補と補助金候補を1回で確認し、次に会計・銀行確認へ進む材料を得る。",
        },
        monthly_close: {
          user_prompt:
            "IT案件を探して、使える補助金を確認し、MoneyForwardの試算表を確認するところまで案内してください。",
          recommended_tool_sequence: [
            "search_public_opportunities(keyword: 'IT システム')",
            "list_connected_servers(mode: 'financial_check')",
            "call_registered_mcp(server_id: 'moneyforward-ca', tool_name: 'get_trial_balance', mode: 'financial_check')",
            "issue_approval_token(...) before any MoneyForward write tool",
            "call_registered_mcp(..., approval_token, compliance_context: { accounting_period_open: true })",
          ],
          expected_outcome:
            "案件探索から補助金、会計確認、会計反映の入口までを1つの会話で確認する。",
        },
        connection_check: {
          user_prompt:
            "どのMCPサーバーに接続されていますか？OAuthヘッダが必要な操作も含めて、使える範囲を教えてください。",
          recommended_tool_sequence: [
            "list_connected_servers(include_tools: true)",
            "Read resource: gateway://registry/summary",
            "Read resource: gateway://modes/reference",
          ],
          expected_outcome:
            "登録済み子MCP、認証が必要な子MCP、利用可能モード、次に使うべきツールを把握する。",
        },
        dx_subsidy_hunt: {
          user_prompt:
            "中小企業のDX推進に使える補助金を探して、対象条件と申請期限を整理してください。",
          recommended_tool_sequence: [
            "search_public_opportunities(keyword: 'DX デジタルトランスフォーメーション 中小企業')",
            "call_registered_mcp(server_id: 'jgrants', tool_name: 'search_subsidies', tool_arguments: { keyword: 'DX' }, mode: 'subsidy_search')",
          ],
          expected_outcome:
            "DX関連の補助金候補をリストアップし、申請要件・期限・金額をテーブルで整理。業種を選ばず使えるシナリオ。",
        },
        multi_agent_split: {
          user_prompt:
            "入札担当・補助金担当・財務担当に分かれて並列調査し、最後に統合レポートをまとめてください。",
          recommended_tool_sequence: [
            "Agent A: search_public_opportunities(keyword: '...')",
            "Agent B: call_registered_mcp(server_id: 'jgrants', tool_name: 'search_subsidies', mode: 'subsidy_search')",
            "Agent C: call_registered_mcp(server_id: 'moneyforward-ca', tool_name: 'get_trial_balance', mode: 'financial_check')",
            "Orchestrator: 各エージェントの結果を統合して suggest_next_actions で提案",
          ],
          expected_outcome:
            "Grok / Claude マルチエージェントで役割分担し、Gateway の mode 機能でツールスコープを絞る。1接続で複数エージェントが並走するデモ。",
        },
        cash_flow_alert: {
          user_prompt:
            "今月の資金繰りに問題がないか確認して。MoneyForwardの会計データを確認して、懸念があれば教えて。",
          recommended_tool_sequence: [
            "call_registered_mcp(server_id: 'moneyforward-ca', tool_name: 'get_trial_balance', mode: 'financial_check')",
            "call_registered_mcp(server_id: 'moneyforward-ca', tool_name: 'get_transition_table', mode: 'financial_check')",
            "suggest_next_actions(context: '...') で次のアクションを提案",
          ],
          expected_outcome:
            "会計データによる資金繰り確認。問題検出時に次のアクション（支払時期確認・入金催促等）を提案。",
        },
        cross_data_research: {
          user_prompt:
            "接続中の全子MCPから取れるデータを使って、現在の事業状況を多角的にまとめてください。",
          recommended_tool_sequence: [
            "list_connected_servers(include_tools: true, mode: 'full_orchestration')",
            "search_public_opportunities(keyword: '...')",
            "call_registered_mcp(server_id: 'moneyforward-ca', tool_name: 'get_trial_balance')",
            "call_registered_mcp(server_id: 'freee', tool_name: 'get_deals')",
          ],
          expected_outcome:
            "入札動向・補助金・会計データを横断して事業全体の snapshot を生成。複数子MCPの横串分析デモ。",
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
                all_scenarios: SCENARIO_KEYS,
                safety:
                  "振込・仕訳作成などの書き込み系操作は、必ず内容確認後に approval token を発行して実行してください。",
                attribution:
                  "Use tool results' attribution fields for JP Bids, J-Grants, AgriOps, Real Estate Intel, MoneyForward, Corporate Number, and freee outputs.",
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
