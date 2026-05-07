// policy-engine のユニットテスト（required_approval / compliance_check 拡張を含む）
// Unit tests for policy-engine (including required_approval / compliance_check extensions)
// Pengujian unit untuk policy-engine (termasuk ekstensi required_approval / compliance_check)

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { issue } from "../../src/policy/approval-token.js";
import { evaluate } from "../../src/policy/policy-engine.js";
import type { ChildMcpServer } from "../../src/registry/schema.js";

const TEST_SECRET = "test-hmac-secret-policy-engine";

const baseServer: ChildMcpServer = {
  id: "moneyforward-ca",
  display_name: "マネーフォワード クラウド会計 MCP",
  display_name_en: "MoneyForward Cloud Accounting MCP",
  display_name_id: "MoneyForward Cloud Accounting MCP",
  endpoint: "https://beta.mcp.developers.biz.moneyforward.com/mcp/ca/v3",
  auth_type: "bearer_oauth",
  risk_level: "financial",
  tool_allowlist: ["get_trial_balance", "create_journal_entry"],
  attribution: {
    source: "株式会社マネーフォワード（クラウド会計）",
    license: "proprietary",
    url: "https://developers.biz.moneyforward.com/mcp/",
  },
  routing_keywords: ["仕訳", "試算表"],
  tool_policies: {
    create_journal_entry: {
      required_approval: true,
      compliance_check: ["accounting_period_open"],
    },
  },
};

beforeEach(() => {
  process.env.GATEWAY_APPROVAL_HMAC_SECRET = TEST_SECRET;
});

afterEach(() => {
  delete process.env.GATEWAY_APPROVAL_HMAC_SECRET;
});

// rate limit を高く設定してテスト間の干渉を防ぐ
// Set high rate limit to prevent interference between tests
// Tetapkan batas laju tinggi untuk mencegah gangguan antar pengujian
const HIGH_RATE = 1000;

describe("policy-engine: required_approval", () => {
  it("approval_token なしだと denied になる / denied without approval_token", () => {
    const result = evaluate({
      server: baseServer,
      toolName: "create_journal_entry",
      tier: "pro",
      isOAuthAuthenticated: true,
      rateLimitPerSecond: HIGH_RATE,
    });
    expect(result.decision).toBe("denied");
    expect(result.reason).toContain("approval token");
  });

  it("有効な approval_token があれば通過する / passes with valid approval_token", () => {
    const args = { amount: 5000, journal_date: "2026-05-01" };
    const token = issue("moneyforward-ca", "create_journal_entry", args);
    const result = evaluate({
      server: baseServer,
      toolName: "create_journal_entry",
      tier: "pro",
      isOAuthAuthenticated: true,
      approvalToken: token,
      toolArguments: args,
      complianceContext: { accounting_period_open: true },
      rateLimitPerSecond: HIGH_RATE,
    });
    expect(result.decision).toBe("allowed");
  });

  it("改ざんされた token は denied になる / tampered token results in denied", () => {
    const token = issue("moneyforward-ca", "create_journal_entry", {});
    const result = evaluate({
      server: baseServer,
      toolName: "create_journal_entry",
      tier: "pro",
      isOAuthAuthenticated: true,
      approvalToken: `${token}XYZ`,
      toolArguments: {},
      complianceContext: { accounting_period_open: true },
      rateLimitPerSecond: HIGH_RATE,
    });
    expect(result.decision).toBe("denied");
  });
});

describe("policy-engine: compliance_check", () => {
  it("compliance_context が欠けていると denied になる / denied when compliance_context is missing keys", () => {
    const args = { amount: 5000 };
    const token = issue("moneyforward-ca", "create_journal_entry", args);
    const result = evaluate({
      server: baseServer,
      toolName: "create_journal_entry",
      tier: "pro",
      isOAuthAuthenticated: true,
      approvalToken: token,
      toolArguments: args,
      complianceContext: {},
      rateLimitPerSecond: HIGH_RATE,
    });
    expect(result.decision).toBe("denied");
    expect(result.reason).toContain("accounting_period_open");
  });

  it("全ての compliance_check が true なら通過する / passes when all compliance checks are true", () => {
    const args = {};
    const token = issue("moneyforward-ca", "create_journal_entry", args);
    const result = evaluate({
      server: baseServer,
      toolName: "create_journal_entry",
      tier: "pro",
      isOAuthAuthenticated: true,
      approvalToken: token,
      toolArguments: args,
      complianceContext: { accounting_period_open: true },
      rateLimitPerSecond: HIGH_RATE,
    });
    expect(result.decision).toBe("allowed");
  });
});

