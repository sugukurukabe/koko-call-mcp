// approval-token のユニットテスト
// Unit tests for approval-token
// Pengujian unit untuk approval-token

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issue, verify } from "../../src/policy/approval-token.js";

const TEST_SECRET = "test-hmac-secret-for-unit-tests";

beforeEach(() => {
  process.env.GATEWAY_APPROVAL_HMAC_SECRET = TEST_SECRET;
});

afterEach(() => {
  delete process.env.GATEWAY_APPROVAL_HMAC_SECRET;
});

describe("approval-token: issue & verify", () => {
  it("正常に発行してそのまま検証できる / issues and verifies successfully", () => {
    const token = issue("moneyforward-ca", "create_journal_entry", {
      amount: 10000,
      journal_date: "2026-05-01",
    });
    const result = verify(token, "moneyforward-ca", "create_journal_entry", {
      amount: 10000,
      journal_date: "2026-05-01",
    });
    expect(result.ok).toBe(true);
  });

  it("引数が異なると args_mismatch になる / returns args_mismatch when args differ", () => {
    const token = issue("moneyforward-ca", "create_journal_entry", { amount: 10000 });
    const result = verify(token, "moneyforward-ca", "create_journal_entry", { amount: 99999 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("args_mismatch");
  });

  it("server_id が異なると args_mismatch になる / returns args_mismatch for wrong server_id", () => {
    const token = issue("moneyforward-ca", "create_journal_entry", {});
    const result = verify(token, "freee", "create_journal_entry", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("args_mismatch");
  });

  it("tool_name が異なると args_mismatch になる / returns args_mismatch for wrong tool_name", () => {
    const token = issue("moneyforward-ca", "create_journal_entry", {});
    const result = verify(token, "moneyforward-ca", "get_trial_balance", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("args_mismatch");
  });

  it("トークンが改ざんされると malformed になる / returns malformed for tampered token", () => {
    const token = issue("moneyforward-ca", "create_journal_entry", {});
    const corrupted = `${token}TAMPERED`;
    const result = verify(corrupted, "moneyforward-ca", "create_journal_entry", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("malformed");
  });

  it("TTL 切れのトークンは expired になる / expired token returns expired", () => {
    // TTL を 0 にすることで即期限切れにする
    // Set TTL to 0 to immediately expire
    vi.useFakeTimers();
    const token = issue("moneyforward-ca", "create_journal_entry", {}, 1);
    // 2 秒進める / advance by 2 seconds
    vi.advanceTimersByTime(2000);
    const result = verify(token, "moneyforward-ca", "create_journal_entry", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
    vi.useRealTimers();
  });

  it("GATEWAY_APPROVAL_HMAC_SECRET が未設定だと issue で throw する / throws when secret not set", () => {
    delete process.env.GATEWAY_APPROVAL_HMAC_SECRET;
    expect(() => issue("moneyforward-ca", "create_journal_entry", {})).toThrow(
      "GATEWAY_APPROVAL_HMAC_SECRET",
    );
  });
});
