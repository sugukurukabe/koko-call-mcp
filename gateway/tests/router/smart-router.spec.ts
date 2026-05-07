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

const houjinServer: ChildMcpServer = {
  id: "houjin-bangou",
  display_name: "法人番号 MCP",
  display_name_en: "Corporate Number MCP",
  display_name_id: "MCP Nomor Korporasi",
  endpoint: "http://localhost:8092",
  auth_type: "bearer_apikey",
  risk_level: "read_only",
  tool_allowlist: [],
  attribution: {
    source: "国税庁 法人番号公表サイト Web-API",
    license: "政府標準利用規約 第2.0版",
    url: "https://www.houjin-bangou.nta.go.jp/webapi/",
  },
  routing_keywords: [
    "法人番号",
    "法人",
    "会社",
    "取引先",
    "法人名",
    "所在地",
    "13桁",
    "corporate number",
    "company",
    "corporation",
  ],
};

const realEstateServer: ChildMcpServer = {
  id: "real-estate-intel",
  display_name: "不動産インテル MCP",
  display_name_en: "Japan Real Estate Intel MCP",
  display_name_id: "MCP Intelijen Real Estat Jepang",
  endpoint: "http://localhost:8093",
  auth_type: "none",
  risk_level: "read_only",
  tool_allowlist: [],
  attribution: {
    source: "国土交通省 不動産情報ライブラリ",
    license: "MIT",
    url: "https://github.com/sugukurukabe/japan-real-estate-intel-mcp",
  },
  routing_keywords: [
    "不動産",
    "地価",
    "取引価格",
    "災害リスク",
    "人流",
    "投資",
    "出店",
    "store location",
    "real estate",
    "land price",
    "property",
  ],
};

const allServers: readonly ChildMcpServer[] = [
  jpBidsServer,
  jgrantsServer,
  mfcaServer,
  houjinServer,
  realEstateServer,
];

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
    const tiedServers: readonly ChildMcpServer[] = [
      { ...mfcaServer, routing_keywords: ["keyword"] },
      { ...jpBidsServer, routing_keywords: ["keyword"] },
    ];
    const result = await route({ query: "keyword" }, tiedServers);
    expect(result).not.toBeNull();
    expect(result?.serverId).toBe("jp-bids");
  });
});

describe("smart-router: 法人番号 MCP routing", () => {
  it("法人番号を検索して → houjin-bangou にルーティング / routes corporate number query", async () => {
    const result = await route({ query: "法人番号を検索して" }, allServers);
    expect(result).not.toBeNull();
    expect(result?.serverId).toBe("houjin-bangou");
  });

  it("取引先の会社情報を確認 → houjin-bangou にルーティング / routes company check query", async () => {
    const result = await route({ query: "取引先の会社情報を確認したい" }, allServers);
    expect(result).not.toBeNull();
    expect(result?.serverId).toBe("houjin-bangou");
  });

  it("corporate number lookup → houjin-bangou / routes English query", async () => {
    const result = await route({ query: "corporate number lookup" }, allServers);
    expect(result).not.toBeNull();
    expect(result?.serverId).toBe("houjin-bangou");
  });
});

describe("smart-router: 不動産インテル MCP routing", () => {
  it("地価を調べて → real-estate-intel にルーティング / routes land price query", async () => {
    const result = await route({ query: "新宿区の地価を調べて" }, allServers);
    expect(result).not.toBeNull();
    expect(result?.serverId).toBe("real-estate-intel");
  });

  it("不動産投資の分析 → real-estate-intel / routes investment analysis query", async () => {
    const result = await route({ query: "不動産投資の分析をしたい" }, allServers);
    expect(result).not.toBeNull();
    expect(result?.serverId).toBe("real-estate-intel");
  });

  it("出店候補地の災害リスク → real-estate-intel / routes store location query", async () => {
    const result = await route({ query: "出店候補地の災害リスクを確認" }, allServers);
    expect(result).not.toBeNull();
    expect(result?.serverId).toBe("real-estate-intel");
  });

  it("real estate analysis → real-estate-intel / routes English query", async () => {
    const result = await route({ query: "real estate land price trend" }, allServers);
    expect(result).not.toBeNull();
    expect(result?.serverId).toBe("real-estate-intel");
  });
});
