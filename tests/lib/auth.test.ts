// API Key認証ユニットテスト
// Unit tests for API key authentication
// Pengujian unit untuk autentikasi kunci API

import { describe, expect, it } from "vitest";
import { isInBetaPeriod, parseProApiKeys, parseTier } from "../../src/lib/auth.js";

describe("parseProApiKeys", () => {
  it("空文字列 / empty string / string kosong → empty set", () => {
    expect(parseProApiKeys("")).toEqual(new Set());
    expect(parseProApiKeys(undefined)).toEqual(new Set());
  });

  it("カンマ区切りのキーをSetに変換 / comma-separated keys become Set / kunci dipisahkan koma menjadi Set", () => {
    const keys = parseProApiKeys("jp-bids_aaa,jp-bids_bbb, jp-bids_ccc ");
    expect(keys.has("jp-bids_aaa")).toBe(true);
    expect(keys.has("jp-bids_bbb")).toBe(true);
    expect(keys.has("jp-bids_ccc")).toBe(true);
    expect(keys.size).toBe(3);
  });
});

describe("isInBetaPeriod", () => {
  it("2026年6月中はtrue / June 2026 is within beta / Juni 2026 dalam periode beta", () => {
    expect(isInBetaPeriod(new Date("2026-06-30T23:59:59+09:00"))).toBe(true);
    expect(isInBetaPeriod(new Date("2026-05-01T00:00:00+09:00"))).toBe(true);
  });

  it("2026年7月1日以降はfalse / From July 1, 2026 is not beta / Dari 1 Juli 2026 bukan beta", () => {
    expect(isInBetaPeriod(new Date("2026-07-01T00:00:01+09:00"))).toBe(false);
    expect(isInBetaPeriod(new Date("2027-01-01T00:00:00+09:00"))).toBe(false);
  });
});

describe("parseTier", () => {
  const proKeys = new Set(["jp-bids_secret123"]);
  // ベータ期間後の日付でキー検証をテスト
  // Use post-beta date to test key-based auth logic
  // Gunakan tanggal pasca-beta untuk menguji logika autentikasi berbasis kunci
  const afterBeta = new Date("2026-08-01T00:00:00+09:00");

  it("ベータ期間中は全リクエストPro / all Pro during beta / semua Pro selama beta", () => {
    const duringBeta = new Date("2026-06-15T12:00:00+09:00");
    expect(parseTier(undefined, proKeys, duringBeta)).toBe("pro");
    expect(parseTier("Bearer jp-bids_wrongkey", proKeys, duringBeta)).toBe("pro");
  });

  it("キーが未設定なら全リクエストPro / no keys configured → all Pro / tidak ada kunci → semua Pro", () => {
    expect(parseTier(undefined, new Set(), afterBeta)).toBe("pro");
    expect(parseTier("Bearer jp-bids_anything", new Set(), afterBeta)).toBe("pro");
  });

  it("Authorizationヘッダーなし → Free / no Authorization header → Free / tidak ada header → Free", () => {
    expect(parseTier(undefined, proKeys, afterBeta)).toBe("free");
  });

  it("不正なヘッダー形式 → Free / malformed header → Free / header tidak valid → Free", () => {
    expect(parseTier("jp-bids_secret123", proKeys, afterBeta)).toBe("free");
    expect(parseTier("Token jp-bids_secret123", proKeys, afterBeta)).toBe("free");
  });

  it("正しいProキー → Pro / valid Pro key → Pro / kunci Pro valid → Pro", () => {
    expect(parseTier("Bearer jp-bids_secret123", proKeys, afterBeta)).toBe("pro");
    expect(parseTier("bearer jp-bids_secret123", proKeys, afterBeta)).toBe("pro");
    expect(parseTier("  Bearer jp-bids_secret123  ", proKeys, afterBeta)).toBe("pro");
  });

  it("存在しないキー → Free / unknown key → Free / kunci tidak dikenal → Free", () => {
    expect(parseTier("Bearer jp-bids_wrongkey", proKeys, afterBeta)).toBe("free");
  });
});
