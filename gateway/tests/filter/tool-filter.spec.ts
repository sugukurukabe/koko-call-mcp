// Dynamic Tool Surface の mode 一般化を検証する
// Verify generalized modes for Dynamic Tool Surface
// Memverifikasi mode umum untuk Dynamic Tool Surface

import { describe, expect, it } from "vitest";
import {
  filterTools,
  isServerVisibleInMode,
  isToolPermitted,
} from "../../src/filter/tool-filter.js";
import type { ChildMcpServer } from "../../src/registry/schema.js";

const agriopsServer: ChildMcpServer = {
  id: "agriops",
  display_name: "AgriOps MCP（農業・自治体統計）",
  display_name_en: "AgriOps MCP (Agriculture and Municipality Statistics)",
  display_name_id: "AgriOps MCP (Statistik Pertanian dan Kota)",
  endpoint: "http://localhost:8091",
  auth_type: "none",
  risk_level: "read_only",
  tool_allowlist: [],
  tool_modes: {
    agri_research: ["get_municipality_stats"],
    municipality_analysis: ["get_municipality_stats"],
    financial_check: [],
    full_orchestration: [],
  },
  cache_ttl_seconds: 300,
  attribution: {
    source: "AgriOps MCP (@sugukuru/agriops-mcp)",
    license: "Apache-2.0",
    url: "https://github.com/WIN-kagoshima/agriops-mcp",
  },
  routing_keywords: ["農業", "自治体", "agriculture"],
};

const tools = [{ name: "get_municipality_stats" }, { name: "unlisted_future_tool" }];

describe("tool-filter dynamic modes", () => {
  it("exposes only mode-listed tools for a custom mode", () => {
    expect(filterTools(tools, agriopsServer, "agri_research")).toEqual([
      { name: "get_municipality_stats" },
    ]);
    expect(isToolPermitted("get_municipality_stats", agriopsServer, "agri_research")).toBe(true);
    expect(isToolPermitted("unlisted_future_tool", agriopsServer, "agri_research")).toBe(false);
  });

  it("hides servers from focused modes when the mode list is empty or missing", () => {
    expect(filterTools(tools, agriopsServer, "financial_check")).toEqual([]);
    expect(filterTools(tools, agriopsServer, "unknown_mode")).toEqual([]);
    expect(isServerVisibleInMode(agriopsServer, "financial_check")).toBe(false);
    expect(isServerVisibleInMode(agriopsServer, "unknown_mode")).toBe(false);
  });

  it("keeps full_orchestration as the reserved all-tools mode", () => {
    expect(filterTools(tools, agriopsServer, "full_orchestration")).toEqual(tools);
    expect(isServerVisibleInMode(agriopsServer, "full_orchestration")).toBe(true);
  });
});
