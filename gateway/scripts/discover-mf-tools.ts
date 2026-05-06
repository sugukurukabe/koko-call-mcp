#!/usr/bin/env node
// MoneyForward クラウド会計 MCP のツール一覧を取得するスクリプト
// Script to discover MoneyForward Cloud Accounting MCP tool list
// Skrip untuk menemukan daftar alat MoneyForward Cloud Accounting MCP
//
// 使い方 / Usage / Penggunaan:
//   MONEYFORWARD_OAUTH_TOKEN=<your_token> npx tsx scripts/discover-mf-tools.ts
//
// アプリポータルで取得した OAuth アクセストークンを環境変数にセットして実行する。
// Set the OAuth access token obtained from App Portal as an environment variable.
// Atur token akses OAuth yang diperoleh dari App Portal sebagai variabel lingkungan.
//
// 出力 / Output / Keluaran:
//   JSON: { tools: [...], write_tools: [...], read_tools: [...] }
//   write_tools は registry の tool_policies.required_approval 対象候補
//   read_tools は tool_modes.financial_check 対象候補

const BETA_ENDPOINT = "https://beta.mcp.developers.biz.moneyforward.com/mcp/ca/v3";

// 書き込み系ツール名のパターン（実際のツール名が判明した後に更新する）
// Write tool name patterns (update after actual tool names are discovered)
// Pola nama alat tulis (perbarui setelah nama alat aktual diketahui)
const WRITE_TOOL_PATTERNS = [
  /create/i,
  /update/i,
  /delete/i,
  /post/i,
  /put/i,
  /register/i,
  /add/i,
  /edit/i,
];

function isWriteTool(toolName: string): boolean {
  return WRITE_TOOL_PATTERNS.some((p) => p.test(toolName));
}

async function discoverTools(): Promise<void> {
  const oauthToken = process.env.MONEYFORWARD_OAUTH_TOKEN;
  if (!oauthToken) {
    console.error(
      "Error: MONEYFORWARD_OAUTH_TOKEN is required.\n" +
        "Usage: MONEYFORWARD_OAUTH_TOKEN=<token> npx tsx scripts/discover-mf-tools.ts\n" +
        "Obtain the token from MoneyForward App Portal: https://app-portal.moneyforward.com/",
    );
    process.exit(1);
  }

  const endpoint = process.env.MONEYFORWARD_ENDPOINT ?? BETA_ENDPOINT;
  console.error(`[discover-mf-tools] Querying ${endpoint} ...`);

  const jsonRpcRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {},
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "MCP-Protocol-Version": "2025-11-25",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${oauthToken}`,
      },
      body: JSON.stringify(jsonRpcRequest),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    console.error(
      `[discover-mf-tools] Fetch failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    process.exit(1);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "(unreadable)");
    console.error(`[discover-mf-tools] HTTP ${response.status}: ${body}`);
    process.exit(1);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  let data: unknown;

  if (contentType.includes("text/event-stream") || text.includes("\ndata:")) {
    const dataLines = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .filter((line) => line.length > 0 && line !== "[DONE]");
    data = JSON.parse(dataLines[dataLines.length - 1] ?? "{}");
  } else {
    data = JSON.parse(text.trim());
  }

  const rpc = data as Record<string, unknown>;
  if ("error" in rpc) {
    console.error(`[discover-mf-tools] RPC error: ${JSON.stringify(rpc.error)}`);
    process.exit(1);
  }

  const result = rpc.result as Record<string, unknown> | undefined;
  const tools = result?.tools;
  if (!Array.isArray(tools)) {
    console.error(`[discover-mf-tools] Unexpected response shape: ${JSON.stringify(rpc)}`);
    process.exit(1);
  }

  const toolNames: string[] = tools.map(
    (t: unknown) => (t as Record<string, string>).name ?? "(unknown)",
  );
  const writeTools = toolNames.filter(isWriteTool);
  const readTools = toolNames.filter((n) => !isWriteTool(n));

  const output = {
    endpoint,
    discovered_at: new Date().toISOString(),
    tool_count: toolNames.length,
    tools: toolNames,
    read_tools: readTools,
    write_tools: writeTools,
    // registry.json への追加例 / Example additions for registry.json
    registry_suggestions: {
      tool_allowlist: toolNames,
      tool_modes: {
        financial_check: readTools,
        full_orchestration: toolNames,
      },
      tool_policies: Object.fromEntries(
        writeTools.map((name) => [
          name,
          { required_approval: true, compliance_check: ["accounting_period_open"] },
        ]),
      ),
    },
  };

  // JSON を stdout に出力する（リダイレクト用）
  // Output JSON to stdout (for redirection)
  // Output JSON ke stdout (untuk pengalihan)
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  console.error(
    `[discover-mf-tools] Done. ${toolNames.length} tools found (${writeTools.length} write, ${readTools.length} read).`,
  );
  console.error(
    "Update gateway/config/registry.json with the registry_suggestions above.\n" +
      "Perbarui gateway/config/registry.json dengan saran registry_suggestions di atas.",
  );
}

discoverTools().catch((e) => {
  console.error(
    `[discover-mf-tools] Unexpected error: ${e instanceof Error ? e.message : String(e)}`,
  );
  process.exit(1);
});
