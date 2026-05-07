import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? "8080");
const CONFIGURED = Boolean(process.env.GMO_BANK_API_BASE_URL && process.env.GMO_BANK_ACCESS_TOKEN);
const ATTRIBUTION = {
  source: "GMOあおぞらネット銀行 API",
  license: "proprietary",
  url: "https://gmo-aozora.com",
};

function notConfigured(tool) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            error:
              "GMO banking APIs are not exposed in the public Gateway. This wrapper is reserved for a future private connector after permission and API access are obtained.",
            tool,
            required_env: ["GMO_BANK_API_BASE_URL", "GMO_BANK_ACCESS_TOKEN"],
            next_step:
              "Do not expose this service publicly. Configure credentials only after confirming the allowed usage scope and keeping the connector private.",
            attribution: ATTRIBUTION,
          },
          null,
          2,
        ),
      },
    ],
    isError: true,
  };
}

function textResult(payload) {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

async function callGmo(path) {
  const base = process.env.GMO_BANK_API_BASE_URL;
  const token = process.env.GMO_BANK_ACCESS_TOKEN;
  if (!base || !token) throw new Error("GMO Bank API credentials are not configured.");
  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GMO Bank API HTTP ${response.status}: ${body}`);
  }
  return response.json();
}

function createServer() {
  const server = new McpServer(
    {
      name: "GMO Bank MCP",
      title: "GMO Bank wrapper MCP",
      version: "0.1.0",
      description:
        "GMOあおぞらネット銀行 API を将来の private connector として扱うための内部向け wrapper MCP。公開 Gateway では提供しない。Internal wrapper MCP reserved for a future private connector after permission and API access are obtained.",
    },
    {
      capabilities: { tools: { listChanged: false } },
      instructions:
        "Do not expose this service publicly. Use only as a private connector after permission and API access are obtained. Write tools must remain approval-token gated at the parent Gateway layer.",
    },
  );

  server.registerTool(
    "gmo_bank_get_balance",
    {
      title: "残高照会",
      description: "GMOあおぞらネット銀行の残高を照会する。Get bank account balance.",
      inputSchema: {
        account_id: z.string().optional().describe("Optional account ID."),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      if (!CONFIGURED) return notConfigured("gmo_bank_get_balance");
      try {
        return textResult({ data: await callGmo("balance"), attribution: ATTRIBUTION });
      } catch (e) {
        return textResult({ error: e instanceof Error ? e.message : String(e), attribution: ATTRIBUTION });
      }
    },
  );

  server.registerTool(
    "gmo_bank_get_transactions",
    {
      title: "入出金明細照会",
      description: "GMOあおぞらネット銀行の入出金明細を照会する。Get account transactions.",
      inputSchema: {
        account_id: z.string().optional(),
        from_date: z.string().optional(),
        to_date: z.string().optional(),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      if (!CONFIGURED) return notConfigured("gmo_bank_get_transactions");
      try {
        return textResult({ data: await callGmo("transactions"), attribution: ATTRIBUTION });
      } catch (e) {
        return textResult({ error: e instanceof Error ? e.message : String(e), attribution: ATTRIBUTION });
      }
    },
  );

  server.registerTool(
    "gmo_bank_get_deposit_transactions",
    {
      title: "入金明細照会",
      description: "GMOあおぞらネット銀行の入金明細を照会する。Get deposit transactions.",
      inputSchema: { account_id: z.string().optional() },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      if (!CONFIGURED) return notConfigured("gmo_bank_get_deposit_transactions");
      try {
        return textResult({ data: await callGmo("deposit-transactions"), attribution: ATTRIBUTION });
      } catch (e) {
        return textResult({ error: e instanceof Error ? e.message : String(e), attribution: ATTRIBUTION });
      }
    },
  );

  server.registerTool(
    "gmo_bank_list_accounts",
    {
      title: "口座一覧",
      description: "GMOあおぞらネット銀行の口座一覧を取得する。List bank accounts.",
      inputSchema: {},
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      if (!CONFIGURED) return notConfigured("gmo_bank_list_accounts");
      try {
        return textResult({ data: await callGmo("accounts"), attribution: ATTRIBUTION });
      } catch (e) {
        return textResult({ error: e instanceof Error ? e.message : String(e), attribution: ATTRIBUTION });
      }
    },
  );

  server.registerTool(
    "gmo_bank_get_transfer_status",
    {
      title: "振込状態照会",
      description: "振込依頼の状態を照会する。Get transfer status.",
      inputSchema: { transfer_id: z.string().optional() },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      if (!CONFIGURED) return notConfigured("gmo_bank_get_transfer_status");
      try {
        return textResult({ data: await callGmo("transfer-status"), attribution: ATTRIBUTION });
      } catch (e) {
        return textResult({ error: e instanceof Error ? e.message : String(e), attribution: ATTRIBUTION });
      }
    },
  );

  server.registerTool(
    "gmo_bank_transfer",
    {
      title: "振込依頼",
      description:
        "将来の private connector 用の振込依頼。公開 Gateway では提供しない。Reserved for a future private connector and must be protected by approval token at the Gateway layer.",
      inputSchema: {
        amount_jpy: z.number().int().positive(),
        beneficiary_name: z.string(),
        beneficiary_account: z.string(),
      },
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false, destructiveHint: true },
    },
    async () => notConfigured("gmo_bank_transfer"),
  );

  return server;
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "GMO Bank MCP", configured: CONFIGURED });
});

app.get("/readyz", (_req, res) => {
  res.status(CONFIGURED ? 200 : 503).json({
    ok: CONFIGURED,
    service: "GMO Bank MCP",
    required_env: CONFIGURED ? [] : ["GMO_BANK_API_BASE_URL", "GMO_BANK_ACCESS_TOKEN"],
  });
});

app.post("/mcp", async (req, res) => {
  const mcpServer = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    void transport.close();
    void mcpServer.close();
  });
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({ error: "Use POST /mcp." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.error(`GMO Bank MCP listening on 0.0.0.0:${PORT}`);
});
