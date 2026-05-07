// suggest_next_actions — 直前のツール結果に基づき次のアクションを提案する
// suggest_next_actions — Suggest next actions based on preceding tool results
// suggest_next_actions — Menyarankan tindakan berikutnya berdasarkan hasil alat sebelumnya

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadRegistry } from "../registry/loader.js";

export function registerSuggestNextActions(server: McpServer): void {
  server.registerTool(
    "suggest_next_actions",
    {
      title: "次のアクション提案",
      description:
        "直前に取得したデータの要約（context）を渡すと、Gateway 上で次に実行すべきアクションとツール呼び出し例を提案する。" +
        "USE THIS WHEN: 複数のツール結果を見たあとで次に何をすべきか迷ったとき。ワークフローの中間ステップで、残りの手順を整理したいとき。" +
        "Suggest next actions and tool calls based on the context of preceding results. " +
        "Menyarankan tindakan berikutnya berdasarkan konteks hasil sebelumnya.",
      inputSchema: {
        context: z
          .string()
          .describe(
            "直前の操作結果の要約（例: '入札3件発見、補助金2件該当、残高500万円'）。" +
              "Summary of preceding results. Ringkasan hasil sebelumnya.",
          ),
        current_goal: z
          .string()
          .optional()
          .describe(
            "最終的に達成したい目標（例: '受注判断', '月次クローズ', '資金繰り確認'）。" +
              "Ultimate goal. Tujuan akhir.",
          ),
        completed_steps: z
          .array(z.string())
          .optional()
          .describe(
            "すでに完了したステップの一覧。List of completed steps. Daftar langkah yang sudah selesai.",
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
      const { context, current_goal, completed_steps = [] } = args;
      const registry = loadRegistry();
      const serverIds = registry.servers.map((s) => s.id);

      const completedSet = new Set(completed_steps.map((s) => s.toLowerCase()));

      const actionCatalog = [
        {
          id: "bid_search",
          label: "入札検索",
          trigger: ["入札", "公告", "案件", "bid", "procurement"],
          tool: "search_public_opportunities(keyword: '...')",
          when: "入札データをまだ取得していないとき",
        },
        {
          id: "subsidy_search",
          label: "補助金調査",
          trigger: ["補助金", "助成金", "subsidy", "grant"],
          tool: "call_registered_mcp(server_id: 'jgrants', tool_name: 'search_subsidies', mode: 'subsidy_search')",
          when: "補助金を確認していないとき",
        },
        {
          id: "financial_review",
          label: "会計データ確認",
          trigger: ["残高", "資金", "キャッシュ", "balance", "cash"],
          tool: "call_registered_mcp(server_id: 'moneyforward-ca', tool_name: 'get_trial_balance', mode: 'financial_check')",
          when: "会計データから資金状況を確認していないとき",
        },
        {
          id: "accounting_review",
          label: "会計データ確認",
          trigger: ["会計", "試算表", "仕訳", "accounting", "trial balance"],
          tool: "call_registered_mcp(server_id: 'moneyforward-ca', tool_name: 'get_trial_balance', mode: 'financial_check')",
          when: "会計データを確認していないとき",
        },
        {
          id: "funding_analysis",
          label: "総合分析",
          trigger: ["分析", "判断", "意思決定", "analysis", "decision"],
          tool: "analyze_funding_fit(bid_keyword: '...', company_profile: { industry: '...', prefecture: '...' })",
          when: "入札と補助金のデータが揃ったあと",
        },
        {
          id: "agri_stats",
          label: "農業・自治体統計",
          trigger: ["農業", "自治体", "市区町村", "agriculture", "municipality"],
          tool: "call_registered_mcp(server_id: 'agriops', tool_name: 'get_municipality_stats', mode: 'agri_research')",
          when: "地域の農業データが必要なとき",
        },
      ];

      const contextLower = context.toLowerCase();
      const goalLower = (current_goal ?? "").toLowerCase();
      const combined = `${contextLower} ${goalLower}`;

      const suggestions = actionCatalog
        .filter((action) => {
          if (completedSet.has(action.id)) return false;
          const isRelevant = action.trigger.some((t) => combined.includes(t));
          const notYetDone = !completedSet.has(action.id);
          return isRelevant && notYetDone;
        })
        .map((action) => ({
          action: action.label,
          tool_call: action.tool,
          reason: action.when,
        }));

      const fallbackSuggestions =
        suggestions.length > 0
          ? suggestions
          : [
              {
                action: "接続状況の確認",
                tool_call: "list_connected_servers(include_tools: true)",
                reason: "利用可能なツールを把握するため",
              },
              {
                action: "サンプルクエリの参照",
                tool_call: "Read resource: gateway://samples/queries",
                reason: "次に試せることのヒントを得るため",
              },
            ];

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                context_received: context,
                current_goal: current_goal ?? "(未指定)",
                completed_steps,
                suggested_next_actions: fallbackSuggestions,
                available_servers: serverIds,
                tip: "書き込み系操作が含まれる場合は、issue_approval_token で承認を取ってから実行してください。",
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
