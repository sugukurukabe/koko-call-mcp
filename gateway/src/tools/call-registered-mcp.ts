// call_registered_mcp — 登録済み子 MCP のツールを直接呼び出す
// call_registered_mcp — Directly call a tool on a registered child MCP
// call_registered_mcp — Memanggil alat pada MCP anak yang terdaftar secara langsung

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { stats as cacheStats } from "../cache/tool-cache.js";
import { isToolPermitted } from "../filter/tool-filter.js";
import {
  PolicyDeniedError as FilterDeniedError,
  PolicyDeniedError,
  RateLimitError,
} from "../lib/errors.js";
import { evaluate } from "../policy/policy-engine.js";
import { proxyToolCall } from "../proxy/mcp-proxy.js";
import { getRegistryDeploymentStatus, loadRegistry } from "../registry/loader.js";
import {
  FULL_ORCHESTRATION_MODE,
  type GatewayMode,
  GatewayModeSchema,
} from "../registry/schema.js";
import { route } from "../router/smart-router.js";
import type { ToolContext } from "./register-tools.js";

export function registerCallRegisteredMcp(server: McpServer, context: ToolContext): void {
  server.registerTool(
    "call_registered_mcp",
    {
      title: "登録済み子MCPツール直接呼び出し",
      description:
        "登録済みの子 MCP サーバーのツールを直接呼び出す（Pro tier）。USE THIS WHEN: list_connected_servers で確認したサーバーの特定ツールを直接呼びたいとき、MoneyForward試算表確認など金融・会計系子MCPを明示的に使うとき。GMO銀行系APIは公開Gatewayでは提供せず、利用許諾・API取得後のprivate connectorとして追加予定。FLOW: 1) get_gateway_demo で流れを確認 2) list_connected_servers で tool 名を確認 3) 書き込み系は issue_approval_token で承認 4) call_registered_mcp で実行。DO NOT USE WHEN: search_public_opportunities や analyze_funding_fit で事足りるとき。Directly call any tool on a registered child MCP server. Memanggil langsung alat apa pun pada server MCP anak yang terdaftar.",
      inputSchema: {
        server_id: z
          .string()
          .describe(
            "呼び出す子 MCP サーバーのID（例: jp-bids, jgrants, freee, moneyforward-ca）。Child MCP server ID to call. ID server MCP anak yang dipanggil.",
          ),
        tool_name: z
          .string()
          .describe("呼び出すツール名。Tool name to call. Nama alat yang dipanggil."),
        tool_arguments: z
          .record(z.string(), z.unknown())
          .optional()
          .default({})
          .describe(
            "ツールへの引数（JSON オブジェクト）。Arguments to pass to the tool (JSON object). Argumen untuk alat (objek JSON).",
          ),
        freee_oauth_token: z
          .string()
          .optional()
          .describe(
            "freee MCP 呼び出し時に使用する OAuth トークン（後方互換）。" +
              "OAuth token for freee MCP calls (backward compatible). " +
              "Token OAuth untuk panggilan freee MCP (kompatibilitas mundur).",
          ),
        mode: GatewayModeSchema.optional()
          .default("full_orchestration")
          .describe(
            "エージェントの動作モード（ADR-0017, ADR-0022）。例: bid_search / subsidy_search / financial_check / agri_research / company_identity / full_orchestration。registry.json の tool_modes キーで mode を定義する。Agent operation mode for dynamic tool filtering. Mode operasi agen untuk pemfilteran alat dinamis.",
          ),
        approval_token: z
          .string()
          .optional()
          .describe(
            "required_approval ツール用の HMAC 署名済みトークン。issue_approval_token で事前に取得すること。" +
              "HMAC-signed token for required_approval tools. Obtain in advance via issue_approval_token. " +
              "Token bertanda tangan HMAC untuk alat required_approval. Dapatkan sebelumnya melalui issue_approval_token.",
          ),
        compliance_context: z
          .record(z.string(), z.boolean())
          .optional()
          .describe(
            "コンプライアンスチェック結果のマップ（例: {tx_amount_under_limit: true}）。" +
              "Map of compliance check results (e.g. {tx_amount_under_limit: true}). " +
              "Peta hasil pemeriksaan kepatuhan (mis. {tx_amount_under_limit: true}).",
          ),
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        openWorldHint: true,
        destructiveHint: false,
      },
    },
    async (args) => {
      const {
        server_id,
        tool_name,
        tool_arguments = {},
        freee_oauth_token,
        mode,
        approval_token,
        compliance_context,
      } = args;
      const effectiveMode: GatewayMode = mode ?? FULL_ORCHESTRATION_MODE;
      const registry = loadRegistry();

      const childServer = registry.servers.find((s) => s.id === server_id);
      if (!childServer) {
        const deployment = getRegistryDeploymentStatus();
        const omitted = deployment.omitted_local_servers.find((s) => s.id === server_id);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: omitted
                  ? `Server "${server_id}" is configured but not active in production because its endpoint is still local.`
                  : `Server "${server_id}" is not registered. Available servers: ${registry.servers.map((s) => s.id).join(", ")}`,
                omitted_local_server: omitted ?? undefined,
                active_servers: deployment.active_server_ids,
                required_endpoint_env_keys: deployment.required_endpoint_env_keys,
                next_step:
                  omitted !== undefined
                    ? `Set ${omitted.endpoint_env_key} to the deployed child MCP /mcp URL, then redeploy or update the Cloud Run service.`
                    : "Call list_connected_servers(include_tools: false) to confirm server IDs, or get_gateway_demo for the recommended first-run flow.",
              }),
            },
          ],
          isError: true,
        };
      }

      // Mode ベースのツールフィルタリング（ADR-0017）
      // Mode-based tool filtering (ADR-0017)
      // Pemfilteran alat berbasis mode (ADR-0017)
      if (!isToolPermitted(tool_name, childServer, effectiveMode)) {
        throw new FilterDeniedError(
          `Tool "${tool_name}" is not available in mode "${effectiveMode}" for server "${server_id}". ` +
            `Switch to "full_orchestration" mode, call list_connected_servers(mode: "${effectiveMode}") to see available tools, or use get_gateway_demo for the guided flow.`,
        );
      }

      const apiKey =
        process.env[`GATEWAY_CHILD_TOKEN_${server_id.toUpperCase().replace(/-/g, "_")}`];

      // OAuth トークンの解決優先順: ヘッダ > 引数 > 環境変数
      // OAuth token resolution priority: header > argument > environment variable
      // Prioritas resolusi token OAuth: header > argumen > variabel lingkungan
      const effectiveOAuthToken =
        context.childAuthHeaders[server_id] ??
        freee_oauth_token ??
        process.env[`GATEWAY_CHILD_TOKEN_${server_id.toUpperCase().replace(/-/g, "_")}_OAUTH`] ??
        (server_id === "freee" ? process.env.GATEWAY_CHILD_TOKEN_FREEE : undefined);

      const policyResult = evaluate({
        server: childServer,
        toolName: tool_name,
        tier: context.tier,
        isOAuthAuthenticated:
          context.isOAuthAuthenticated ||
          (childServer.auth_type === "bearer_oauth" && Boolean(effectiveOAuthToken)),
        ...(approval_token !== undefined ? { approvalToken: approval_token } : {}),
        toolArguments: tool_arguments as Record<string, unknown>,
        ...(compliance_context !== undefined ? { complianceContext: compliance_context } : {}),
      });

      if (policyResult.decision === "denied") {
        throw new PolicyDeniedError(policyResult.reason);
      }
      if (policyResult.decision === "rate_limited") {
        throw new RateLimitError(server_id);
      }

      const startMs = Date.now();
      const result = await proxyToolCall({
        server: childServer,
        toolName: tool_name,
        toolArguments: tool_arguments as Record<string, unknown>,
        bearerToken: apiKey,
        oauthToken: effectiveOAuthToken,
      });
      const latencyMs = Date.now() - startMs;

      const routerHint = await route(
        { query: tool_name, explicitServerId: server_id },
        registry.servers,
      );

      const cache = cacheStats();
      const diagnostics = {
        server_id,
        tool_name,
        mode: effectiveMode,
        latency_ms: latencyMs,
        routing: routerHint
          ? { score: routerHint.score, reason: routerHint.reason }
          : { score: 0, reason: "explicit call" },
        cache: {
          hits: cache.hits,
          misses: cache.misses,
          hit_rate: cache.hitRate,
          entries: cache.size,
        },
        policy: policyResult.decision,
      };

      const enrichedContent = [
        ...result.content,
        {
          type: "text" as const,
          text: JSON.stringify({ _gateway_diagnostics: diagnostics }),
        },
      ];

      return {
        content: enrichedContent,
        isError: result.isError,
      };
    },
  );
}
