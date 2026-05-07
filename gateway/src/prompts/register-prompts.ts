// Gateway MCP Prompts — ガイド付きワークフロー起動用
// Gateway MCP Prompts — Guided workflow starters
// Prompt MCP Gateway — Pemula alur kerja terpandu

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "investigate_opportunity",
    {
      title: "入札・補助金調査",
      description:
        "指定条件で入札と補助金を同時調査し、候補リストを生成する。" +
        "Investigate bids and subsidies for a given keyword and region. " +
        "Menyelidiki tender dan subsidi berdasarkan kata kunci dan wilayah.",
      argsSchema: {
        keyword: z
          .string()
          .describe(
            "検索キーワード（例: IT システム, DX 推進）。Search keyword. Kata kunci pencarian.",
          ),
        prefecture: z
          .string()
          .optional()
          .describe("都道府県（例: 東京都, 鹿児島県）。Prefecture filter. Filter prefektur."),
      },
    },
    async (args) => {
      const kw = args.keyword;
      const pref = args.prefecture ? `、都道府県: ${args.prefecture}` : "";
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `「${kw}」${pref}に関する入札案件と補助金を同時に調査してください。\n\n` +
                `手順:\n` +
                `1. search_public_opportunities で入札と補助金を並列検索\n` +
                `2. 結果をテーブル形式で整理（案件名, 締切, 概算金額, 出典）\n` +
                `3. 追加で確認すべきことがあれば提案してください\n\n` +
                `出典は必ず attribution フィールドから引用してください。`,
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "financial_health_check",
    {
      title: "資金繰り確認",
      description:
        "会計データを確認し、資金繰り状況を整理する。" +
        "Check accounting data for a financial health overview. " +
        "Memeriksa data akuntansi untuk gambaran kesehatan keuangan.",
      argsSchema: {
        focus: z
          .enum(["balance_only", "full_review"])
          .optional()
          .default("full_review")
          .describe(
            "確認範囲: balance_only（会計残高のみ）/ full_review（会計レビュー）。" +
              "Scope: balance_only or full_review. " +
              "Cakupan: balance_only atau full_review.",
          ),
      },
    },
    async (args) => {
      const isFull = args.focus === "full_review";
      const steps = [
        "1. call_registered_mcp(server_id: 'moneyforward-ca', tool_name: 'get_trial_balance') で試算表を確認",
      ];
      if (isFull) {
        steps.push(
          "2. call_registered_mcp(server_id: 'moneyforward-ca', tool_name: 'get_transition_table') で推移表を確認",
          "3. freee を利用している場合は call_registered_mcp(server_id: 'freee', tool_name: 'get_deals') で入出金予定を確認",
          "4. 会計データを整理し、資金繰りに懸念があれば指摘してください",
        );
      }
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `資金繰り状況を確認してください（${isFull ? "会計データのフルレビュー" : "会計残高のみ"}）。\n\n` +
                `手順:\n${steps.join("\n")}\n\n` +
                `注意: MoneyForward には X-Mcp-Child-Authorization-moneyforward-ca ヘッダが必要です。\n` +
                `書き込み操作が必要な場合は issue_approval_token で承認を取ってから実行してください。`,
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "bid_to_close_workflow",
    {
      title: "入札→会計一気通貫",
      description:
        "入札調査から補助金確認、会計確認までを1つの会話で実行する。" +
        "Full workflow from bid search through subsidy to accounting review. " +
        "Alur kerja penuh dari pencarian tender hingga subsidi dan tinjauan akuntansi.",
      argsSchema: {
        keyword: z.string().describe("案件キーワード。Bid keyword. Kata kunci tender."),
        prefecture: z.string().optional().describe("都道府県。Prefecture. Prefektur."),
        industry: z.string().optional().describe("業種（例: IT, 建設, 農業）。Industry. Industri."),
      },
    },
    async (args) => {
      const kw = args.keyword;
      const pref = args.prefecture ?? "全国";
      const ind = args.industry ?? "全業種";
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `以下のステップで「${kw}」案件（${pref}, ${ind}）を調査し、受注判断の材料を揃えてください。\n\n` +
                `Step 1: search_public_opportunities で入札・補助金を検索\n` +
                `Step 2: 有望な案件があれば analyze_funding_fit で適合性を分析\n` +
                `Step 3: call_registered_mcp で MoneyForward の試算表を確認\n` +
                `Step 4: 必要に応じて freee の会計・請求書情報を確認\n` +
                `Step 5: 総合判断をまとめる（追うべき案件 / 見送る案件 / 資金面の注意点）\n\n` +
                `書き込み系操作が発生する場合は、必ず事前に確認してください。\n` +
                `各ステップで出典を明記してください。`,
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "cross_mcp_comparison",
    {
      title: "子MCP横断比較",
      description:
        "複数の子MCPからデータを取得して横断比較する。" +
        "Fetch data from multiple child MCPs and cross-compare. " +
        "Mengambil data dari beberapa MCP anak dan membandingkan secara silang.",
      argsSchema: {
        question: z
          .string()
          .describe(
            "比較したい内容（例: freeeとMoneyForwardの売掛金残高を比較して）。" +
              "What to compare. Apa yang dibandingkan.",
          ),
      },
    },
    async (args) => {
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `以下の質問に答えるために、必要な子MCPからデータを取得して比較してください。\n\n` +
                `質問: ${args.question}\n\n` +
                `手順:\n` +
                `1. list_connected_servers で利用可能な子MCPとツールを確認\n` +
                `2. 質問に関連する子MCPのツールを call_registered_mcp で順次呼び出す\n` +
                `3. 取得データをテーブル形式で比較・整理\n` +
                `4. 差異や注意点があれば指摘\n\n` +
                `出典は各子MCPの attribution を引用してください。`,
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "gateway_quick_tour",
    {
      title: "Gateway クイックツアー",
      description:
        "このGatewayで何ができるかを即座に把握するガイド付きツアー。" +
        "Quick guided tour of what this Gateway can do. " +
        "Tur panduan cepat tentang apa yang bisa dilakukan Gateway ini.",
    },
    async () => {
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `Public MCP JP Gateway のクイックツアーを実行してください。\n\n` +
                `1. get_gateway_demo(scenario: 'connection_check') で接続状況を確認\n` +
                `2. list_connected_servers(include_tools: true) で全子MCPとツール一覧を表示\n` +
                `3. 各子MCPの役割を1行で説明\n` +
                `4. 「次に試せること」を3つ提案\n\n` +
                `ユーザーが初めてこのGatewayに接続した場面を想定してください。`,
            },
          },
        ],
      };
    },
  );
}
