// smart-router のユニットテスト（MoneyForward 統合を含む）
// Unit tests for smart-router (including MoneyForward integration)
// Pengujian unit untuk smart-router (termasuk integrasi MoneyForward)

import { describe, expect, it } from "vitest";
import type { ChildMcpServer } from "../../src/registry/schema.js";
import { route } from "../../src/router/smart-router.js";

const jpBidsServer: ChildMcpServer = {
  id: "jp-bids",
  display_name: "JP Bids MCP",
  display_name_en: "JP Bids MCP",
  display_name_id: "JP Bids MCP",
  endpoint: "https://mcp.bid-jp.com/mcp",
  auth_type: "bearer_apikey",
  risk_level: "read_only",
  tool_allowlist: [],
  attribution: { source: "KKJ", license: "gov", url: "https://kkj.go.jp" },
  routing_keywords: ["入札", "公告", "調達", "bid", "procurement", "tender"],
};

const jgrantsServer: ChildMcpServer = {
  id: "jgrants",
  display_name: "Jグランツ MCP",
  display_name_en: "J-Grants MCP",
  display_name_id: "J-Grants MCP",
  endpoint: "http://localhost:8000",
  auth_type: "none",
  risk_level: "read_only",
  tool_allowlist: [],
  attribution: { source: "Jグランツ", license: "MIT", url: "https://www.jgrants-portal.go.jp" },
  routing_keywords: ["補助金", "助成金", "グラント", "subsidy", "grant"],
};

const gmoServer: ChildMcpServer = {
  id: "gmo-bank",
  display_name: "GMO Banking",
  display_name_en: "GMO Banking",
  display_name_id: "GMO Banking",
  endpoint: "http://localhost:8090",
  auth_type: "bearer_apikey",
  risk_level: "financial",
  tool_allowlist: [],
  attribution: { source: "GMO", license: "proprietary", url: "https://gmo-aozora.com" },
  routing_keywords: ["振込", "残高", "入出金", "GMO", "銀行", "bank", "transfer", "balance"],
};

const mfcaServer: ChildMcpServer = {
  id: "moneyforward-ca",
  display_name: "マネーフォワード クラウド会計 MCP",
  display_name_en: "MoneyForward Cloud Accounting MCP",
  display_name_id: "MoneyForward Cloud Accounting MCP",
  endpoint: "https://beta.mcp.developers.biz.moneyforward.com/mcp/ca/v3",
  auth_type: "bearer_oauth",
  risk_level: "financial",
  tool_allowlist: [],
  attribution: {
    source: "株式会社マネーフォワード（クラウド会計）",
    license: "proprietary",
    url: "https://developers.biz.moneyforward.com/mcp/",
  },
  routing_keywords: [
    "仕訳",
    "試算表",
    "残高試算表",
    "推移表",
    "勘定科目",
    "補助科目",
    "部門",
    "税区分",
    "入出金明細",
    "会計年度",
    "事業者情報",
    "MF会計",
    "マネーフォワード",
    "MoneyForward",
    "journal entry",
    "trial balance",
    "accounting period",
  ],
};

const allServers: readonly ChildMcpServer[] = [jpBidsServer, jgrantsServer, gmoServer, mfcaServer];

describe("smart-router: MoneyForward routing", () => {
  it("仕訳を取得して → moneyforward-ca にルーティング / routes '仕訳を取得して' to moneyforward-ca", async () => {
    const result = await route({ query: "仕訳を取得して" }, allServers);
    expect(result).not.toBeNull();
    expect(result?.serverId).toBe("moneyforward-ca");
  });

  it("試算表を見せて → moneyforward-ca にルーティング / routes '試算表を見せて' to moneyforward-ca", async () => {
    const result = await route({ query: "試算表を見せて" }, allServers);
    expect(result).not.toBeNull();
    expect(result?.serverId).toBe("moneyforward-ca");
  });

  it("残高試算表を確認したい → moneyforward-ca にルーティング / routes to moneyforward-ca", async () => {
    const result = await route({ query: "残高試算表を確認したい" }, allServers);
    expect(result).not.toBeNull();
    expect(result?.serverId).toBe("moneyforward-ca");
  });

  it("MoneyForward で勘定科目を確認 → moneyforward-ca / routes English-mixed query", async () => {
    const result = await route({ query: "MoneyForward で勘定科目を確認" }, allServers);
    expect(result).not.toBeNull();
    expect(result?.serverId).toBe("moneyforward-ca");
  });

  it("journal entry を登録 → moneyforward-ca / routes English query", async () => {
    const result = await route({ query: "journal entry を登録したい" }, allServers);
    expect(result).not.toBeNull();
    expect(result?.serverId).toBe("moneyforward-ca");
  });

  it("振込を確認 → gmo-bank にルーティング（MF に向かわない）/ does not route transfer to moneyforward-ca", async () => {
    const result = await route({ query: "振込を確認したい" }, allServers);
    expect(result).not.toBeNull();
    expect(result?.serverId).toBe("gmo-bank");
  });

  it("入札案件 → jp-bids にルーティング（MF に向かわない）/ does not route bid to moneyforward-ca", async () => {
    const result = await route({ query: "入札案件を探して" }, allServers);
    expect(result).not.toBeNull();
    expect(result?.serverId).toBe("jp-bids");
  });

  it("補助金を探して → jgrants にルーティング / routes subsidy to jgrants", async () => {
    const result = await route({ query: "補助金を探して" }, allServers);
    expect(result).not.toBeNull();
    expect(result?.serverId).toBe("jgrants");
  });

  it("明示指定: moneyforward-ca → スコアに関わらずそのサーバーを返す / explicit server_id overrides routing", async () => {
    const result = await route(
      { query: "振込を確認", explicitServerId: "moneyforward-ca" },
      allServers,
    );
    expect(result).not.toBeNull();
    expect(result?.serverId).toBe("moneyforward-ca");
    expect(result?.score).toBe(1000);
  });

  it("スコア同点で risk_level が低い方を優先する / tie-breaking prefers lower risk_level", async () => {
    // 仕訳と残高が同スコアになるように人工的なケース
    // 試算表 は MF のみにマッチするため、この test は tie-breaking を確認するために専用サーバーを用意
    const tiedServers: readonly ChildMcpServer[] = [
      { ...mfcaServer, routing_keywords: ["keyword"] },
      { ...jpBidsServer, routing_keywords: ["keyword"] },
    ];
    const result = await route({ query: "keyword" }, tiedServers);
    expect(result).not.toBeNull();
    // jp-bids は read_only (0), moneyforward-ca は financial (2) → jp-bids が優先
    expect(result?.serverId).toBe("jp-bids");
  });
});
