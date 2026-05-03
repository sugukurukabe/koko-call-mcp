import { type McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KkjClient } from "../api/kkj-client.js";
import { createAttribution } from "../domain/attribution.js";
import { daysAgoDate, formatKkjDateRange } from "../domain/date-range.js";
import { prefectureCodeToName, prefectureEntries } from "../domain/prefectures.js";
import { jsonText } from "../lib/tool-result.js";

// NOTE: agenticCloudRoadmapText and agenticSecurityStorageReadinessText below are intentionally
// embedded as constants so the MCP server has zero filesystem dependency at runtime. The
// human-maintained docs live at:
//   - docs/agentic-cloud-roadmap.md
//   - docs/agentic-security-storage-readiness.md
// Keep the text here aligned with those files when either side is updated. The contract test
// in tests/contract.test.ts pins the key phrases so accidental drift is caught quickly.

const resourceLastModified = "2026-05-02T00:00:00.000Z";

export function registerResources(server: McpServer, client: KkjClient): void {
  server.registerResource(
    "kkj_attribution",
    "attribution://kkj",
    {
      title: "KKJ Attribution",
      description: "官公需情報ポータルサイトの出典情報。",
      mimeType: "application/json",
      annotations: {
        audience: ["user", "assistant"],
        priority: 1,
        lastModified: resourceLastModified,
      },
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: jsonText(createAttribution()),
        },
      ],
    }),
  );

  server.registerResource(
    "kkj_api_reference",
    "docs://api-reference",
    {
      title: "KKJ API Reference",
      description: "JP Bids MCPで使うKKJ APIパラメータの要約。",
      mimeType: "text/markdown",
      annotations: {
        audience: ["assistant"],
        priority: 0.8,
        lastModified: resourceLastModified,
      },
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: [
            "# KKJ API Reference",
            "",
            "- Endpoint: `http://www.kkj.go.jp/api/`",
            "- Required: one of `Query`, `Project_Name`, `Organization_Name`, `LG_Code`",
            "- Response: XML",
            "- Count: max 1,000",
          ].join("\n"),
        },
      ],
    }),
  );

  server.registerResource(
    "prefecture_codes",
    "codes://prefectures",
    {
      title: "JIS X0401 Prefecture Codes",
      description: "都道府県名とLG_Codeの対応表。",
      mimeType: "application/json",
      annotations: {
        audience: ["user", "assistant"],
        priority: 0.7,
        lastModified: resourceLastModified,
      },
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: jsonText(prefectureEntries),
        },
      ],
    }),
  );

  server.registerResource(
    "agentic_cloud_roadmap",
    "docs://agentic-cloud-roadmap",
    {
      title: "Agentic Cloud Roadmap",
      description:
        "Google-managed MCP、Gemini Enterprise、Workspace、Agentic Data Cloudに基づくAI Bid Radar拡張ロードマップ。",
      mimeType: "text/markdown",
      annotations: {
        audience: ["assistant"],
        priority: 0.8,
        lastModified: resourceLastModified,
      },
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: agenticCloudRoadmapText,
        },
      ],
    }),
  );

  server.registerResource(
    "agentic_security_storage_readiness",
    "docs://agentic-security-storage-readiness",
    {
      title: "Agentic Security & Storage Readiness",
      description:
        "Cloud Storage Smart Storage、Gemini Enterprise Agent Platform、Fraud Defense、multicloud securityに基づくAI Bid Radar readiness note。",
      mimeType: "text/markdown",
      annotations: {
        audience: ["assistant"],
        priority: 0.8,
        lastModified: resourceLastModified,
      },
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: agenticSecurityStorageReadinessText,
        },
      ],
    }),
  );

  server.registerResource(
    "bid_detail_template",
    new ResourceTemplate("bid://{bid_key}", {
      list: undefined,
      complete: {
        bid_key: (value) => client.completeBidKeys(value),
      },
    }),
    {
      title: "Bid Detail Template",
      description: "直近検索済みのbid_keyを補完し、該当Keyの検索導線を返す。",
      mimeType: "application/json",
      annotations: {
        audience: ["assistant"],
        priority: 0.9,
        lastModified: resourceLastModified,
      },
    },
    (uri, variables) => {
      const bidKey = String(variables.bid_key ?? "");
      const cachedBid = client.getCachedBid(bidKey);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: jsonText(
              cachedBid
                ? { bidKey, bid: cachedBid, attribution: createAttribution() }
                : {
                    bidKey,
                    instruction:
                      "Use get_bid_detail with this bid_key to fetch the current official detail.",
                  },
            ),
          },
        ],
      };
    },
  );

  server.registerResource(
    "prefecture_template",
    new ResourceTemplate("prefecture://{lg_code}", {
      list: undefined,
      complete: {
        lg_code: (value) =>
          prefectureEntries
            .map((entry) => entry.code)
            .filter((code) => code.startsWith(value))
            .slice(0, 47),
      },
    }),
    {
      title: "Prefecture Code Template",
      description: "LG_Codeから都道府県名を参照する。",
      mimeType: "application/json",
      annotations: {
        audience: ["user", "assistant"],
        priority: 0.6,
        lastModified: resourceLastModified,
      },
    },
    (uri, variables) => {
      const code = String(variables.lg_code ?? "");
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: jsonText({ code, name: prefectureCodeToName.get(code) ?? null }),
          },
        ],
      };
    },
  );

  server.registerResource(
    "organization_summary_template",
    new ResourceTemplate("org://{organization_name}", {
      list: undefined,
      complete: {
        organization_name: (value) => client.completeOrganizationNames(value),
      },
    }),
    {
      title: "Organization Summary Template",
      description: "発注機関名から直近1年の入札傾向を読み取り専用コンテキストとして返す。",
      mimeType: "application/json",
      annotations: {
        audience: ["assistant"],
        priority: 0.8,
        lastModified: resourceLastModified,
      },
    },
    async (uri, variables) => {
      const organizationName = decodeURIComponent(String(variables.organization_name ?? ""));
      const since = daysAgoDate(365);
      const issueRange = formatKkjDateRange(since, undefined);
      const result = await client.search({
        Organization_Name: organizationName,
        Count: 200,
        ...(issueRange ? { CFT_Issue_Date: issueRange } : {}),
      });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: jsonText({
              organizationName,
              since,
              totalHits: result.searchHits,
              returnedCount: result.returnedCount,
              categories: countBy(result.bids.map((bid) => bid.category ?? "不明")),
              procedureTypes: countBy(result.bids.map((bid) => bid.procedureType ?? "不明")),
              recentProjects: result.bids.slice(0, 20),
              attribution: result.attribution,
            }),
          },
        ],
      };
    },
  );
}