describe("policy-engine: read-only tools without policy", () => {
  it("tool_policies のないツールはそのまま通過する / tools without policy pass normally", () => {
    const result = evaluate({
      server: baseServer,
      toolName: "get_trial_balance",
      tier: "pro",
      isOAuthAuthenticated: true,
      rateLimitPerSecond: HIGH_RATE,
    });
    expect(result.decision).toBe("allowed");
  });

  it("free tier は financial サーバーにアクセスできない / free tier denied for financial server", () => {
    const result = evaluate({
      server: baseServer,
      toolName: "get_trial_balance",
      tier: "free",
      isOAuthAuthenticated: false,
      rateLimitPerSecond: HIGH_RATE,
    });
    expect(result.decision).toBe("denied");
  });
});

// MoneyForward クラウド会計 MCP の policy テスト
// Policy tests for MoneyForward Cloud Accounting MCP
// Pengujian kebijakan untuk MoneyForward Cloud Accounting MCP
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
  routing_keywords: ["仕訳", "試算表"],
  tool_policies: {
    create_journal_entry: {
      required_approval: true,
      compliance_check: ["accounting_period_open"],
    },
    update_journal_entry: {
      required_approval: true,
      compliance_check: ["accounting_period_open"],
    },
  },
};

describe("policy-engine: MoneyForward financial server", () => {
  it("OAuth 未認証で financial サーバーを呼ぶと denied / denied without OAuth for financial server", () => {
    const result = evaluate({
      server: mfcaServer,
      toolName: "get_trial_balance",
      tier: "pro",
      isOAuthAuthenticated: false,
      rateLimitPerSecond: HIGH_RATE,
    });
    expect(result.decision).toBe("denied");
    expect(result.reason).toContain("OAuth");
  });

  it("OAuth 認証済みで read ツールは通過する / read tool passes with OAuth auth", () => {
    const result = evaluate({
      server: mfcaServer,
      toolName: "get_trial_balance",
      tier: "pro",
      isOAuthAuthenticated: true,
      rateLimitPerSecond: HIGH_RATE,
    });
    expect(result.decision).toBe("allowed");
  });

  it("write ツールは approval_token なしで denied / write tool denied without approval_token", () => {
    const result = evaluate({
      server: mfcaServer,
      toolName: "create_journal_entry",
      tier: "pro",
      isOAuthAuthenticated: true,
      rateLimitPerSecond: HIGH_RATE,
    });
    expect(result.decision).toBe("denied");
    expect(result.reason).toContain("approval token");
  });

  it("write ツールは compliance_context 不足で denied / write tool denied without compliance_context", () => {
    const args = { journal_date: "2026-05-01", amount: 100000 };
    const token = issue("moneyforward-ca", "create_journal_entry", args);
    const result = evaluate({
      server: mfcaServer,
      toolName: "create_journal_entry",
      tier: "pro",
      isOAuthAuthenticated: true,
      approvalToken: token,
      toolArguments: args,
      complianceContext: {},
      rateLimitPerSecond: HIGH_RATE,
    });
    expect(result.decision).toBe("denied");
    expect(result.reason).toContain("accounting_period_open");
  });

  it("write ツールは approval_token + compliance_context が揃えば allowed / allowed with full approval", () => {
    const args = { journal_date: "2026-05-01", amount: 100000 };
    const token = issue("moneyforward-ca", "create_journal_entry", args);
    const result = evaluate({
      server: mfcaServer,
      toolName: "create_journal_entry",
      tier: "pro",
      isOAuthAuthenticated: true,
      approvalToken: token,
      toolArguments: args,
      complianceContext: { accounting_period_open: true },
      rateLimitPerSecond: HIGH_RATE,
    });
    expect(result.decision).toBe("allowed");
  });

  it("free tier は financial サーバー（MF）にアクセスできない / free tier denied for MoneyForward", () => {
    const result = evaluate({
      server: mfcaServer,
      toolName: "get_trial_balance",
      tier: "free",
      isOAuthAuthenticated: false,
      rateLimitPerSecond: HIGH_RATE,
    });
    expect(result.decision).toBe("denied");
  });
});
