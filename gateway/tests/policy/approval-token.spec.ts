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
    const token = issue("gmo-bank", "gmo_bank_transfer", { amount: 10000, account_id: "acc1" });
    const result = verify(token, "gmo-bank", "gmo_bank_transfer", {
      amount: 10000,
      account_id: "acc1",
    });
    expect(result.ok).toBe(true);
  });

  it("引数が異なると args_mismatch になる / returns args_mismatch when args differ", () => {
    const token = issue("gmo-bank", "gmo_bank_transfer", { amount: 10000 });
    const result = verify(token, "gmo-bank", "gmo_bank_transfer", { amount: 99999 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("args_mismatch");
  });

  it("server_id が異なると args_mismatch になる / returns args_mismatch for wrong server_id", () => {
    const token = issue("gmo-bank", "gmo_bank_transfer", {});
    const result = verify(token, "freee", "gmo_bank_transfer", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("args_mismatch");
  });

  it("tool_name が異なると args_mismatch になる / returns args_mismatch for wrong tool_name", () => {
    const token = issue("gmo-bank", "gmo_bank_transfer", {});
    const result = verify(token, "gmo-bank", "gmo_bank_get_balance", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("args_mismatch");
  });

  it("トークンが改ざんされると malformed になる / returns malformed for tampered token", () => {
    const token = issue("gmo-bank", "gmo_bank_transfer", {});
    const corrupted = `${token}TAMPERED`;
    const result = verify(corrupted, "gmo-bank", "gmo_bank_transfer", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("malformed");
  });

  it("TTL 切れのトークンは expired になる / expired token returns expired", () => {
    // TTL を 0 にすることで即期限切れにする
    // Set TTL to 0 to immediately expire
    vi.useFakeTimers();
    const token = issue("gmo-bank", "gmo_bank_transfer", {}, 1);
    // 2 秒進める / advance by 2 seconds
    vi.advanceTimersByTime(2000);
    const result = verify(token, "gmo-bank", "gmo_bank_transfer", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
    vi.useRealTimers();
  });

  it("GATEWAY_APPROVAL_HMAC_SECRET が未設定だと issue で throw する / throws when secret not set", () => {
    delete process.env.GATEWAY_APPROVAL_HMAC_SECRET;
    expect(() => issue("gmo-bank", "gmo_bank_transfer", {})).toThrow(
      "GATEWAY_APPROVAL_HMAC_SECRET",
    );
  });
});