const agenticCloudRoadmapText = [
  "# Agentic Cloud Roadmap",
  "",
  "AI Bid Radar should evolve from bid search into a bid-decision agent that spans Google Cloud, Gemini Enterprise, Workspace, CRM, and databases.",
  "",
  "Official signals as of May 2026:",
  "",
  "- Google-managed MCP servers: 50+ Google Cloud / Workspace MCP servers, Agent Registry, IAM Deny, Model Armor, OTel Tracing, Cloud Audit Logs.",
  "- Gemini Enterprise: Agent Platform, ADK, MCP/A2A, Agent Identity, Agent Gateway, Model Armor, Agent Observability, Memory Bank.",
  "- Salesforce + Google Cloud deep context: Slack, Google Workspace, Salesforce, BigQuery/Lakehouse, and zero-copy context.",
  "- Agentic Data Cloud: AlloyDB / Cloud SQL / Spanner / Firestore / BigQuery / Knowledge Catalog / managed remote MCP servers.",
  "- MCP RequestContext pattern: keep session/request context request-local and do not reuse stateful request objects across requests.",
  "",
  "Priority order:",
  "",
  "1. Workspace MCP integration: Drive, Calendar, Gmail, Chat.",
  "2. Gemini / Document AI: PDF specification understanding with prompt-injection safeguards.",
  "3. Agentic Data Cloud: BigQuery, AlloyDB / Cloud SQL, Knowledge Catalog.",
  "4. Managed MCP / Governance: IAM Deny, Model Armor, Cloud Audit Logs, OTel tracing, Agent Registry.",
  "",
  "Design principles:",
  "",
  "- Use standard MCP Tools / Prompts / Resources first.",
  "- Keep RequestContext-like state request-local.",
  "- Do not mix secrets, OAuth tokens, or customer data into tool output.",
  "- Treat upstream PDFs and bid text as untrusted data.",
  "- Keep data where it lives; prefer zero-copy and managed connectors.",
].join("\n");

const agenticSecurityStorageReadinessText = [
  "# Agentic Security & Storage Readiness",
  "",
  "AI Bid Radar needs agent-ready storage and agentic security before it handles bid PDFs, CSVs, internal review files, and future CRM/Workspace integrations at scale.",
  "",
  "Official signals as of May 2026:",
  "",
  "- Cloud Storage Rapid / Smart Storage: high-performance object storage, object context, automated annotations, Cloud Storage MCP server.",
  "- Storage Intelligence: zero-configuration dashboards, activity tables, batch operations, and Data Security Posture Management integration.",
  "- Gemini Enterprise Agent Platform: ADK, graph-based multi-agent systems, Agent Runtime, Memory Bank, Agent Sessions, Agent Gateway, Agent Identity, Model Armor, Agent Simulation, Agent Observability.",
  "- Google Cloud Fraud Defense: agentic activity measurement, agentic policy engine, AI-resistant challenge, and agent/human identity risk management.",
  "- Multicloud / multi-AI security: use Agent Gateway, Model Armor, and Agent Identity to govern agent-data boundaries.",
  "- Partner-built agents: Agent Gallery / Marketplace brings specialized agents through IT approval flows.",
  "- Next '26 codelabs: ADK + A2UI, multi-agent systems, AlloyDB NL2SQL, secure agents, Maps grounding, and Cloud Run productionization.",
  "",
  "Implementation order:",
  "",
  "1. Start PDF requirement extraction as ephemeral processing; make storage opt-in.",
  "2. If Cloud Storage is added, require object metadata: source, bid_key, retention, classification, processed_at.",
  "3. Use Model Armor for bid text/PDF prompt-injection defense before production.",
  "4. Use Agent Identity and Agent Gateway before allowing agents to act across Workspace, BigQuery, Storage, and CRM.",
  "5. Do not automate bid submissions in the MVP; keep human-in-the-loop and official verification mandatory.",
].join("\n");

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}
