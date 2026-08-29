/**
 * JP Bids MCP リモートエンドポイント 申請前検証スクリプト
 * Pre-submission remote endpoint verification script for JP Bids MCP
 * Skrip verifikasi endpoint jarak jauh sebelum pengajuan untuk JP Bids MCP
 *
 * 使い方 / Usage / Penggunaan:
 *   npm run remote:mcp
 *   JP_BIDS_REMOTE_MCP_URL=https://mcp.bid-jp.com/mcp \
 *     JP_BIDS_REMOTE_API_KEY=your-pro-key npm run remote:mcp
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { isInBetaPeriod } from "../src/lib/auth.js";

const remoteMcpUrl = process.env.JP_BIDS_REMOTE_MCP_URL ?? "https://mcp.bid-jp.com/mcp";
const apiKey = process.env.JP_BIDS_REMOTE_API_KEY ?? "free";
const verifiedAt = new Date().toISOString();

// 全22ツールの期待する annotations
// Expected annotations for all 22 tools
// Anotasi yang diharapkan untuk semua 22 alat
const EXPECTED_TOOLS: { name: string; readOnlyHint: boolean; title: string }[] = [
  { name: "search_bids", readOnlyHint: true, title: "官公需入札検索" },
  { name: "rank_bids", readOnlyHint: true, title: "入札AI Bid Radar" },
  { name: "list_recent_bids", readOnlyHint: true, title: "直近の官公需入札一覧" },
  { name: "get_bid_detail", readOnlyHint: true, title: "官公需入札詳細" },
  { name: "search_bids_app", readOnlyHint: true, title: "AI Bid Workspace" },
  { name: "explain_bid_fit", readOnlyHint: true, title: "入札追跡判断の説明" },
  { name: "assess_bid_qualification", readOnlyHint: true, title: "入札資格適合MVP判定" },
  { name: "extract_bid_requirements", readOnlyHint: true, title: "入札要件抽出MVP" },
  { name: "export_bid_shortlist", readOnlyHint: true, title: "入札検討shortlist CSV" },
  { name: "create_bid_calendar", readOnlyHint: true, title: "入札締切カレンダーICS" },
  { name: "create_bid_review_packet", readOnlyHint: true, title: "入札社内検討パック" },
  { name: "draft_bid_questions", readOnlyHint: true, title: "入札質問書ドラフト" },
  { name: "analyze_past_awards", readOnlyHint: true, title: "過去公告・競合レーダー" },
  { name: "summarize_bids_by_org", readOnlyHint: true, title: "発注機関別入札傾向" },
  { name: "save_search", readOnlyHint: false, title: "検索条件を保存" },
  { name: "check_saved_search", readOnlyHint: false, title: "保存検索の新着確認" },
  { name: "list_saved_searches", readOnlyHint: true, title: "保存検索の一覧" },
  { name: "map_awards_to_listed", readOnlyHint: true, title: "公告を上場企業へ名寄せ" },
  { name: "get_listed_award_history", readOnlyHint: true, title: "上場企業の官公需公告履歴" },
  { name: "analyze_award_price_impact", readOnlyHint: true, title: "公告日前後の株価推移" },
  { name: "watch_listed_awards", readOnlyHint: false, title: "上場企業の公告ウォッチ" },
  { name: "search_investor_radar_app", readOnlyHint: true, title: "Investor Radar" },
];

const FREE_TOOLS = ["search_bids", "rank_bids", "list_recent_bids", "get_bid_detail"];
// bid_discovery_workspace / competitor_radar / bid_review_packet_workflow /
// qualification_and_question_draft は tier === "pro" のときのみ registerPrompt される
// (src/prompts/register-prompts.ts)。Free tierでは登録されないため、期待値も分ける。
// bid_discovery_workspace / competitor_radar / bid_review_packet_workflow /
// qualification_and_question_draft are only registered when tier === "pro"
// (src/prompts/register-prompts.ts). They are absent on Free tier, so the
// expected prompt list must be split the same way EXPECTED_TOOLS/FREE_TOOLS is.
const FREE_PROMPTS = ["morning_bid_briefing", "bid_due_alert"];
const EXPECTED_PROMPTS = [
  "morning_bid_briefing",
  "bid_discovery_workspace",
  "competitor_radar",
  "bid_review_packet_workflow",
  "qualification_and_question_draft",
  "investor_radar_briefing",
  "bid_due_alert",
];
const log = (msg: string) => console.error(msg);
const pass = (label: string) => log(`  ✅ ${label}`);
const fail = (label: string) => {
  log(`  ❌ ${label}`);
};

let failures = 0;

function check(condition: boolean, label: string): void {
  if (condition) {
    pass(label);
  } else {
    fail(label);
    failures++;
  }
}

const isProTier = apiKey !== "free";
const expectsProSurface = isProTier || isInBetaPeriod();

log(`\n================================================`);
log(`JP Bids MCP 申請前検証 / Pre-submission Verification`);
log(`================================================`);
log(`URL: ${remoteMcpUrl}`);
log(`Tier: ${expectsProSurface ? (isProTier ? "Pro" : "Free key (beta Pro surface)") : "Free"}`);
log(`Verified at: ${verifiedAt}`);
log("");

const client = new Client({ name: "jp-bids-review-check", version: "0.1.0" });

const headers: Record<string, string> = {
  Authorization: `Bearer ${apiKey}`,
  Origin: process.env.JP_BIDS_REMOTE_ORIGIN ?? "https://mcp.bid-jp.com",
};

const transport = new StreamableHTTPClientTransport(new URL(remoteMcpUrl), {
  requestInit: { headers },
});

try {
  await client.connect(transport);
  log("✅ connect: MCP session established");

  // コネクタ表示名が "JP Bids"（"MCP" を含まない）であることを確認する
  // Confirm the connector display name is "JP Bids" (no "MCP" in the directory name)
  // Pastikan nama tampilan konektor adalah "JP Bids" (tanpa "MCP" pada nama direktori)
  const serverInfo = client.getServerVersion();
  check(serverInfo?.name === "JP Bids", `serverInfo.name === "JP Bids" (got ${serverInfo?.name})`);

  // --- 1. tools/list ---
  log("\n[1/6] tools/list + annotation parity");
  const { tools } = await client.listTools();
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  const expectedNames = expectsProSurface ? EXPECTED_TOOLS.map((t) => t.name) : FREE_TOOLS;

  for (const expected of expectedNames) {
    const found = toolMap.get(expected);
    check(!!found, `tool present: ${expected}`);
    if (!found) continue;
    check(!!found.title, `${expected}: has title (="${found.title}")`);
    const ann = found.annotations ?? {};
    const hasAnnHint = "readOnlyHint" in ann || "destructiveHint" in ann;
    check(hasAnnHint, `${expected}: has readOnlyHint or destructiveHint`);
    const expectedTool = EXPECTED_TOOLS.find((t) => t.name === expected);
    if (expectedTool) {
      check(
        ann.readOnlyHint === expectedTool.readOnlyHint,
        `${expected}: readOnlyHint === ${String(expectedTool.readOnlyHint)} (got ${String(ann.readOnlyHint)})`,
      );
    }
  }

  // Check for unexpected tools on free tier
  if (!expectsProSurface) {
    for (const tool of tools) {
      if (!FREE_TOOLS.includes(tool.name)) {
        check(false, `Free tier should NOT expose: ${tool.name}`);
      }
    }
  }

  // --- 2. prompts/list ---
  log("\n[2/6] prompts/list");
  const { prompts } = await client.listPrompts();
  const promptNames = prompts.map((p) => p.name);
  const expectedPromptNames = expectsProSurface ? EXPECTED_PROMPTS : FREE_PROMPTS;
  for (const name of expectedPromptNames) {
    check(promptNames.includes(name), `prompt present: ${name}`);
  }

  // Check for unexpected Pro-only prompts on free tier
  if (!expectsProSurface) {
    for (const name of promptNames) {
      if (!FREE_PROMPTS.includes(name)) {
        check(false, `Free tier should NOT expose prompt: ${name}`);
      }
    }
  }

  // --- 3. resources/list ---
  log("\n[3/6] resources/list");
  const { resources } = await client.listResources();
  const resourceUris = resources.map((r) => r.uri);
  for (const uri of ["attribution://kkj", "docs://api-reference", "codes://prefectures"]) {
    check(resourceUris.includes(uri), `resource present: ${uri}`);
  }
  if (expectsProSurface) {
    check(
      resourceUris.includes("ui://jp-bids/search-results.html"),
      "resource present: ui://jp-bids/search-results.html (MCP Apps)",
    );
    check(
      resourceUris.includes("ui://jp-bids/investor-radar.html"),
      "resource present: ui://jp-bids/investor-radar.html (Investor Radar)",
    );
  }

  // --- 4. representative tool calls ---
  log("\n[4/6] representative tool calls");

  // search_bids
  const searchResult = await client.callTool({
    name: "search_bids",
    arguments: { query: "システム", prefecture: "鹿児島県", limit: 3 },
  });
  check(!searchResult.isError, "search_bids call succeeds");
  const sc = searchResult.structuredContent as {
    bids?: unknown[];
    searchHits?: number;
    attribution?: { dataSource?: string };
  } | null;
  check(!!sc?.attribution?.dataSource, "search_bids: attribution.dataSource present");
  check(
    sc?.attribution?.dataSource === "中小企業庁 官公需情報ポータルサイト",
    `search_bids: attribution is KKJ (got "${sc?.attribution?.dataSource}")`,
  );

  // get_bid_detail with resource_link check
  if (sc?.bids && Array.isArray(sc.bids) && sc.bids.length > 0) {
    const bid = sc.bids[0] as { key?: string };
    if (bid.key) {
      const detailResult = await client.callTool({
        name: "get_bid_detail",
        arguments: { bid_key: bid.key },
      });
      check(!detailResult.isError, "get_bid_detail call succeeds");
      const textContent = detailResult.content.find((c) => c.type === "text");
      check(!!textContent, "get_bid_detail: has text content");
      const resourceLinks = detailResult.content.filter((c) => c.type === "resource_link");
      log(`    ℹ️  get_bid_detail: ${resourceLinks.length} resource_link(s) in response`);
    }
  }

  // Pro-only tool: rank_bids
  if (expectsProSurface) {
    const rankResult = await client.callTool({
      name: "rank_bids",
      arguments: { query: "システム", prefecture: "鹿児島県", shortlist_limit: 3 },
    });
    check(!rankResult.isError, "rank_bids call succeeds");
    const rsc = rankResult.structuredContent as { rankedBids?: unknown[] } | null;
    check(Array.isArray(rsc?.rankedBids), "rank_bids: structuredContent.rankedBids is array");
  }

  // --- 5. completion ---
  log("\n[5/6] completion");
  const completion = await client.complete({
    ref: { type: "ref/resource", uri: "prefecture://{lg_code}" },
    argument: { name: "lg_code", value: "4" },
  });
  check(
    completion.completion.values.includes("46"),
    `prefecture completion includes "46" (Kagoshima)`,
  );

  // --- 6. MCP Apps resource (Pro only) ---
  if (expectsProSurface) {
    log("\n[6/6] MCP Apps UI resource");
    const uiResource = await client.readResource({
      uri: "ui://jp-bids/search-results.html",
    });
    check(
      uiResource.contents[0]?.mimeType === "text/html;profile=mcp-app",
      `ui resource mimeType === "text/html;profile=mcp-app"`,
    );
    check((uiResource.contents[0]?.text?.length ?? 0) > 0, "ui resource has HTML content");
    const uiHtml = uiResource.contents[0]?.text ?? "";
    check(
      uiHtml.includes("プロンプトをコピーしました"),
      "ui bundle has graceful action fallback (clipboard copy)",
    );
    check(
      !uiHtml.includes("Host側で拒否されました"),
      'ui bundle has no alarming "Host側で拒否されました" message',
    );
  } else {
    log("\n[6/6] MCP Apps UI resource — skipped (Free tier)");
  }

  // --- Summary ---
  log("\n================================================");
  log("Verification Summary / 検証結果サマリー");
  log("================================================");
  if (failures === 0) {
    log("✅ ALL CHECKS PASSED — ready for Anthropic submission");
  } else {
    log(`❌ ${failures} check(s) FAILED — fix before submitting`);
  }
  log(`Verified at: ${verifiedAt}`);
  log(`URL: ${remoteMcpUrl}`);
  log(`Tier: ${expectsProSurface ? (isProTier ? "Pro" : "Free key (beta Pro surface)") : "Free"}`);
  log("================================================\n");
} finally {
  await client.close();
}

if (failures > 0) {
  process.exit(1);
}
