import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? "8080");
const API_VERSION = process.env.HOUJIN_BANGOU_API_VERSION ?? "12";
const APPLICATION_ID = process.env.HOUJIN_BANGOU_APPLICATION_ID;
const ATTRIBUTION = {
  source: "国税庁 法人番号公表サイト Web-API",
  license: "政府標準利用規約 第2.0版",
  url: "https://www.houjin-bangou.nta.go.jp/webapi/",
};

function createServer() {
  const server = new McpServer(
    {
      name: "Houjin Bangou MCP",
      title: "法人番号 MCP",
      version: "0.1.0",
      description:
        "国税庁 法人番号公表サイト Web-API を利用して法人番号・法人名を検索する読み取り専用 MCP。Read-only MCP for Japan Corporate Number lookup.",
    },
    {
      capabilities: { tools: { listChanged: false } },
      instructions:
        "Use this server for Japanese corporate number and counterparty identity checks. Always cite 国税庁 法人番号公表サイト Web-API.",
    },
  );

  server.registerTool(
    "search_corporations",
    {
      title: "法人名検索",
      description:
        "法人名キーワードで法人番号公表サイトを検索する。Search corporations by name keyword.",
      inputSchema: {
        name: z.string().min(1).describe("法人名または法人名の一部。Corporate name keyword."),
        limit: z.number().int().min(1).max(50).optional().default(10),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
        destructiveHint: false,
      },
    },
    async ({ name, limit }) => {
      if (!APPLICATION_ID) {
        return textResult({
          error: "HOUJIN_BANGOU_APPLICATION_ID is not configured.",
          next_step:
            "Set HOUJIN_BANGOU_APPLICATION_ID to a National Tax Agency Corporate Number Web-API application ID.",
          attribution: ATTRIBUTION,
        });
      }

      const url = new URL(
        `https://api.houjin-bangou.nta.go.jp/${API_VERSION}/name`,
      );
      url.searchParams.set("id", APPLICATION_ID);
      url.searchParams.set("name", name);
      url.searchParams.set("type", "12");
      url.searchParams.set("history", "0");

      const data = await fetchJson(url);
      return textResult({
        query: { name, limit },
        results: normalizeCorporations(data).slice(0, limit),
        attribution: ATTRIBUTION,
      });
    },
  );

  server.registerTool(
    "get_corporation_by_number",
    {
      title: "法人番号検索",
      description:
        "13桁の法人番号で法人基本情報を取得する。Get corporation details by 13-digit corporate number.",
      inputSchema: {
        corporate_number: z
          .string()
          .regex(/^\\d{13}$/)
          .describe("13桁の法人番号。13-digit corporate number."),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
        destructiveHint: false,
      },
    },
    async ({ corporate_number }) => {
      if (!APPLICATION_ID) {
        return textResult({
          error: "HOUJIN_BANGOU_APPLICATION_ID is not configured.",
          next_step:
            "Set HOUJIN_BANGOU_APPLICATION_ID to a National Tax Agency Corporate Number Web-API application ID.",
          attribution: ATTRIBUTION,
        });
      }

      const url = new URL(
        `https://api.houjin-bangou.nta.go.jp/${API_VERSION}/num`,
      );
      url.searchParams.set("id", APPLICATION_ID);
      url.searchParams.set("number", corporate_number);
      url.searchParams.set("type", "12");
      url.searchParams.set("history", "0");

      const data = await fetchJson(url);
      return textResult({
        query: { corporate_number },
        results: normalizeCorporations(data),
        attribution: ATTRIBUTION,
      });
    },
  );

  server.registerTool(
    "get_corporation_history",
    {
      title: "法人番号履歴検索",
      description:
        "13桁の法人番号で変更履歴を含む法人情報を取得する。Get corporation details with change history.",
      inputSchema: {
        corporate_number: z
          .string()
          .regex(/^\\d{13}$/)
          .describe("13桁の法人番号。13-digit corporate number."),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
        destructiveHint: false,
      },
    },
    async ({ corporate_number }) => {
      if (!APPLICATION_ID) {
        return textResult({
          error: "HOUJIN_BANGOU_APPLICATION_ID is not configured.",
          next_step:
            "Set HOUJIN_BANGOU_APPLICATION_ID to a National Tax Agency Corporate Number Web-API application ID.",
          attribution: ATTRIBUTION,
        });
      }

      const url = new URL(
        `https://api.houjin-bangou.nta.go.jp/${API_VERSION}/num`,
      );
      url.searchParams.set("id", APPLICATION_ID);
      url.searchParams.set("number", corporate_number);
      url.searchParams.set("type", "12");
      url.searchParams.set("history", "1");

      const data = await fetchJson(url);
      return textResult({
        query: { corporate_number, history: true },
        results: normalizeCorporations(data),
        attribution: ATTRIBUTION,
      });
    },
  );

  return server;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Corporate Number API HTTP ${response.status}: ${body}`);
  }
  return response.json();
}

function normalizeCorporations(data) {
  const rows = Array.isArray(data?.corporations)
    ? data.corporations
    : Array.isArray(data?.corporation)
      ? data.corporation
      : [];
  return rows.map((row) => ({
    corporate_number: row.corporateNumber ?? row.corporate_number,
    name: row.name,
    name_image_id: row.nameImageId,
    prefecture_name: row.prefectureName,
    city_name: row.cityName,
    street_number: row.streetNumber,
    address: [row.prefectureName, row.cityName, row.streetNumber].filter(Boolean).join(""),
    change_date: row.changeDate,
    update_date: row.updateDate,
    assignment_date: row.assignmentDate,
    process: row.process,
    correct: row.correct,
  }));
}

function textResult(payload) {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "Houjin Bangou MCP",
    configured: Boolean(APPLICATION_ID),
  });
});

app.get("/readyz", (_req, res) => {
  res.status(APPLICATION_ID ? 200 : 503).json({
    ok: Boolean(APPLICATION_ID),
    service: "Houjin Bangou MCP",
    required_env: APPLICATION_ID ? [] : ["HOUJIN_BANGOU_APPLICATION_ID"],
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
  console.error(`Houjin Bangou MCP listening on 0.0.0.0:${PORT}`);
});
